// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { copyOfPage, countLinksTo, pagePathFromName, relinkPage } from '../../src/lib/site/pages'
import { resolvePreviewLink } from '../../src/lib/site/preview'
import {
  findFontStacks,
  findHexColors,
  normalizeHex,
  parseRootVars,
  primaryFamily,
  replaceFontStack,
  replaceHexColor,
  setRootVar,
  toHex,
  varKind,
  withAlphaOf,
} from '../../src/lib/site/theme'

const CSS = `/* tema */
:root {
  --rosa: #e5007d;   /* principal */
  --fondo: #FFF8F0;
  --texto: rgb(59, 34, 24);
  --fuente: 'Fraunces', Georgia, serif;
  --radio: 14px;
  --logo: url("img/a;b.svg");
}
body { color: var(--texto); background: #fff8f0; font-family: 'DM Sans', system-ui, sans-serif; }
h1, h2 { font-family: 'Fraunces', Georgia, serif; color: #E5007D; border-color: #e5007d80 }
.btn { background: #e50; box-shadow: 0 2px 0 #e5007d; background-image: url(img/e5007d.png) }
.a::before { content: "#e5007d"; }
`

describe('variables de :root', () => {
  it('lee las variables y su tipo', () => {
    const vars = parseRootVars(CSS)
    expect(vars.map((v) => v.name)).toEqual(['--rosa', '--fondo', '--texto', '--fuente', '--radio', '--logo'])
    expect(vars.find((v) => v.name === '--fuente')!.value).toBe("'Fraunces', Georgia, serif")
    expect(vars.find((v) => v.name === '--logo')!.value).toBe('url("img/a;b.svg")')
    expect(varKind('--rosa', '#e5007d')).toBe('color')
    expect(varKind('--texto', 'rgb(59, 34, 24)')).toBe('color')
    expect(varKind('--fuente', "'Fraunces', Georgia, serif")).toBe('font')
    expect(varKind('--radio', '14px')).toBe('length')
    expect(varKind('--logo', 'url(x.svg)')).toBe('other')
  })

  it('no se confunde con comentarios entre declaraciones', () => {
    const css = ':root { --a: #111; /* uno */ --b: #222 /* dos */; /* tres */ --c: 3px; }\nbody { color: red; /* nota */ font-family: serif; }'
    expect(parseRootVars(css).map((v) => v.name)).toEqual(['--a', '--b', '--c'])
    expect(setRootVar(css, '--b', '#999')).toContain('--b: #999 /* dos */;')
    expect(setRootVar(css, '--c', '4px')).toContain('/* tres */ --c: 4px;')
    expect(findFontStacks(css).get('serif')).toBe(1)
    expect(replaceFontStack(css, 'serif', 'sans-serif')).toContain('/* nota */ font-family: sans-serif;')
  })

  it('cambia solo el valor de esa variable, sin tocar nada más', () => {
    const out = setRootVar(CSS, '--rosa', '#00aa55')
    expect(out).toContain('--rosa: #00aa55;   /* principal */')
    expect(out.replace('--rosa: #00aa55;', '--rosa: #e5007d;')).toBe(CSS)
    expect(setRootVar(CSS, '--no-existe', '#000')).toBe(CSS)
    // un valor con llaves o punto y coma no puede romper el CSS
    expect(setRootVar(CSS, '--radio', '10px; } body { display:none')).not.toContain('display:none }')
  })
})

