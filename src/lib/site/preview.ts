import { utf8Decode } from '../git/bytes'
import { parseHtml, serializeTree, doctypeOf } from './document'
import { isExternalRef, resolveRef } from './paths'
import { ResourceHub, type ResourceReader } from './resources'

/** Intercepta los enlaces de la vista previa para abrir otras páginas del sitio dentro de la misma vista. */
const NAV_SCRIPT = `<script>document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(!h||h.charAt(0)==='#'||/^(mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(h))return;if(/^(https?:)?\\/\\//i.test(h)){a.target='_blank';a.rel='noopener';return;}e.preventDefault();parent.postMessage({lienzoNav:h},'*');},true);</script>`

export interface PreviewOptions {
  html: string
  pagePath: string
  siteRoot: string
  reader: ResourceReader
}

/**
 * Arma una página autosuficiente (imágenes, estilos y scripts incrustados) para mostrarla con scripts activos
 * dentro de un iframe aislado. No toca el documento que se está editando.
 */
export async function buildPreview({ html, pagePath, siteRoot, reader }: PreviewOptions): Promise<string> {
  const doc = parseHtml(html)
  const hub = new ResourceHub(reader, siteRoot, 'data')

  // scripts: se incrustan como texto (un iframe aislado no puede cargar archivos del sitio)
  for (const s of Array.from(doc.querySelectorAll('script[src]'))) {
    const src = s.getAttribute('src') || ''
    if (isExternalRef(src)) continue
    const path = resolveRef(src, pagePath, siteRoot)
    const bytes = path ? await reader.readBytes(path) : null
    if (!bytes) continue
    s.removeAttribute('src')
    s.textContent = utf8Decode(bytes).replace(/<\/script/gi, '<\\/script')
  }
  await hub.rewriteDocument(doc, pagePath)
  // iframes incrustados: en la vista previa sí cargan
  for (const f of Array.from(doc.querySelectorAll('iframe[data-lz-src]'))) {
    f.setAttribute('src', f.getAttribute('data-lz-src') || '')
    f.removeAttribute('srcdoc')
    f.removeAttribute('data-lz-src')
  }
  // scripts externos (CDN): se restauran tal cual
  for (const s of Array.from(doc.querySelectorAll('script[data-lz-src]'))) {
    s.setAttribute('src', s.getAttribute('data-lz-src') || '')
    s.removeAttribute('data-lz-src')
  }
  const tpl = doc.createElement('template')
  tpl.innerHTML = NAV_SCRIPT
  doc.body.appendChild(tpl.content)
  const out = serializeTree(doc.documentElement, doctypeOf(doc))
  hub.dispose()
  return out
}

/** Ruta del repo a la que apunta un enlace de la vista previa, probando las formas habituales de Vercel. */
export function resolvePreviewLink(href: string, fromPage: string, siteRoot: string, pages: string[]): string | null {
  const clean = href.replace(/[?#].*$/, '')
  const candidates = [
    resolveRef(clean, fromPage, siteRoot),
    resolveRef(clean + '.html', fromPage, siteRoot),
    resolveRef(clean.replace(/\/?$/, '/') + 'index.html', fromPage, siteRoot),
  ]
  return candidates.find((c): c is string => !!c && pages.includes(c)) ?? null
}
