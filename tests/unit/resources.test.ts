// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { inertCopy, parseHtml } from '../../src/lib/site/document'
import { copyOfPage, rebaseHtmlFragment } from '../../src/lib/site/pages'
import { ResourceHub, type ResourceReader } from '../../src/lib/site/resources'

const enc = (s: string) => new TextEncoder().encode(s)

/** Un "repositorio" en memoria con una lista de las veces que se leyó cada archivo. */
function fakeRepo(files: Record<string, string>) {
  const reads: string[] = []
  const reader: ResourceReader = {
    async readBytes(path) {
      reads.push(path)
      return path in files ? enc(files[path]!) : null
    },
  }
  return { reader, reads }
}

const FILES = {
  'img/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'img/jarra.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="2"/>',
  'img/nuevo.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="3"/>',
  'css/main.css': '.a{background:url(../img/logo.svg)}',
}

function fragment(html: string): Node[] {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  return Array.from(tpl.content.childNodes)
}

describe('ResourceHub: HTML nuevo (pegado o editado en el código)', () => {
  it('cambia al instante las rutas que la página ya había cargado', async () => {
    const { reader, reads } = fakeRepo(FILES)
    const hub = new ResourceHub(reader, '', 'data')
    await hub.rewriteDocument(parseHtml('<html><body><img src="img/logo.svg"><img srcset="img/jarra.svg 1x, img/logo.svg 2x" src="img/jarra.svg"></body></html>'), 'index.html')
    const readsBefore = reads.length

    const nodes = fragment('<div><img src="img/logo.svg" alt="x"><img srcset="img/jarra.svg 1x, img/logo.svg 2x" src="img/jarra.svg"></div>')
    void hub.adoptNodes(nodes, 'index.html') // sin esperar: tiene que estar listo en el mismo instante
    const imgs = (nodes[0] as Element).querySelectorAll('img')
    expect(imgs[0]!.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(imgs[1]!.getAttribute('src')).toMatch(/^data:/)
    expect(imgs[1]!.getAttribute('srcset')).toMatch(/^data:[^ ]+ 1x, data:[^ ]+ 2x$/)
    expect(reads.length).toBe(readsBefore) // no volvió a leer nada del repositorio
  })

  it('carga lo que todavía no estaba y respeta lo externo', async () => {
    const { reader } = fakeRepo(FILES)
    const hub = new ResourceHub(reader, '', 'data')
    await hub.rewriteDocument(parseHtml('<html><body></body></html>'), 'index.html')
    const nodes = fragment('<p><img src="img/nuevo.svg"><img src="https://x.com/a.png"><img src="data:image/gif;base64,R0lGOD"><img src="img/no-existe.png"></p>')
    await hub.adoptNodes(nodes, 'index.html')
    const imgs = (nodes[0] as Element).querySelectorAll('img')
    expect(imgs[0]!.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(imgs[1]!.getAttribute('src')).toBe('https://x.com/a.png')
    expect(imgs[2]!.getAttribute('src')).toBe('data:image/gif;base64,R0lGOD')
    expect(imgs[3]!.getAttribute('src')).toBe('img/no-existe.png') // no existe: se deja como está
    expect(hub.missing.has('img/no-existe.png')).toBe(true)
  })

  it('las rutas se entienden desde la carpeta de la página', async () => {
    const { reader } = fakeRepo(FILES)
    const hub = new ResourceHub(reader, '', 'data')
    await hub.rewriteDocument(parseHtml('<html><body><img src="../img/logo.svg"></body></html>'), 'about/index.html')
    const nodes = fragment('<img src="../img/logo.svg">')
    void hub.adoptNodes(nodes, 'about/index.html')
    expect((nodes[0] as Element).getAttribute('src')).toMatch(/^data:/)
  })

  it('los iframes y scripts pegados se muestran como marcador, igual que al abrir la página', async () => {
    const { reader } = fakeRepo(FILES)
    const hub = new ResourceHub(reader, '', 'data')
    const nodes = fragment('<div><iframe src="https://www.youtube.com/embed/abc"></iframe><script src="js/app.js"></script></div>')
    await hub.adoptNodes(nodes, 'index.html')
    const iframe = (nodes[0] as Element).querySelector('iframe')!
    expect(iframe.getAttribute('data-lz-src')).toBe('https://www.youtube.com/embed/abc')
    expect(iframe.getAttribute('src')).toBe('about:blank')
    const script = (nodes[0] as Element).querySelector('script')!
    expect(script.getAttribute('data-lz-src')).toBe('js/app.js')
    expect(script.getAttribute('src')).toBe('data:text/javascript,')
  })

  it('fondos en el atributo style y en <style>', async () => {
    const { reader } = fakeRepo(FILES)
    const hub = new ResourceHub(reader, '', 'data')
    const nodes = fragment('<div style="background:url(img/logo.svg)"><style>.x{background-image:url("img/jarra.svg")}</style></div>')
    await hub.adoptNodes(nodes, 'index.html')
    const div = nodes[0] as HTMLElement
    expect(div.getAttribute('style')).toMatch(/url\(data:image\/svg\+xml/)
    expect(div.querySelector('style')!.textContent).toMatch(/url\("?data:image\/svg\+xml/)
  })

  it('una imagen subida en el editor también está lista al instante', async () => {
    const { reader } = fakeRepo({})
    const hub = new ResourceHub(reader, '', 'data')
    hub.register('data:image/png;base64,AAAA', 'img/foto.png', 'img/foto.png')
    const nodes = fragment('<img src="img/foto.png">')
    void hub.adoptNodes(nodes, 'index.html')
    expect((nodes[0] as Element).getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })
})

describe('copia inerte del documento', () => {
  it('vive en un documento sin ventana, para que el navegador no descargue imágenes', () => {
    const live = parseHtml('<html><body><img src="img/a.png"></body></html>')
    const copy = inertCopy(live, live.documentElement)
    expect(copy.ownerDocument).not.toBe(live)
    expect(copy.ownerDocument.defaultView).toBeNull()
    expect(copy.querySelector('img')!.getAttribute('src')).toBe('img/a.png')
    expect(copy.outerHTML).toBe(live.documentElement.outerHTML)
  })
})

describe('rutas al mover HTML entre carpetas', () => {
  const PAGE = `<!DOCTYPE html>
<html><head><title>Inicio</title><link rel="stylesheet" href="css/main.css">
<style>.h{background:url(img/fondo.svg)} @import url("css/otro.css");</style></head>
<body style="background-image:url('img/fondo.svg')">
<a href="about/index.html">a</a> <a href="#top">t</a> <a href="mailto:a@b.mx">m</a> <a href="/raiz.html">r</a> <a href="https://x.com/img/a.png">x</a>
<img src="img/logo.svg" srcset="img/logo.svg 1x, img/jarra.svg 2x">
<picture><source srcset="img/jarra.svg"><img src="img/jarra.svg"></picture>
<video poster="img/logo.svg"></video>
<div style="background:url(img/jarra.svg) no-repeat"></div>
</body></html>
`

  it('al duplicar una página a otra carpeta corrige src, href, srcset, poster y fondos', () => {
    const out = copyOfPage(PAGE, 'index.html', 'sub/copia.html', '', 'Copia')
    expect(out).toContain('href="../css/main.css"')
    expect(out).toContain('href="../about/index.html"')
    expect(out).toContain('src="../img/logo.svg"')
    expect(out).toContain('srcset="../img/logo.svg 1x, ../img/jarra.svg 2x"')
    expect(out).toContain('<source srcset="../img/jarra.svg">')
    expect(out).toContain('poster="../img/logo.svg"')
    expect(out).toContain('url(../img/fondo.svg)')
    expect(out).toContain("url('../img/fondo.svg')")
    expect(out).toContain('url(../img/jarra.svg) no-repeat')
    expect(out).toContain('url("../css/otro.css")')
    // lo que no es un archivo del sitio queda igual
    expect(out).toContain('href="#top"')
    expect(out).toContain('href="mailto:a@b.mx"')
    expect(out).toContain('href="/raiz.html"')
    expect(out).toContain('https://x.com/img/a.png')
    expect(out).toContain('<title>Copia</title>')
  })

  it('en la misma carpeta no toca nada', () => {
    expect(copyOfPage(PAGE, 'index.html', 'copia.html', '', 'Inicio')).toContain('href="css/main.css"')
    const frag = '<img src="img/logo.svg" srcset="img/logo.svg 1x">'
    expect(rebaseHtmlFragment(frag, 'index.html', 'otra.html', '')).toBe(frag)
  })

  it('un trozo de HTML pegado en otra carpeta ajusta sus rutas', () => {
    const frag = '<section><img src="img/logo.svg" srcset="img/logo.svg 1x, img/jarra.svg 2x"><a href="contacto.html">c</a><div style="background:url(img/fondo.svg)"></div></section>'
    expect(rebaseHtmlFragment(frag, 'index.html', 'about/index.html', '')).toBe(
      '<section><img src="../img/logo.svg" srcset="../img/logo.svg 1x, ../img/jarra.svg 2x"><a href="../contacto.html">c</a><div style="background:url(../img/fondo.svg)"></div></section>',
    )
    // y de una subcarpeta a la raíz
    expect(rebaseHtmlFragment('<img src="../img/logo.svg">', 'about/index.html', 'index.html', '')).toBe('<img src="img/logo.svg">')
  })

  it('con el sitio dentro de una carpeta del repositorio (siteRoot)', () => {
    const out = rebaseHtmlFragment('<img src="img/a.png"><a href="/x.html">x</a>', 'docs/index.html', 'docs/blog/post.html', 'docs')
    expect(out).toBe('<img src="../img/a.png"><a href="/x.html">x</a>')
  })
})
