export type El = HTMLElement | SVGElement

export const VOID_TAGS = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR'])

const INLINE_TAGS = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA', 'DEL', 'DFN', 'EM', 'FONT', 'I', 'INS', 'KBD', 'MARK',
  'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR', 'LABEL',
])

const TEXT_TAGS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'A', 'SPAN', 'LABEL', 'TD', 'TH', 'FIGCAPTION', 'BLOCKQUOTE', 'DT', 'DD',
  'SUMMARY', 'LEGEND', 'STRONG', 'EM', 'B', 'I', 'U', 'SMALL', 'CITE', 'Q', 'CODE', 'PRE', 'ADDRESS', 'TIME', 'MARK', 'S',
  'DIV', 'CAPTION',
])

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'BASE', 'TITLE', 'HEAD'])

export const isSkippable = (el: Element) => SKIP_TAGS.has(el.tagName)

/** ¿Se puede editar su texto directamente en el lienzo? */
export function isTextEditable(el: Element): boolean {
  if (!TEXT_TAGS.has(el.tagName)) return false
  let hasText = false
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if ((child.textContent || '').trim()) hasText = true
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const c = child as Element
      if (c.tagName === 'SVG' || c.namespaceURI === 'http://www.w3.org/2000/svg') {
        // iconos en línea: se permiten si hay texto alrededor
        continue
      }
      if (!INLINE_TAGS.has(c.tagName)) return false
      if (c.tagName !== 'BR' && !(c.textContent || '').trim()) continue
      hasText = true
    }
  }
  return hasText || el.childNodes.length === 0
}

export function hasElementChildren(el: Element): boolean {
  return Array.from(el.children).some((c) => !isSkippable(c))
}

export function isImageEl(el: Element): el is HTMLImageElement {
  return el.tagName === 'IMG'
}

export function isLinkEl(el: Element): el is HTMLAnchorElement {
  return el.tagName === 'A'
}

export function isButtonLike(el: Element): boolean {
  if (el.tagName === 'BUTTON') return true
  if (el.tagName === 'INPUT') return ['button', 'submit', 'reset'].includes((el as HTMLInputElement).type)
  if (el.tagName === 'A') {
    const cls = (el.getAttribute('class') || '').toLowerCase()
    return /\b(btn|button|boton|cta)\b|btn-|boton-|button-/.test(cls) || el.getAttribute('role') === 'button'
  }
  return false
}

const NAMES: Record<string, string> = {
  H1: 'Título',
  H2: 'Título',
  H3: 'Título',
  H4: 'Título',
  H5: 'Título',
  H6: 'Título',
  P: 'Párrafo',
  A: 'Enlace',
  BUTTON: 'Botón',
  IMG: 'Imagen',
  SVG: 'Gráfico',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  IFRAME: 'Incrustado',
  UL: 'Lista',
  OL: 'Lista numerada',
  LI: 'Elemento de lista',
  SECTION: 'Sección',
  HEADER: 'Encabezado',
  FOOTER: 'Pie de página',
  NAV: 'Menú',
  MAIN: 'Contenido principal',
  ARTICLE: 'Artículo',
  ASIDE: 'Barra lateral',
  FORM: 'Formulario',
  INPUT: 'Campo',
  TEXTAREA: 'Campo de texto',
  SELECT: 'Selector',
  LABEL: 'Etiqueta',
  SPAN: 'Texto',
  DIV: 'Contenedor',
  BODY: 'Página',
  FIGURE: 'Figura',
  FIGCAPTION: 'Pie de figura',
  BLOCKQUOTE: 'Cita',
  HR: 'Separador',
  TABLE: 'Tabla',
  DETAILS: 'Desplegable',
  SUMMARY: 'Título del desplegable',
  STRONG: 'Texto en negrita',
  EM: 'Texto en cursiva',
  B: 'Texto en negrita',
  I: 'Texto en cursiva',
  BR: 'Salto de línea',
  PICTURE: 'Imagen',
  CANVAS: 'Lienzo',
  CITE: 'Cita de autor',
  SMALL: 'Texto pequeño',
}

export function friendlyName(el: Element): string {
  if (el.tagName === 'A' && isButtonLike(el)) return 'Botón'
  return NAMES[el.tagName.toUpperCase()] ?? el.localName
}

/** "div.portada-texto", "h1", "section#pan" */
export function selectorLabel(el: Element): string {
  const tag = el.localName
  const id = el.id ? `#${el.id}` : ''
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith('lz-'))
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join('')
  return `${tag}${id}${classes}`
}

