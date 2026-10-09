import DiffMatchPatch from 'diff-match-patch'
import type { ResourceHub } from './resources'

export function parseHtml(src: string): Document {
  // El navegador mete dentro de <body> lo que sigue a </html> (casi siempre un salto de línea). Si no se quita, cada vez
  // que se guarda y se vuelve a leer el archivo, el cuerpo gana una línea en blanco más.
  return new DOMParser().parseFromString(src.replace(/\s+$/, ''), 'text/html')
}

export function doctypeOf(doc: Document): string {
  const d = doc.doctype
  if (!d) return ''
  let s = `<!DOCTYPE ${d.name}`
  if (d.publicId) s += ` PUBLIC "${d.publicId}"${d.systemId ? ` "${d.systemId}"` : ''}`
  else if (d.systemId) s += ` SYSTEM "${d.systemId}"`
  return s + '>'
}

/**
 * Limpia un árbol HTML antes de guardarlo: quita lo que agrega el editor (data-lz-*, contenteditable,
 * marcadores de iframes) y, si se pasa el hub, devuelve las rutas originales en lugar de URLs blob.
 */
export function cleanTree(root: Element, hub: ResourceHub | null): void {
  root.querySelectorAll('style[data-lz-editor]').forEach((n) => n.remove())
  const all = [root, ...Array.from(root.querySelectorAll('*'))]
  for (const el of all) {
    // texto en edición
    if (el.hasAttribute('data-lz-editing')) {
      if (el.hasAttribute('data-lz-ce-orig')) el.setAttribute('contenteditable', el.getAttribute('data-lz-ce-orig') || '')
      else el.removeAttribute('contenteditable')
    }
    // iframes y scripts cuyo src se reemplazó dentro del editor
    if (el.hasAttribute('data-lz-src') && (el.localName === 'iframe' || el.localName === 'script')) {
      el.setAttribute('src', el.getAttribute('data-lz-src') || '')
      if (el.localName === 'iframe') el.removeAttribute('srcdoc')
    }
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-lz-')) {
        el.removeAttribute(attr.name)
        continue
      }
      if (hub && attr.value.includes('blob:')) el.setAttribute(attr.name, hub.restoreValue(attr.value))
    }
    if (el.hasAttribute('style') && (el.getAttribute('style') || '').trim() === '') el.removeAttribute('style')
    if (el.hasAttribute('class') && (el.getAttribute('class') || '').trim() === '') el.removeAttribute('class')
    if (hub && el.localName === 'style' && el.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      const t = el.textContent || ''
      if (t.includes('blob:')) el.textContent = hub.restoreValue(t)
    }
  }
}

export function serializeTree(html: Element, doctype: string): string {
  return (doctype ? doctype + '\n' : '') + html.outerHTML + '\n'
}

/** Forma normalizada de un HTML: la que produce el navegador al leerlo y volver a escribirlo. */
export function normalizeHtml(src: string): string {
  const doc = parseHtml(src)
  const html = doc.documentElement
  cleanTree(html, null)
  return serializeTree(html, doctypeOf(doc))
}

/** Serializa el documento vivo del editor (iframe) a HTML listo para guardar en el repo. */
export function serializeLiveDocument(doc: Document, hub: ResourceHub, doctype: string): string {
  const clone = inertCopy(doc, doc.documentElement) as HTMLElement
  cleanTree(clone, hub)
  return serializeTree(clone, doctype)
}

/**
 * Copia un elemento a un documento "inerte" (sin ventana): ahí las imágenes no se descargan.
 * Importa porque, al devolver cada ruta a su texto original (img/foto.png), una copia dentro del
 * documento vivo haría que el navegador pidiera ese archivo a la dirección del editor.
 */
export function inertCopy(doc: Document, el: Element): Element {
  return doc.implementation.createHTMLDocument('').importNode(el, true)
}

/** Posición de inicio de cada línea (el salto de línea se queda con su línea). */
function lineStarts(text: string): number[] {
  const starts = [0]
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1)
  if (starts[starts.length - 1] === text.length) starts.pop()
  return starts
}

