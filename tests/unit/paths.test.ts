import { describe, expect, it } from 'vitest'
import {
  isExternalRef,
  normalizePath,
  relativeRef,
  resolveRef,
  slugifyFilename,
  uniquePath,
} from '../../src/lib/site/paths'
import { parseSrcset, replaceCssUrls, replaceSrcset, scanCssUrls } from '../../src/lib/site/css-urls'

describe('paths', () => {
  it('normaliza rutas', () => {
    expect(normalizePath('./a/../b//c.html')).toBe('b/c.html')
    expect(normalizePath('../x')).toBe('')
  })

  it('detecta referencias externas', () => {
    for (const r of ['https://x.com/a.png', '//cdn/x.js', 'data:image/png;base64,xx', 'mailto:a@b.c', '#top', 'tel:555', 'blob:abc', '']) {
      expect(isExternalRef(r)).toBe(true)
    }
    for (const r of ['img/a.png', '/img/a.png', '../a.css', './x.html?x=1']) expect(isExternalRef(r)).toBe(false)
  })

  it('resuelve referencias relativas y de raíz', () => {
    expect(resolveRef('img/a.png', 'index.html')).toBe('img/a.png')
    expect(resolveRef('../img/a.png', 'pages/about.html')).toBe('img/a.png')
    expect(resolveRef('/img/a.png', 'pages/about.html')).toBe('img/a.png')
    expect(resolveRef('/img/a.png', 'public/index.html', 'public')).toBe('public/img/a.png')
    expect(resolveRef('img/a%20b.png?v=2#x', 'index.html')).toBe('img/a b.png')
    expect(resolveRef('https://x.com/a.png', 'index.html')).toBeNull()
    expect(resolveRef('#hero', 'index.html')).toBeNull()
    expect(resolveRef('../../fuera.png', 'index.html')).toBeNull()
  })

  it('arma rutas relativas', () => {
    expect(relativeRef('index.html', 'img/a.png')).toBe('img/a.png')
    expect(relativeRef('pages/about.html', 'img/a.png')).toBe('../img/a.png')
    expect(relativeRef('pages/about.html', 'pages/x/b.png')).toBe('x/b.png')
    expect(relativeRef('public/index.html', 'public/img/a b.png', 'public', 'root')).toBe('/img/a%20b.png')
  })

  it('limpia nombres de archivo y evita duplicados', () => {
    expect(slugifyFilename('Mi Foto Ñandú (1).JPG')).toBe('mi-foto-nandu-1.jpg')
    const taken = new Set(['img/a.png', 'img/a-2.png'])
    expect(uniquePath('img/a.png', (p) => taken.has(p))).toBe('img/a-3.png')
    expect(uniquePath('img/z.png', (p) => taken.has(p))).toBe('img/z.png')
  })
})

describe('css urls', () => {
  it('encuentra url() con y sin comillas, @import y omite comentarios', () => {
    const css = `/* url(no.png) */ a{background:url(a.png)} b{background:url("b b.png")} c{background:url( 'c.png' )} @import "x.css"; @import url(y.css);`
    const refs = scanCssUrls(css).map((r) => r.raw)
    expect(refs).toEqual(['a.png', 'b b.png', 'c.png', 'x.css', 'y.css'])
  })

  it('reemplaza conservando comillas', () => {
    const css = `a{background:url("img/a.png")} b{background:url(img/b.png)}`
    const out = replaceCssUrls(css, (raw) => (raw.endsWith('a.png') ? 'blob:1' : null))
    expect(out).toBe(`a{background:url("blob:1")} b{background:url(img/b.png)}`)
  })

  it('procesa srcset', () => {
    expect(parseSrcset('a.png 1x, b.png 2x')).toEqual([
      { url: 'a.png', descriptor: '1x' },
      { url: 'b.png', descriptor: '2x' },
    ])
    expect(replaceSrcset('a.png 1x, b.png 2x', (u) => (u === 'b.png' ? 'X' : null))).toBe('a.png 1x, X 2x')
  })
})