export function textPreview(el: Element, max = 28): string {
  const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

export function randomId(len = 5): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function isInside(ancestor: Node, node: Node | null): boolean {
  return !!node && (ancestor === node || ancestor.contains(node))
}

/** Padres desde el elemento hasta <body> (inclusive), del más cercano al más lejano. */
export function ancestorsOf(el: Element, stopAt: Element): Element[] {
  const out: Element[] = []
  let cur: Element | null = el
  while (cur && cur !== stopAt.parentElement) {
    out.push(cur)
    if (cur === stopAt) break
    cur = cur.parentElement
  }
  return out
}

export function parseFragment(doc: Document, html: string): Node[] {
  const tpl = doc.createElement('template')
  tpl.innerHTML = html.trim()
  return Array.from(tpl.content.childNodes)
}

export function uniqueDomId(doc: Document, base: string): string {
  if (!doc.getElementById(base)) return base
  for (let i = 2; i < 500; i++) if (!doc.getElementById(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${randomId()}`
}

// ── orden del código fuente ──────────────────────────────────────────────────
// Al insertar o mover elementos se copia la sangría de sus vecinos, para que el archivo
// publicado se lea igual que el resto y el commit en GitHub sea limpio.

/** Salto de línea + espacios que anteceden a un nodo (su sangría), si empieza una línea. */
export function indentOf(node: Node | null | undefined): string | null {
  const prev = node?.previousSibling
  if (prev && prev.nodeType === Node.TEXT_NODE) {
    const m = /\n[ \t]*$/.exec(prev.nodeValue ?? '')
    if (m) return m[0]
  }
  return null
}

const isBlank = (n: Node | null | undefined): n is Text => !!n && n.nodeType === Node.TEXT_NODE && /^[ \t\r\n]*$/.test(n.nodeValue ?? '')

/** Espacios que anteceden a un elemento y que se pueden llevar junto con él (solo si es un bloque). */
export function leadingBlank(el: Element): Text | null {
  const prev = el.previousSibling
  return isBlank(prev) && /\n/.test(prev.nodeValue ?? '') ? prev : null
}

export interface InsertPlan {
  parent: Node
  next: Node | null
  /** nodos a insertar, en orden (incluye los espacios de sangría) */
  list: Node[]
}

/** Dónde y con qué espacios se coloca `nodes` respecto de `ref`. `tidy` = false deja los nodos sin espacios extra. */
export function planInsert(doc: Document, ref: Element, position: 'before' | 'after' | 'prepend' | 'append', nodes: Node[], tidy = true): InsertPlan {
  const text = (s: string) => doc.createTextNode(s)
  if (position === 'before' || position === 'after') {
    const parent = ref.parentNode!
    const ind = tidy ? indentOf(ref) : null
    if (position === 'before') return { parent, next: ref, list: ind ? [...nodes, text(ind)] : nodes }
    return { parent, next: ref.nextSibling, list: ind ? [text(ind), ...nodes] : nodes }
  }
  if (position === 'prepend') {
    const first = ref.firstChild
    if (tidy && isBlank(first) && /\n/.test(first.nodeValue ?? '')) {
      return { parent: ref, next: first.nextSibling, list: [...nodes, text(first.nodeValue ?? '')] }
    }
    return { parent: ref, next: first, list: nodes }
  }
  const tail = ref.lastChild
  if (tidy && isBlank(tail) && /\n/.test(tail.nodeValue ?? '')) {
    const lastEl = ref.lastElementChild
    const own = indentOf(ref)
    const ind = (lastEl && indentOf(lastEl)) || (own ? own + '  ' : null)
    if (ind) return { parent: ref, next: tail, list: [text(ind), ...nodes] }
  }
  return { parent: ref, next: null, list: nodes }
}

export function applyPlan(plan: InsertPlan): void {
  for (const n of plan.list) plan.parent.insertBefore(n, plan.next)
}

/** Agrega un nodo al final de <head> con la misma sangría que sus vecinos. Devuelve todo lo que insertó. */
export function appendToHead(doc: Document, node: Node): Node[] {
  const head = doc.head
  const tail = head.lastChild
  const lastEl = head.lastElementChild
  const ind = lastEl ? indentOf(lastEl) : null
  if (isBlank(tail) && ind) {
    const ws = doc.createTextNode(ind)
    head.insertBefore(ws, tail)
    head.insertBefore(node, tail)
    return [ws, node]
  }
  head.appendChild(node)
  return [node]
}

// ── código ordenado en bloques nuevos ────────────────────────────────────────
const FLOW_CONTAINERS = new Set([
  'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'MAIN', 'NAV', 'UL', 'OL', 'DL', 'FIGURE', 'FORM', 'FIELDSET',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'DETAILS',
])
const INLINE_LEVEL = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'BUTTON', 'CITE', 'CODE', 'DATA', 'DEL', 'DFN', 'EM', 'FONT', 'I', 'IFRAME', 'IMG', 'INPUT',
  'INS', 'KBD', 'LABEL', 'MARK', 'PICTURE', 'Q', 'S', 'SAMP', 'SELECT', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'SVG', 'TEXTAREA',
  'TIME', 'U', 'VAR', 'VIDEO', 'AUDIO', 'CANVAS', 'WBR',
])

/**
 * Reparte en líneas con sangría el HTML de un bloque nuevo (solo donde los espacios no cambian cómo se ve):
 * contenedores cuyos hijos son todos bloques. Los párrafos, títulos y texto con formato se dejan en una línea.
 */
export function prettify(el: Element, indent: string, unit = '  '): void {
  const kids = Array.from(el.childNodes)
  const elems = kids.filter((k): k is Element => k.nodeType === Node.ELEMENT_NODE)
  if (!elems.length) return
  if (kids.some((k) => k.nodeType === Node.TEXT_NODE && (k.nodeValue ?? '').trim())) return
  const doc = el.ownerDocument
  const inner = indent + unit
  // los hijos se ordenan primero (de adentro hacia afuera no importa el orden: cada nivel mira solo a sus hijos)
  if (FLOW_CONTAINERS.has(el.tagName) && !elems.some((c) => INLINE_LEVEL.has(c.tagName.toUpperCase()))) {
    for (const k of kids) if (k.nodeType === Node.TEXT_NODE) el.removeChild(k)
    for (const c of elems) el.insertBefore(doc.createTextNode(inner), c)
    el.appendChild(doc.createTextNode(indent))
    for (const c of elems) prettify(c, inner, unit)
  } else {
    for (const c of elems) prettify(c, indent, unit)
  }
}