/** Lo que la normalización puede cambiar de una línea (comillas, mayúsculas, `/>`, espacios) no cuenta para reconocerla. */
const lineKey = (line: string) => line.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()

/** Cada línea se vuelve un solo carácter (el mismo para líneas parecidas), para comparar archivos largos sin esperar. */
function encodeLines(text: string, starts: number[], ids: Map<string, number>): string | null {
  const codes: number[] = []
  for (let i = 0; i < starts.length; i++) {
    const key = lineKey(text.slice(starts[i], starts[i + 1] ?? text.length))
    let id = ids.get(key)
    if (id === undefined) {
      id = ids.size + 1
      ids.set(key, id)
    }
    if (id > 0xd7ff) return null // demasiadas líneas distintas: se usa la comparación completa
    codes.push(id)
  }
  let out = ''
  for (let i = 0; i < codes.length; i += 4096) out += String.fromCharCode(...codes.slice(i, i + 4096))
  return out
}

/** Empareja carácter por carácter dos trozos de texto (`bOff` y `oOff` son sus posiciones en los textos completos). */
function alignChars(dmp: DiffMatchPatch, bText: string, oText: string, bOff: number, oOff: number, map: Int32Array) {
  if (bText === oText) {
    for (let k = 0; k < bText.length; k++) map[bOff + k] = oOff + k
    return
  }
  let b = 0
  let o = 0
  for (const [op, text] of dmp.diff_main(bText, oText)) {
    const n = text.length
    if (op === 0) {
      for (let k = 0; k < n; k++) map[bOff + b + k] = oOff + o + k
      b += n
      o += n
    } else if (op === -1) b += n
    else o += n
  }
}

/**
 * Posición que ocupa en el archivo original cada carácter del texto normalizado (-1 si ese carácter
 * no existe en el original, p. ej. la `/` de `<br />` o una etiqueta de cierre que faltaba).
 *
 * Primero se emparejan las líneas (rápido, aunque casi todas tengan comillas simples o `<br />`) y después,
 * dentro de cada pareja, los caracteres.
 */
function alignToOriginal(dmp: DiffMatchPatch, baseline: string, original: string): Int32Array {
  const map = new Int32Array(baseline.length + 1).fill(-1)
  const bs = lineStarts(baseline)
  const os = lineStarts(original)
  const ids = new Map<string, number>()
  const a = encodeLines(baseline, bs, ids)
  const b = a === null ? null : encodeLines(original, os, ids)
  if (a === null || b === null) {
    alignChars(dmp, baseline, original, 0, 0, map)
    return map
  }
  const bEnd = (i: number) => bs[i] ?? baseline.length
  const oEnd = (j: number) => os[j] ?? original.length

  let bi = 0 // línea actual del normalizado
  let oi = 0 // línea actual del original
  let delB = 0 // líneas del normalizado que no tienen pareja (todavía sin emparejar)
  let insO = 0 // líneas del original que no tienen pareja
  const flush = () => {
    if (delB && insO) alignChars(dmp, baseline.slice(bs[bi]!, bEnd(bi + delB)), original.slice(os[oi]!, oEnd(oi + insO)), bs[bi]!, os[oi]!, map)
    bi += delB
    oi += insO
    delB = 0
    insO = 0
  }
  for (const [op, text] of dmp.diff_main(a, b, false)) {
    if (op === -1) delB += text.length
    else if (op === 1) insO += text.length
    else {
      flush()
      for (let k = 0; k < text.length; k++, bi++, oi++) {
        alignChars(dmp, baseline.slice(bs[bi]!, bEnd(bi + 1)), original.slice(os[oi]!, oEnd(oi + 1)), bs[bi]!, os[oi]!, map)
      }
    }
  }
  flush()
  return map
}

/**
 * Traslada al archivo original las diferencias entre `baseline` (original normalizado) y `working`
 * (lo editado): cada cambio se ubica por su posición, sin búsquedas aproximadas de texto.
 */
