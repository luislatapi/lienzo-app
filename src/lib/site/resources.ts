import { utf8Decode } from '../git/bytes'
import { isExternalRef, isCssPath, mimeFromPath, resolveRef } from './paths'
import { replaceCssUrls, replaceSrcset, scanCssUrls } from './css-urls'

export interface ResourceReader {
  readBytes(path: string): Promise<Uint8Array | null>
}

const SRC_TAGS = new Set(['IMG', 'VIDEO', 'AUDIO', 'SOURCE', 'TRACK', 'EMBED', 'INPUT'])
const ICON_RELS = /\b(stylesheet|icon|shortcut|apple-touch-icon|mask-icon|image_src)\b/i

/**
 * Convierte las rutas relativas del repo (img/a.png, css/estilos.css…) en URLs temporales (blob:)
 * para que el editor pueda mostrar la página, y recuerda el texto original para devolverlo al guardar.
 */
export class ResourceHub {
  private urlToRef = new Map<string, string>()
  private cache = new Map<string, Promise<string | null>>()
  /** URLs ya creadas (ruta + texto original → blob), para poder usarlas al instante sin esperar */
  private ready = new Map<string, string>()
  private iframeSeq = 0
  /** archivos que la página usa pero no existen en el repo */
  readonly missing = new Set<string>()
  /** rutas de CSS enlazadas por la página: blobUrl → ruta del repo */
  readonly cssLinks = new Map<string, string>()

  constructor(
    private reader: ResourceReader,
    private siteRoot: string,
    /** 'blob': URLs temporales (editor). 'data': todo incrustado en el texto (vista previa sin permisos). */
    private mode: 'blob' | 'data' = 'blob',
  ) {}

  setSiteRoot(root: string) {
    this.siteRoot = root
  }

  /** Devuelve una URL blob para un archivo del repo (o null si no existe). */
  async urlFor(path: string, originalRef: string, depth = 0): Promise<string | null> {
    const key = `${path}\u0000${originalRef}`
    let p = this.cache.get(key)
    if (!p) {
      p = this.build(path, originalRef, depth)
      this.cache.set(key, p)
      p.then(
        (url) => void (url && this.ready.set(key, url)),
        () => undefined,
      )
    }
    return p
  }

  /** URL ya lista para esa referencia (sin esperar a nada), o null si todavía no se ha cargado. */
  private readyUrl(ref: string, pagePath: string): string | null {
    if (isExternalRef(ref)) return null
    const path = resolveRef(ref, pagePath, this.siteRoot)
    return path ? (this.ready.get(`${path}\u0000${ref}`) ?? null) : null
  }

  private async build(path: string, originalRef: string, depth: number): Promise<string | null> {
    const bytes = await this.reader.readBytes(path)
    if (!bytes) {
      this.missing.add(path)
      return null
    }
    let blob: Blob
    if (isCssPath(path)) {
      const css = await this.rewriteCss(utf8Decode(bytes), path, depth + 1)
      blob = new Blob([css], { type: 'text/css' })
    } else {
      blob = new Blob([bytes as BlobPart], { type: mimeFromPath(path) })
    }
    const url = this.mode === 'data' ? await blobToDataUrl(blob) : URL.createObjectURL(blob)
    this.urlToRef.set(url, originalRef)
    if (isCssPath(path)) this.cssLinks.set(url, path)
    return url
  }

  /** Reescribe url() e @import de un CSS que vive en cssPath. */
  async rewriteCss(css: string, cssPath: string, depth = 0): Promise<string> {
    if (depth > 6) return css
    const refs = [...new Set(scanCssUrls(css).map((r) => r.raw))].filter((r) => !isExternalRef(r))
    const resolved = new Map<string, string>()
    await Promise.all(
      refs.map(async (raw) => {
        const path = resolveRef(raw, cssPath, this.siteRoot)
        if (!path) return
        const url = await this.urlFor(path, raw, depth)
        if (url) resolved.set(raw, url)
      }),
    )
    return replaceCssUrls(css, (raw) => resolved.get(raw) ?? null)
  }