describe('colores y tipografías en el CSS', () => {
  it('cuenta los colores hexadecimales usados (sin variables, textos ni url)', () => {
    const colors = findHexColors(CSS)
    expect(colors.get('#e5007d')).toBe(2) // el título y la sombra del botón
    expect(colors.get('#fff8f0')).toBe(1)
    expect(colors.has('#e5007d80')).toBe(true)
    expect(colors.get('#ee5500')).toBe(1) // #e50 abreviado
  })

  it('reemplaza un color en todas partes menos en variables, textos y url()', () => {
    const out = replaceHexColor(CSS, '#e5007d', '#0033cc')
    expect(out).toContain('color: #0033cc;')
    expect(out).toContain('box-shadow: 0 2px 0 #0033cc')
    expect(out).toContain('--rosa: #e5007d;') // las variables se cambian con setRootVar
    expect(out).toContain('content: "#e5007d"')
    expect(out).toContain('url(img/e5007d.png)')
    expect(out).toContain('border-color: #e5007d80') // otro color distinto (con transparencia)
  })

  it('conserva la transparencia al cambiar un color con alfa', () => {
    expect(replaceHexColor('a { color: #e5007d80 }', '#e5007d80', '#112233')).toContain('#11223380')
    expect(withAlphaOf('#e5007d80', '#112233')).toBe('#11223380')
    expect(withAlphaOf('#e5007d', '#112233')).toBe('#112233')
  })

  it('normaliza colores', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('#abcd')).toBe('#aabbccdd')
    expect(normalizeHex('abc')).toBeNull()
    expect(toHex('rgb(59, 34, 24)')).toBe('#3b2218')
    expect(toHex('hsl(10 20% 30%)')).toBeNull()
  })

  it('encuentra y cambia listas de tipografías', () => {
    const stacks = findFontStacks(CSS)
    expect(stacks.get("'Fraunces', Georgia, serif")).toBe(1)
    expect(stacks.get("'DM Sans', system-ui, sans-serif")).toBe(1)
    const out = replaceFontStack(CSS, "'DM Sans', system-ui, sans-serif", "'Lora', serif")
    expect(out).toContain("font-family: 'Lora', serif;")
    expect(out).toContain("--fuente: 'Fraunces', Georgia, serif;") // variables intactas
    expect(primaryFamily("'Fraunces', Georgia, serif")).toBe('Fraunces')
  })
})

describe('páginas y enlaces', () => {
  it('arma el nombre del archivo desde el título', () => {
    expect(pagePathFromName('Contáctanos ya', 'index.html')).toBe('contactanos-ya.html')
    expect(pagePathFromName('¡¡¡', 'index.html')).toBe('pagina.html')
    expect(pagePathFromName('Menú del día', 'sitio/index.html')).toBe('sitio/menu-del-dia.html')
  })

  it('cuenta y actualiza enlaces al renombrar una página', () => {
    const html = `<a href="gracias.html">a</a> <a href='gracias.html#arriba'>b</a> <form action="gracias.html"></form> <a href="otra.html">c</a> <a href="https://x.com/gracias.html">d</a>`
    expect(countLinksTo(html, 'index.html', 'gracias.html', '')).toBe(3)
    const out = relinkPage(html, 'index.html', 'gracias.html', 'listo.html', '')
    expect(out).toContain('href="listo.html"')
    expect(out).toContain("href='listo.html#arriba'")
    expect(out).toContain('action="listo.html"')
    expect(out).toContain('href="otra.html"')
    expect(out).toContain('https://x.com/gracias.html')
  })

  it('al duplicar una página corrige las rutas relativas', () => {
    const html = '<!DOCTYPE html><html><head><title>A</title><link rel="stylesheet" href="css/a.css"></head><body><img src="img/x.png"><a href="b.html">b</a></body></html>'
    const out = copyOfPage(html, 'index.html', 'sub/copia.html', '', 'Copia')
    expect(out).toContain('href="../css/a.css"')
    expect(out).toContain('src="../img/x.png"')
    expect(out).toContain('<title>Copia</title>')
  })

  it('en la vista previa resuelve a qué página lleva un enlace', () => {
    const pages = ['index.html', 'gracias.html', 'blog/index.html']
    expect(resolvePreviewLink('gracias.html', 'index.html', '', pages)).toBe('gracias.html')
    expect(resolvePreviewLink('./gracias.html?x=1#y', 'index.html', '', pages)).toBe('gracias.html')
    expect(resolvePreviewLink('blog/', 'index.html', '', pages)).toBe('blog/index.html')
    expect(resolvePreviewLink('https://google.com', 'index.html', '', pages)).toBeNull()
    expect(resolvePreviewLink('#pan', 'index.html', '', pages)).toBe('index.html') // ancla de la misma página
  })
})
