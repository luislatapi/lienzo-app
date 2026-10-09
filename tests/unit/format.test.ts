// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cleanTree, doctypeOf, normalizeHtml, parseHtml, preserveFormat, serializeTree } from '../../src/lib/site/document'

/** HTML a propósito desordenado: comillas simples, etiquetas sin cerrar, mayúsculas, entidades, comentarios. */
const MESSY = `<!DOCTYPE html>
<HTML lang='es'>
<head>
<meta charset=utf-8>
<title>Mi sitio</title>
<!-- comentario importante -->
<style>
  .a{color:red}
</style>
</head>
<BODY>
<h1 class=titulo>Hola &amp; bienvenidos &copy; 2024</h1>
<p>Primera línea<br />segunda línea</p>
<ul>
<li>Uno
<li>Dos
<li>Tres
</ul>
<img src='a.png' alt="x" />
<script>var x = "<b>";</script>
</BODY>
</HTML>
`

/** Aplica una edición al documento como lo haría el editor y devuelve lo que se guardaría (versión normalizada). */
function edited(src: string, mutate: (doc: Document) => void): string {
  const doc = parseHtml(src)
  mutate(doc)
  cleanTree(doc.documentElement, null)
  return serializeTree(doc.documentElement, doctypeOf(doc))
}

function publish(src: string, mutate: (doc: Document) => void) {
  const baseline = normalizeHtml(src)
  const working = edited(src, mutate)
  const out = preserveFormat(src, baseline, working)
  return { out, working, baseline }
}

describe('normalizeHtml', () => {
  it('es estable: normalizar dos veces da lo mismo (el archivo no crece al guardarlo y abrirlo)', () => {
    for (const src of [MESSY, MESSY.trimEnd(), MESSY + '\n\n', MESSY.replace('</BODY>\n</HTML>\n', '</BODY>\n'), '<p>suelto</p>\n', '<!DOCTYPE html><html><body>x</body></html>']) {
      const once = normalizeHtml(src)
      expect(normalizeHtml(once)).toBe(once)
    }
  })
})

