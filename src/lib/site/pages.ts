import { replaceCssUrls, replaceSrcset } from './css-urls'
import { doctypeOf, parseHtml, serializeTree } from './document'
import { isExternalRef, relativeRef, resolveRef, splitRef, dirname } from './paths'

const URL_ATTRS = ['src', 'href', 'poster', 'data-src']

/**
 * Ajusta rutas relativas (css, imágenes, enlaces, srcset, fondos en CSS escrito en la página)
 * cuando el HTML se mueve a una página que está en otra carpeta.
 */
export function rebaseRefs(root: ParentNode, fromPath: string, toPath: string, siteRoot: string) {
  if (dirname(fromPath) === dirname(toPath)) return
  const rebase = (v: string): string | null => {
    if (!v || isExternalRef(v) || v.startsWith('/')) return null
    const target = resolveRef(v, fromPath, siteRoot)
    if (!target) return null
    const next = relativeRef(toPath, target, siteRoot) + splitRef(v).suffix
    return next === v ? null : next
  }
  const rebaseCss = (css: string) => replaceCssUrls(css, (raw) => rebase(raw))
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of URL_ATTRS) {
      const v = el.getAttribute(attr)
      const next = v ? rebase(v) : null
      if (next !== null) el.setAttribute(attr, next)
    }
    const srcset = el.getAttribute('srcset')
    if (srcset) {
      const next = replaceSrcset(srcset, rebase)
      if (next !== srcset) el.setAttribute('srcset', next)
    }
    const style = el.getAttribute('style')
    if (style && /url\(/i.test(style)) {
      const next = rebaseCss(style)
      if (next !== style) el.setAttribute('style', next)
    }
    if (el.localName === 'style' && el.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      const css = el.textContent || ''
      if (/url\(|@import/i.test(css)) {
        const next = rebaseCss(css)
        if (next !== css) el.textContent = next
      }
    }
  }
}

/** Igual que rebaseRefs, para un trozo de HTML (algo copiado en una página y pegado en otra). */
export function rebaseHtmlFragment(html: string, fromPath: string, toPath: string, siteRoot: string): string {
  if (dirname(fromPath) === dirname(toPath)) return html
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  rebaseRefs(tpl.content, fromPath, toPath, siteRoot)
  return tpl.innerHTML
}

export function copyOfPage(html: string, fromPath: string, toPath: string, siteRoot: string, title: string): string {
  const doc = parseHtml(html)
  rebaseRefs(doc, fromPath, toPath, siteRoot)
  if (doc.title !== undefined) doc.title = title
  return serializeTree(doc.documentElement, doctypeOf(doc))
}

/** Página nueva con los mismos estilos, encabezado y pie que la página actual. */
export function blankPage(html: string, fromPath: string, toPath: string, siteRoot: string, title: string): string {
  const doc = parseHtml(html)
  rebaseRefs(doc, fromPath, toPath, siteRoot)
  doc.title = title
  doc.head.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]').forEach((n) => n.remove())
  const body = doc.body
  const keepTop = Array.from(body.children).filter((c) => ['HEADER', 'NAV'].includes(c.tagName))
  const keepBottom = Array.from(body.children).filter((c) => c.tagName === 'FOOTER')
  const scripts = Array.from(body.children).filter((c) => c.tagName === 'SCRIPT' && c.hasAttribute('src'))
  const sectionClass = (body.querySelector('main > section, section')?.getAttribute('class') || '').split(/\s+/).find((c) => /seccion|section/i.test(c))
  const main = doc.createElement('main')
  main.innerHTML = `\n    <section${sectionClass ? ` class="${sectionClass}"` : ''}>\n      <h1>${escapeText(title)}</h1>\n      <p>Escribe aquí el contenido de esta página. Usa el panel “Añadir” para agregar secciones.</p>\n    </section>\n  `
  body.replaceChildren(...keepTop, main, ...keepBottom, ...scripts)
  return serializeTree(doc.documentElement, doctypeOf(doc))
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

/** "Mi página nueva" -> "mi-pagina-nueva.html" en la misma carpeta que la página base. */
export function pagePathFromName(name: string, basePath: string, cleanUrls = false): string {
  const slug =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'pagina'
  const dir = dirname(basePath)
  void cleanUrls
  return (dir ? dir + '/' : '') + slug + '.html'
}

/** Página mínima para repositorios que todavía no tienen ninguna. */
export function starterPage(title: string): string {
  const t = escapeText(title)
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t}</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1b1a2e; line-height: 1.6; }
    main { max-width: 760px; margin: 0 auto; padding: 72px 24px; }
    h1 { font-size: 2.4rem; line-height: 1.15; margin: 0 0 16px; }
  </style>
</head>
<body>
  <main>
    <h1>${t}</h1>
    <p>Escribe aquí el contenido de tu página. Usa el panel “Añadir” para agregar secciones, imágenes y botones.</p>
  </main>
</body>
</html>
`
}

const LINK_ATTR = /(\b(?:href|src|action)\s*=\s*)(["'])(.*?)\2/gi

function targetsPage(value: string, fromPage: string, page: string, siteRoot: string): 'exact' | 'clean' | null {
  const r = resolveRef(value, fromPage, siteRoot)
  if (!r) return null
  if (r === page) return 'exact'
  if (r === page.replace(/\.html?$/i, '')) return 'clean'
  if (page.endsWith('/index.html') && (r === page.slice(0, -'/index.html'.length) || r + '/' === page.slice(0, -'index.html'.length))) return 'clean'
  return null
}

/** Cuántos enlaces de un HTML apuntan a la página indicada. */
export function countLinksTo(html: string, fromPage: string, page: string, siteRoot: string): number {
  let n = 0
  for (const m of html.matchAll(LINK_ATTR)) if (targetsPage(m[3], fromPage, page, siteRoot)) n++
  return n
}

/** Actualiza los enlaces de un HTML cuando una página cambia de nombre. */
export function relinkPage(html: string, fromPage: string, oldPage: string, newPage: string, siteRoot: string): string {
  return html.replace(LINK_ATTR, (whole, head: string, quote: string, value: string) => {
    const kind = targetsPage(value, fromPage, oldPage, siteRoot)
    if (!kind) return whole
    const { suffix } = splitRef(value)
    let next = relativeRef(fromPage, newPage, siteRoot, value.startsWith('/') ? 'root' : 'relative')
    if (kind === 'clean') next = next.replace(/\.html?$/i, '')
    return `${head}${quote}${next}${suffix}${quote}`
  })
}