function projectEdits(original: string, baseline: string, working: string): string | null {
  const dmp = new DiffMatchPatch()
  dmp.Diff_Timeout = 3
  const map = alignToOriginal(dmp, baseline, original)

  // posición (en el original) justo después del último carácter presente a la izquierda de cada punto
  const leftEnd = new Int32Array(baseline.length + 1)
  let last = 0
  for (let i = 0; i < baseline.length; i++) {
    leftEnd[i] = last
    if (map[i] >= 0) last = map[i] + 1
  }
  leftEnd[baseline.length] = last

  const edits = dmp.diff_main(baseline, working)
  dmp.diff_cleanupSemantic(edits)

  const out: string[] = []
  let cursor = 0 // hasta dónde del original ya se copió
  let b = 0 // posición en baseline
  let i = 0
  while (i < edits.length) {
    const [op, text] = edits[i]!
    if (op === 0) {
      b += text.length
      i++
      continue
    }
    // un bloque de cambios: texto quitado de baseline [b0, b1) y texto nuevo
    const b0 = b
    let added = ''
    while (i < edits.length && edits[i]![0] !== 0) {
      const [o2, t2] = edits[i]!
      if (o2 === -1) b += t2.length
      else added += t2
      i++
    }
    let s = -1
    let e = -1
    for (let k = b0; k < b; k++) {
      if (map[k]! >= 0) {
        s = map[k]!
        break
      }
    }
    if (s >= 0) {
      for (let k = b - 1; k >= b0; k--) {
        if (map[k]! >= 0) {
          e = map[k]! + 1
          break
        }
      }
    } else {
      s = e = leftEnd[b0]!
    }
    if (s < cursor || e < s) return null
    out.push(original.slice(cursor, s), added)
    cursor = e
  }
  out.push(original.slice(cursor))
  return out.join('')
}

/**
 * Aplica solo los cambios hechos en el editor sobre el archivo original, para que el commit muestre
 * únicamente lo que tocaste y no reformatee todo el archivo. Si no se puede garantizar que el
 * resultado sea idéntico a lo editado, devuelve el HTML completo ya normalizado.
 */
export function preserveFormat(
  original: string,
  baseline: string,
  working: string,
  normalize: (s: string) => string = normalizeHtml,
): string {
  if (working === baseline) return original
  const crlf = original.includes('\r\n')
  const base = crlf ? original.replace(/\r\n/g, '\n') : original
  try {
    const patched = projectEdits(base, baseline, working)
    if (patched !== null && normalize(patched) === working) {
      return crlf ? patched.replace(/\n/g, '\r\n') : patched
    }
  } catch {
    /* si algo falla se usa el HTML completo */
  }
  return working
}

/** CSS que solo existe dentro del lienzo del editor (se quita al guardar). */
export const EDITOR_CSS = `
html { scroll-behavior: auto !important; }
noscript { display: none !important; }
[data-aos], .aos-init, .wow, .reveal, .reveals, .revelar, .reveal-on-scroll, .scroll-reveal, .js-reveal,
.fade-in, .fade-up, .fade-down, .animate-on-scroll, .animate-in, .appear, .sr-hidden, .gsap-hide, .hidden-on-load {
  opacity: 1 !important; transform: none !important; visibility: visible !important;
}
[data-lz-editing] { outline: 2px dashed #ff2e88 !important; outline-offset: 2px; cursor: text !important; }
body { -webkit-user-select: none; user-select: none; }
[data-lz-editing], [data-lz-editing] * { -webkit-user-select: text !important; user-select: text !important; }
img, svg, video { -webkit-user-drag: none; }
`

export function injectEditorStyle(doc: Document): void {
  const style = doc.createElement('style')
  style.setAttribute('data-lz-editor', '')
  style.textContent = EDITOR_CSS
  // al principio de <head>: así nada queda "detrás" de los elementos reales y se quita sin dejar rastro
  const host = doc.head || doc.documentElement
  host.insertBefore(style, host.firstChild)
}