describe('preserveFormat', () => {
  it('sin cambios devuelve el archivo tal cual', () => {
    const baseline = normalizeHtml(MESSY)
    expect(preserveFormat(MESSY, baseline, baseline)).toBe(MESSY)
  })

  it('cambiar un texto toca solo ese texto', () => {
    const { out, working } = publish(MESSY, (d) => {
      d.querySelector('h1')!.firstChild!.textContent = 'Hola mundo '
    })
    expect(normalizeHtml(out)).toBe(working)
    // todo lo demás conserva su formato original
    expect(out).toContain("<HTML lang='es'>")
    expect(out).toContain('<meta charset=utf-8>')
    expect(out).toContain('<br />')
    expect(out).toContain("<img src='a.png' alt=\"x\" />")
    expect(out).toContain('<li>Uno\n<li>Dos\n<li>Tres\n</ul>')
    expect(out).toContain('<!-- comentario importante -->')
    expect(out).toContain('Hola mundo ')
    const changed = out.split('\n').filter((l, i) => l !== MESSY.split('\n')[i])
    expect(changed.length).toBeLessThanOrEqual(1)
  })

  it('cambiar un atributo en una etiqueta con comillas simples y barra final', () => {
    const { out, working } = publish(MESSY, (d) => {
      d.querySelector('img')!.setAttribute('alt', 'Charola de conchas')
    })
    expect(normalizeHtml(out)).toBe(working)
    expect(out).toContain('alt="Charola de conchas"')
    expect(out).toContain('<li>Uno\n<li>Dos')
  })

  it('agregar un atributo al final de una etiqueta con barra', () => {
    const { out, working } = publish(MESSY, (d) => {
      d.querySelector('img')!.setAttribute('width', '640')
    })
    expect(normalizeHtml(out)).toBe(working)
    expect(out).toContain('width="640"')
    expect(out).toContain("src='a.png'")
  })

  it('insertar y eliminar elementos', () => {
    const { out, working } = publish(MESSY, (d) => {
      const p = d.createElement('p')
      p.textContent = 'Nuevo párrafo'
      d.querySelector('ul')!.after(p)
      d.querySelectorAll('li')[1]!.remove()
    })
    expect(normalizeHtml(out)).toBe(working)
    expect(out).toContain('Nuevo párrafo')
    expect(out).not.toContain('Dos')
    expect(out).toContain("<HTML lang='es'>")
  })

  it('agregar un <style> y un <link> en <head>', () => {
    const { out, working } = publish(MESSY, (d) => {
      const s = d.createElement('style')
      s.id = 'lienzo-blocks'
      s.textContent = '.x{color:blue}'
      d.head.appendChild(s)
      const l = d.createElement('link')
      l.setAttribute('rel', 'stylesheet')
      l.setAttribute('href', 'css/extra.css')
      d.head.insertBefore(l, d.head.querySelector('style'))
    })
    expect(normalizeHtml(out)).toBe(working)
    expect(out).toContain('css/extra.css')
    expect(out).toContain('.x{color:blue}')
    expect(out).toContain('<meta charset=utf-8>')
  })

  it('conserva los saltos de línea CRLF', () => {
    const crlf = MESSY.replace(/\n/g, '\r\n')
    const { out, working } = publish(crlf, (d) => {
      d.querySelector('h1')!.firstChild!.textContent = 'Otro título '
    })
    expect(out.includes('\r\n')).toBe(true)
    expect(out.replace(/\r\n/g, '\n').includes('\r')).toBe(false)
    expect(normalizeHtml(out)).toBe(working)
    expect(out).toContain('Otro título ')
  })

  it('si no se puede garantizar el resultado, devuelve el HTML completo ya editado', () => {
    const baseline = normalizeHtml(MESSY)
    const working = edited(MESSY, (d) => {
      d.querySelector('h1')!.firstChild!.textContent = 'Hola '
    })
    // un normalizador que nunca coincide fuerza el respaldo
    expect(preserveFormat(MESSY, baseline, working, () => 'x')).toBe(working)
  })

  it('ubica bien el cambio entre líneas repetidas y con comentarios fuera de <html>', () => {
    const src =
      "<!-- hecho a mano -->\n<!DOCTYPE html>\n<html>\n<body>\n<div class='a'>\n<div class='b'>\n<p>Uno</p>\n</div>\n</div>\n" +
      "<div class='a'>\n<div class='b'>\n<p>Dos</p>\n</div>\n</div>\n<div class='a'>\n<div class='b'>\n<p>Tres</p>\n</div>\n</div>\n</body>\n</html>\n<!-- fin -->\n"
    const { out, working } = publish(src, (d) => {
      d.querySelectorAll('p')[1]!.textContent = 'Dos, cambiado'
    })
    expect(normalizeHtml(out)).toBe(working)
    expect(out).toBe(src.replace('<p>Dos</p>', '<p>Dos, cambiado</p>'))
  })

  it('un archivo donde casi todas las líneas usan otra sintaxis sigue editándose línea por línea', () => {
    const lines = Array.from({ length: 400 }, (_, i) => `<IMG SRC='f${i}.png' ALT='foto ${i}' /><BR/>`)
    const src = `<!DOCTYPE html>\n<HTML>\n<BODY>\n${lines.join('\n')}\n</BODY>\n</HTML>\n`
    const { out, working } = publish(src, (d) => {
      d.querySelectorAll('img')[200]!.setAttribute('alt', 'otra descripción')
    })
    expect(normalizeHtml(out)).toBe(working)
    const was = src.split('\n')
    const changed = out.split('\n').filter((l, i) => l !== was[i])
    expect(changed).toHaveLength(1)
    expect(changed[0]).toContain('otra descripción')
    expect(changed[0]).toContain("SRC='f200.png'")
  })

  it('no se congela con cambios grandes ni con archivos largos', () => {
    const rows = Array.from({ length: 3000 }, (_, i) => `<p class='fila' data-i="${i}">Fila número ${i} con &nbsp;texto<br/>y salto</p>`)
    const big = `<!DOCTYPE html>\n<html><head><title>Grande</title></head>\n<body>\n${rows.join('\n')}\n</body>\n</html>\n`
    const t0 = Date.now()
    const { out, working } = publish(big, (d) => {
      const ps = d.querySelectorAll('p')
      ps[10]!.textContent = 'Cambiado al inicio'
      ps[1500]!.textContent = 'Cambiado en medio'
      ps[2990]!.remove()
    })
    expect(Date.now() - t0).toBeLessThan(4000)
    expect(normalizeHtml(out)).toBe(working)
    expect(out).toContain("<p class='fila' data-i=\"11\">")
    expect(out).toContain('Cambiado en medio')
  })
})