  /** Igual que rewriteCss, pero para CSS escrito dentro de la página (<style>, style=""). */
  private async rewriteInlineCss(css: string, pagePath: string): Promise<string> {
    return this.rewriteCss(css, pagePath, 1)
  }

  private async resolveAttr(ref: string, pagePath: string): Promise<string | null> {
    if (isExternalRef(ref)) return null
    const path = resolveRef(ref, pagePath, this.siteRoot)
    if (!path) return null
    return this.urlFor(path, ref)
  }

  /** Reescribe en sitio un documento recién parseado para poder mostrarlo en el editor. */
  async rewriteDocument(doc: Document, pagePath: string): Promise<void> {
    const jobs: Promise<void>[] = []
    for (const el of Array.from(doc.querySelectorAll('*'))) this.rewriteElement(el, pagePath, jobs)
    await Promise.all(jobs)
  }

  /**
   * Prepara HTML nuevo para el lienzo (algo pegado, o editado en el código): las rutas del repo pasan a URLs blob.
   * Lo que ya estaba cargado se cambia al instante, antes de que el navegador pida el archivo a la dirección del editor.
   */
  adoptNodes(nodes: Node[], pagePath: string): Promise<void> {
    const jobs: Promise<void>[] = []
    for (const n of nodes) {
      if (n.nodeType !== 1) continue
      const root = n as Element
      for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) this.rewriteElement(el, pagePath, jobs)
    }
    return Promise.all(jobs).then(() => undefined)
  }

  private rewriteElement(el: Element, pagePath: string, jobs: Promise<void>[]) {
    const tag = el.tagName
    const lower = el.localName
    const setAttr = (name: string, ref: string) => {
      const now = this.readyUrl(ref, pagePath)
      if (now) el.setAttribute(name, now)
      else jobs.push(this.resolveAttr(ref, pagePath).then((url) => void (url && el.setAttribute(name, url))))
    }

    // atributos de recursos
    if (SRC_TAGS.has(tag) && el.hasAttribute('src')) {
      if (tag !== 'INPUT' || el.getAttribute('type') === 'image') setAttr('src', el.getAttribute('src') || '')
    }
    if (tag === 'VIDEO' && el.hasAttribute('poster')) setAttr('poster', el.getAttribute('poster') || '')
    if (el.hasAttribute('srcset') && (tag === 'IMG' || tag === 'SOURCE')) {
      const raw = el.getAttribute('srcset') || ''
      const urls = raw.split(',').map((p) => p.trim().split(/\s+/)[0]).filter((u) => u && !isExternalRef(u))
      const map = new Map<string, string>()
      const pending: string[] = []
      for (const u of urls) {
        const now = this.readyUrl(u, pagePath)
        if (now) map.set(u, now)
        else pending.push(u)
      }
      if (map.size) el.setAttribute('srcset', replaceSrcset(raw, (u) => map.get(u) ?? null))
      if (pending.length) {
        jobs.push(
          (async () => {
            await Promise.all(
              pending.map(async (u) => {
                const url = await this.resolveAttr(u, pagePath)
                if (url) map.set(u, url)
              }),
            )
            if (map.size) el.setAttribute('srcset', replaceSrcset(raw, (u) => map.get(u) ?? null))
          })(),
        )
      }
    }
    if (lower === 'link' && el.hasAttribute('href') && ICON_RELS.test(el.getAttribute('rel') || '')) {
      setAttr('href', el.getAttribute('href') || '')
    }
    if ((lower === 'image' || lower === 'use') && el.namespaceURI === 'http://www.w3.org/2000/svg') {
      const attr = el.hasAttribute('href') ? 'href' : el.hasAttribute('xlink:href') ? 'xlink:href' : ''
      if (attr) setAttr(attr, el.getAttribute(attr) || '')
    }
    // estilos en línea
    if (el.hasAttribute('style') && /url\(/i.test(el.getAttribute('style') || '')) {
      const css = el.getAttribute('style') || ''
      jobs.push(this.rewriteInlineCss(css, pagePath).then((out) => void (out !== css && el.setAttribute('style', out))))
    }
    if (lower === 'style' && el.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      const css = el.textContent || ''
      if (/url\(|@import/i.test(css)) {
        jobs.push(this.rewriteInlineCss(css, pagePath).then((out) => void (out !== css && (el.textContent = out))))
      }
    }
    // iframes incrustados (YouTube, mapas…): no cargan dentro del editor, se muestran como marcador.
    // El atributo src se queda en su lugar (con otro valor) para no cambiar el orden de los atributos al guardar.
    if (lower === 'iframe' && el.hasAttribute('src') && !el.hasAttribute('data-lz-src')) {
      const src = el.getAttribute('src') || ''
      el.setAttribute('data-lz-src', src)
      el.setAttribute('src', 'about:blank')
      el.setAttribute('srcdoc', iframePlaceholder(src, ++this.iframeSeq))
    }
    // scripts: dentro del editor no se ejecutan; se evita pedirlos al servidor
    if (lower === 'script' && el.hasAttribute('src') && !el.hasAttribute('data-lz-src') && el.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      el.setAttribute('data-lz-src', el.getAttribute('src') || '')
      el.setAttribute('src', 'data:text/javascript,')
    }
  }

  /** Cambia el contenido de una hoja de estilos ya enlazada, para ver el resultado al instante. */
  async replaceStylesheet(link: HTMLLinkElement, cssPath: string, css: string): Promise<void> {
    const current = link.getAttribute('href') || ''
    const ref = this.urlToRef.get(current) ?? current
    const rewritten = await this.rewriteCss(css, cssPath, 1)
    const url = URL.createObjectURL(new Blob([rewritten], { type: 'text/css' }))
    this.urlToRef.set(url, ref)
    this.cssLinks.set(url, cssPath)
    this.cache.set(`${cssPath}\u0000${ref}`, Promise.resolve(url))
    this.ready.set(`${cssPath}\u0000${ref}`, url)
    link.setAttribute('href', url)
  }

  /** Cambia una URL blob del DOM de nuevo por el texto original que escribió el autor. */
  restoreValue(value: string): string {
    if (!value.includes('blob:')) return value
    let out = value
    for (const [url, ref] of this.urlToRef) {
      if (out.includes(url)) out = out.split(url).join(ref)
    }
    return out
  }

  /** Registra una URL blob creada por el editor (imagen subida, etc.) y su ruta final en el repo. */
  register(blobUrl: string, ref: string, path?: string) {
    this.urlToRef.set(blobUrl, ref)
    if (path) this.ready.set(`${path}\u0000${ref}`, blobUrl)
  }

  refFor(blobUrl: string): string | undefined {
    return this.urlToRef.get(blobUrl)
  }

  dispose() {
    for (const url of this.urlToRef.keys()) URL.revokeObjectURL(url)
    this.urlToRef.clear()
    this.cache.clear()
    this.ready.clear()
    this.cssLinks.clear()
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function iframePlaceholder(src: string, n: number): string {
  let host = src
  try {
    host = new URL(src, 'https://x.invalid').hostname.replace(/^www\./, '')
  } catch {
    /* se muestra la URL tal cual */
  }
  const label = host && host !== 'x.invalid' ? host : 'contenido incrustado'
  return (
    '<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;min-height:100vh;' +
    'font:14px system-ui,sans-serif;color:#6b6b80;background:repeating-linear-gradient(135deg,#f1f0f6,#f1f0f6 12px,#e8e7ef 12px,#e8e7ef 24px)">' +
    `<div style="text-align:center;padding:12px"><strong style="display:block;font-size:15px;color:#2b2a40">Contenido incrustado</strong>${escapeHtml(label)}<br>Se ve al publicar o en la vista previa</div>` +
    `<!-- lz${n} -->`
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
