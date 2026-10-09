import { doctypeOf, injectEditorStyle, parseHtml, serializeLiveDocument, serializeTree } from '../site/document'
import { rebaseHtmlFragment } from '../site/pages'
import { ResourceHub, type ResourceReader } from '../site/resources'
import { History } from './history'
import { Ops } from './ops'
import { ResponsiveStyles } from './responsive'
import {
  type El,
  friendlyName,
  hasElementChildren,
  isImageEl,
  isSkippable,
  isTextEditable,
  selectorLabel,
  textPreview,
  VOID_TAGS,
} from './dom-utils'

export type Device = 'desktop' | 'tablet' | 'mobile'
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 }

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface LayerNode {
  el: El
  depth: number
  name: string
  label: string
  text: string
  hasChildren: boolean
  hidden: boolean
}

export type Intent =
  | { type: 'replace-image'; el: HTMLImageElement }
  | { type: 'context-menu'; el: El; x: number; y: number }
  | { type: 'save' }
  | { type: 'drop-files'; files: File[]; el: El | null }
  | { type: 'open-content'; el: El }

export interface DropTarget {
  ref: El
  position: 'before' | 'after' | 'append'
  /** rectángulo del indicador en coordenadas del lienzo (ya con zoom) */
  indicator: Rect & { kind: 'line-h' | 'line-v' | 'box' }
}

export interface LoadOptions {
  path: string
  html: string
  reader: ResourceReader
  siteRoot: string
  /** si se pasa, se usa como punto de comparación para guardar (p. ej. al recargar desde el código) */
  baseline?: string
  dirty?: boolean
}

type Listener = () => void

export class EditorEngine {
  iframe: HTMLIFrameElement | null = null
  doc: Document | null = null
  win: (Window & typeof globalThis) | null = null
  hub: ResourceHub | null = null
  responsive: ResponsiveStyles | null = null
  history = new History()
  readonly ops = new Ops(this)

  pagePath = ''
  doctype = ''
  baseline = ''
  loaded = false
  loading = false

  selected: El | null = null
  hovered: El | null = null
  editing: HTMLElement | null = null
  private editStartHtml = ''
  device: Device = 'desktop'
  scale = 1
  dropIndicator: DropTarget['indicator'] | null = null
  /** Lo copiado con Ctrl+C: HTML con las rutas como se escriben en el archivo, y la página de donde viene */
  clipboardHtml = ''
  clipboardFrom = ''
  private siteRoot = ''
  interactive = true

  version = 0
  layoutVersion = 0
  private listeners = new Set<Listener>()
  private layoutListeners = new Set<Listener>()
  private intentListeners = new Set<(i: Intent) => void>()
  private ids = new WeakMap<Element, number>()
  private idSeq = 0
  private mo: MutationObserver | null = null
  private ro: ResizeObserver | null = null
  private layoutRaf = 0
  private mutateRaf = 0
  private savedRange: Range | null = null
  private cleanups: Array<() => void> = []

  // ── suscripciones ────────────────────────────────────────────────────────
  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  getVersion = () => this.version
  subscribeLayout = (fn: Listener) => {
    this.layoutListeners.add(fn)
    return () => void this.layoutListeners.delete(fn)
  }
  getLayoutVersion = () => this.layoutVersion
  onIntent(fn: (i: Intent) => void) {
    this.intentListeners.add(fn)
    return () => void this.intentListeners.delete(fn)
  }
  emitIntent(i: Intent) {
    this.intentListeners.forEach((fn) => fn(i))
  }

  emit() {
    this.version++
    this.listeners.forEach((fn) => fn())
    this.bumpLayout()
  }

  bumpLayout() {
    if (this.layoutRaf) return
    this.layoutRaf = requestAnimationFrame(() => {
      this.layoutRaf = 0
      this.layoutVersion++
      this.layoutListeners.forEach((fn) => fn())
    })
  }

  idOf(el: Element): number {
    let id = this.ids.get(el)
    if (!id) {
      id = ++this.idSeq
      this.ids.set(el, id)
    }
    return id
  }

  // ── ciclo de vida ────────────────────────────────────────────────────────
  attach(iframe: HTMLIFrameElement) {
    this.iframe = iframe
  }

  async loadPage(opts: LoadOptions): Promise<void> {
    if (!this.iframe) throw new Error('El lienzo todavía no está listo.')
    this.loading = true
    this.teardownPage()
    this.emit()

    const hub = new ResourceHub(opts.reader, opts.siteRoot)
    const parsed = parseHtml(opts.html)
    await hub.rewriteDocument(parsed, opts.path)
    injectEditorStyle(parsed)
    const display = serializeTree(parsed.documentElement, doctypeOf(parsed))

    await new Promise<void>((resolve) => {
      const iframe = this.iframe!
      const done = () => {
        iframe.removeEventListener('load', done)
        resolve()
      }
      iframe.addEventListener('load', done)
      // sin el salto de línea final: el navegador lo metería dentro de <body> y el archivo crecería una línea
      iframe.srcdoc = display.replace(/\n$/, '')
      setTimeout(done, 8000)
    })

    const iframe = this.iframe
    this.doc = iframe.contentDocument
    this.win = iframe.contentWindow as Window & typeof globalThis
    this.hub = hub
    this.pagePath = opts.path
    this.siteRoot = opts.siteRoot
    this.doctype = doctypeOf(parsed)
    this.responsive = new ResponsiveStyles(this.doc!)
    this.responsive.load()
    this.history.clear()
    this.selected = null
    this.hovered = null
    this.editing = null
    this.installListeners()
    this.baseline = opts.baseline ?? this.serialize()
    if (opts.dirty) this.history.markDirty()
    this.loaded = true
    this.loading = false
    this.emit()
  }

  private teardownPage() {
    this.cleanups.forEach((fn) => fn())
    this.cleanups = []
    this.mo?.disconnect()
    this.ro?.disconnect()
    this.mo = null
    this.ro = null
    this.hub?.dispose()
    this.hub = null
    this.loaded = false
    this.doc = null
    this.win = null
    this.selected = null
    this.hovered = null
    this.editing = null
  }

  dispose() {
    this.teardownPage()
    this.listeners.clear()
    this.layoutListeners.clear()
    this.intentListeners.clear()
  }

  // ── guardado ─────────────────────────────────────────────────────────────
  serialize(): string {
    if (!this.doc || !this.hub) return ''
    return serializeLiveDocument(this.doc, this.hub, this.doctype)
  }

  get dirty(): boolean {
    if (this.history.dirty) return true
    return !!this.editing && this.editing.innerHTML !== this.editStartHtml
  }

  markSaved(newBaseline?: string) {
    this.endTextEdit()
    this.history.markSaved()
    this.baseline = newBaseline ?? this.serialize()
    this.emit()
  }

  // ── geometría ────────────────────────────────────────────────────────────
  setViewport(width: number, height: number, scale: number) {
    this.scale = scale
    if (this.iframe) {
      this.iframe.style.width = width + 'px'
      this.iframe.style.height = height + 'px'
      this.iframe.style.transform = `scale(${scale})`
    }
    this.bumpLayout()
  }

  rectOf(el: Element): Rect | null {
    if (!this.doc || !el.isConnected) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    const s = this.scale
    return { left: r.left * s, top: r.top * s, width: r.width * s, height: r.height * s }
  }

  /** Posición del puntero (en la ventana principal) -> coordenadas dentro de la página. */
  pointToDoc(clientX: number, clientY: number): { x: number; y: number; inside: boolean } {
    const r = this.iframe!.getBoundingClientRect()
    const x = (clientX - r.left) / this.scale
    const y = (clientY - r.top) / this.scale
    return { x, y, inside: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom }
  }

  getComputed(el: Element): CSSStyleDeclaration | null {
    return this.win ? this.win.getComputedStyle(el) : null
  }

  get body(): HTMLElement | null {
    return this.doc?.body ?? null
  }

  // ── selección ────────────────────────────────────────────────────────────
  select(el: El | null) {
    if (this.editing && !(el && this.editing.contains(el))) this.endTextEdit()
    const next = el && this.doc && this.doc.documentElement !== el && this.doc.documentElement.contains(el) ? el : null
    if (next === this.selected) return
    this.selected = next
    this.emit()
  }

  selectParent() {
    const p = this.selected?.parentElement
    if (p && p !== this.doc?.documentElement) this.select(p)
  }

  setHover(el: El | null) {
    if (el === this.hovered) return
    this.hovered = el
    this.emit()
  }

  scrollTo(el: Element) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  /** Desplaza la página solo si el elemento no está a la vista. */
  revealIfNeeded(el: Element) {
    if (!this.win) return
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > this.win.innerHeight) this.scrollTo(el)
  }

  setDevice(d: Device) {
    if (d === this.device) return
    this.endTextEdit()
    this.device = d
    this.emit()
  }

  // ── edición de texto ─────────────────────────────────────────────────────
  startTextEdit(el: HTMLElement, ev?: MouseEvent) {
    if (!this.doc) return
    if (this.editing === el) return
    this.endTextEdit()
    this.selected = el
    this.editing = el
    this.editStartHtml = el.innerHTML
    if (el.hasAttribute('contenteditable')) el.setAttribute('data-lz-ce-orig', el.getAttribute('contenteditable') || '')
    el.setAttribute('contenteditable', 'true')
    el.setAttribute('data-lz-editing', '')
    el.focus()
    if (ev) {
      const d = this.doc as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      }
      let range: Range | null = null
      if (d.caretRangeFromPoint) range = d.caretRangeFromPoint(ev.clientX, ev.clientY)
      else if (d.caretPositionFromPoint) {
        const pos = d.caretPositionFromPoint(ev.clientX, ev.clientY)
        if (pos) {
          range = d.createRange()
          range.setStart(pos.offsetNode, pos.offset)
        }
      }
      if (range && el.contains(range.startContainer)) {
        const sel = this.win!.getSelection()
        sel?.removeAllRanges()
        range.collapse(true)
        sel?.addRange(range)
        // selecciona la palabra donde se hizo doble clic
        ;(sel as Selection & { modify?: (a: string, b: string, c: string) => void })?.modify?.('move', 'backward', 'word')
        ;(sel as Selection & { modify?: (a: string, b: string, c: string) => void })?.modify?.('extend', 'forward', 'word')
      }
    }
    this.emit()
  }

  endTextEdit() {
    const el = this.editing
    if (!el) return
    this.editing = null
    el.removeAttribute('data-lz-editing')
    if (el.hasAttribute('data-lz-ce-orig')) {
      el.setAttribute('contenteditable', el.getAttribute('data-lz-ce-orig') || '')
      el.removeAttribute('data-lz-ce-orig')
    } else {
      el.removeAttribute('contenteditable')
    }
    const before = this.editStartHtml
    this.keepEdgeSpace(el, before)
    const after = el.innerHTML
    if (before !== after) {
      this.history.push({
        label: 'Editar texto',
        undo: () => void (el.innerHTML = before),
        redo: () => void (el.innerHTML = after),
      })
    }
    this.savedRange = null
    this.emit()
  }

  /**
   * Si el texto estaba en líneas propias del código (con salto de línea y sangría antes o después) y al
   * editarlo ese espacio se perdió, lo devuelve: así la etiqueta siguiente no se pega a la misma línea.
   */
  private keepEdgeSpace(el: HTMLElement, before: string) {
    const now = el.innerHTML
    if (now === before || now.trim() === '') return
    if ((this.win?.getComputedStyle(el).whiteSpace ?? '').startsWith('pre')) return
    const lead = /^\s*/.exec(before)![0]
    const trail = /\s*$/.exec(before)![0]
    const doc = el.ownerDocument
    if (lead.includes('\n') && !/^\s/.test(now)) el.insertBefore(doc.createTextNode(lead), el.firstChild)
    if (trail.includes('\n') && !/\s$/.test(el.innerHTML)) el.appendChild(doc.createTextNode(trail))
  }

  /** Aplica un comando de formato al texto seleccionado (negrita, cursiva, color…). */
  exec(cmd: string, value?: string): boolean {
    if (!this.editing || !this.doc) return false
    this.restoreSelection()
    this.doc.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor' ? 'true' : 'false')
    const ok = this.doc.execCommand(cmd, false, value)
    this.emit()
    return ok
  }

  queryState(cmd: string): boolean {
    try {
      return !!this.doc?.queryCommandState(cmd)
    } catch {
      return false
    }
  }

  saveSelection() {
    const sel = this.win?.getSelection()
    if (sel && sel.rangeCount) this.savedRange = sel.getRangeAt(0).cloneRange()
  }

  restoreSelection() {
    if (!this.savedRange || !this.win) return
    const sel = this.win.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(this.savedRange)
  }

  // ── deshacer / rehacer ───────────────────────────────────────────────────
  undo() {
    if (this.editing) this.endTextEdit()
    if (this.history.undo()) this.afterHistory()
  }

  redo() {
    if (this.editing) this.endTextEdit()
    if (this.history.redo()) this.afterHistory()
  }

  private afterHistory() {
    if (this.selected && !this.selected.isConnected) this.selected = null
    this.emit()
  }

  // ── árbol de capas ───────────────────────────────────────────────────────
  layerTree(): LayerNode[] {
    const out: LayerNode[] = []
    const body = this.body
    if (!body || !this.win) return out
    const walk = (el: El, depth: number) => {
      const cs = this.win!.getComputedStyle(el)
      out.push({
        el,
        depth,
        name: friendlyName(el),
        label: selectorLabel(el),
        text: textPreview(el, 30),
        hasChildren: Array.from(el.children).some((c) => !isSkippable(c) && c.tagName !== 'BR'),
        hidden: cs.display === 'none',
      })
      for (const child of Array.from(el.children)) {
        if (isSkippable(child) || child.tagName === 'BR' || child.tagName === 'WBR') continue
        if (child.namespaceURI === 'http://www.w3.org/2000/svg' && child.localName !== 'svg') continue
        walk(child as El, depth + 1)
      }
    }
    walk(body, 0)
    return out
  }

  // ── destinos de arrastre ─────────────────────────────────────────────────
  private isRowFlow(el: Element): boolean {
    const parent = el.parentElement
    if (!parent) return false
    const r = el.getBoundingClientRect()
    for (const sib of Array.from(parent.children)) {
      if (sib === el || isSkippable(sib)) continue
      const s = sib.getBoundingClientRect()
      if (s.width === 0 && s.height === 0) continue
      const overlap = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top)
      if (overlap > Math.min(r.height, s.height) * 0.5 && Math.abs(r.left - s.left) > 4) return true
    }
    return false
  }

  computeDrop(clientX: number, clientY: number, dragged: El | null): DropTarget | null {
    if (!this.doc || !this.win) return null
    const { x, y, inside } = this.pointToDoc(clientX, clientY)
    if (!inside) return null
    let t = this.doc.elementFromPoint(x, y) as El | null
    if (!t) return null
    const svg = t.closest('svg')
    if (svg && t.localName !== 'svg') t = svg as unknown as El
    if (t === this.doc.documentElement || t.tagName === 'HEAD') t = this.doc.body
    if (dragged && (t === dragged || dragged.contains(t))) return null
    const s = this.scale
    const toRect = (r: DOMRect | { left: number; top: number; width: number; height: number }): Rect => ({
      left: r.left * s,
      top: r.top * s,
      width: r.width * s,
      height: r.height * s,
    })

    const kids = Array.from(t.children).filter((c) => !isSkippable(c) && c !== dragged && c.tagName !== 'BR') as El[]
    const container =
      !VOID_TAGS.has(t.tagName) &&
      !['VIDEO', 'AUDIO', 'CANVAS', 'IFRAME', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(t.tagName) &&
      t.namespaceURI !== 'http://www.w3.org/2000/svg' &&
      !(isTextEditable(t) && kids.length === 0 && (t.textContent || '').trim() !== '') &&
      !(isTextEditable(t) && kids.every((k) => !isImageEl(k) && k.children.length === 0))

    if (container) {
      if (kids.length === 0) {
        const r = t.getBoundingClientRect()
        return { ref: t, position: 'append', indicator: { ...toRect(r), kind: 'box' } }
      }
      // buscar el hijo más cercano al puntero
      const row = this.isRowFlow(kids[0])
      for (const k of kids) {
        const r = k.getBoundingClientRect()
        const mid = row ? r.left + r.width / 2 : r.top + r.height / 2
        if ((row ? x : y) < mid) {
          return { ref: k, position: 'before', indicator: lineFor(toRect(r), 'before', row) }
        }
      }
      const last = kids[kids.length - 1]
      return { ref: last, position: 'after', indicator: lineFor(toRect(last.getBoundingClientRect()), 'after', row) }
    }
    const r = t.getBoundingClientRect()
    const row = this.isRowFlow(t)
    const before = row ? x < r.left + r.width / 2 : y < r.top + r.height / 2
    const pos = before ? 'before' : 'after'
    return { ref: t, position: pos, indicator: lineFor(toRect(r), pos, row) }
  }

  // ── eventos dentro del lienzo ────────────────────────────────────────────
  private targetOf(e: Event): El | null {
    let t = e.target as Element | null
    if (!t || t.nodeType !== Node.ELEMENT_NODE) t = (e.target as Node | null)?.parentElement ?? null
    if (!t) return null
    const svg = t.closest('svg')
    if (svg && t.localName !== 'svg') t = svg
    if (t === this.doc?.documentElement) t = this.doc!.body
    return t as El
  }

  private installListeners() {
    const doc = this.doc!
    const win = this.win!
    const on = <K extends keyof DocumentEventMap>(type: K, fn: (e: DocumentEventMap[K]) => void, capture = true) => {
      doc.addEventListener(type, fn as EventListener, capture)
      this.cleanups.push(() => doc.removeEventListener(type, fn as EventListener, capture))
    }

    on('mouseover', (e) => {
      if (!this.interactive || this.editing) return
      this.setHover(this.targetOf(e))
    })
    on('mouseleave', () => this.setHover(null), false)
    on('mousedown', (e) => {
      if (!this.interactive) return
      const t = this.targetOf(e)
      if (this.editing && t && this.editing.contains(t)) return
      // evita selección de texto nativa, foco en campos y arrastre de imágenes
      e.preventDefault()
    })
    on('click', (e) => {
      if (!this.interactive) return
      const t = this.targetOf(e)
      if (this.editing && t && this.editing.contains(t)) return
      e.preventDefault()
      e.stopPropagation()
      if (t) this.select(t)
    })
    on('dblclick', (e) => {
      if (!this.interactive) return
      const t = this.targetOf(e)
      if (!t) return
      e.preventDefault()
      if (t instanceof win.HTMLElement && t.tagName === 'IMG') {
        this.select(t)
        this.emitIntent({ type: 'replace-image', el: t as HTMLImageElement })
      } else if (t instanceof win.HTMLElement && isTextEditable(t)) {
        this.startTextEdit(t, e)
      } else if (t) {
        this.select(t)
        this.emitIntent({ type: 'open-content', el: t })
      }
    })
    on('contextmenu', (e) => {
      if (!this.interactive) return
      e.preventDefault()
      const t = this.targetOf(e)
      if (!t) return
      this.select(t)
      const r = this.iframe!.getBoundingClientRect()
      this.emitIntent({ type: 'context-menu', el: t, x: r.left + e.clientX * this.scale, y: r.top + e.clientY * this.scale })
    })
    on('dragstart', (e) => e.preventDefault())
    on('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    })
    on('drop', (e) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) this.emitIntent({ type: 'drop-files', files, el: this.targetOf(e) })
    })
    on('keydown', (e) => {
      if (this.handleKey(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    })
    on('paste', (e) => {
      if (!this.editing) return
      // pega solo texto para no traer estilos de otros sitios
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain') ?? ''
      doc.execCommand('insertText', false, text)
    })
    on('input', () => {
      if (this.editing) this.bumpLayout()
    })
    const onScroll = () => this.bumpLayout()
    win.addEventListener('scroll', onScroll, { passive: true })
    this.cleanups.push(() => win.removeEventListener('scroll', onScroll))

    this.mo = new MutationObserver(() => {
      if (this.mutateRaf) return
      this.mutateRaf = requestAnimationFrame(() => {
        this.mutateRaf = 0
        this.version++
        this.listeners.forEach((fn) => fn())
        this.bumpLayout()
      })
    })
    this.mo.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
    this.ro = new ResizeObserver(() => this.bumpLayout())
    this.ro.observe(doc.documentElement)
    if (doc.body) this.ro.observe(doc.body)
    doc.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', () => this.bumpLayout(), { once: true })
    })
  }

  /** Guarda un elemento para pegarlo después, en esta página o en otra. */
  copy(el: El) {
    this.clipboardHtml = this.ops.cleanHtmlOf(el)
    this.clipboardFrom = this.pagePath
  }

  /** Pega lo copiado junto a un elemento (o dentro, si es la página completa). Ajusta las rutas si viene de otra carpeta. */
  paste(ref: El): El[] {
    if (!this.clipboardHtml) return []
    const html =
      this.clipboardFrom && this.clipboardFrom !== this.pagePath
        ? rebaseHtmlFragment(this.clipboardHtml, this.clipboardFrom, this.pagePath, this.siteRoot)
        : this.clipboardHtml
    return this.ops.insert(html, ref, ref === this.doc?.body ? 'append' : 'after', { select: true, label: 'Pegar' })
  }

  /** Atajos de teclado. Devuelve true si el evento se consumió. */
  handleKey(e: KeyboardEvent): boolean {
    const mod = e.ctrlKey || e.metaKey
    const key = e.key
    if (mod && key.toLowerCase() === 's') {
      this.emitIntent({ type: 'save' })
      return true
    }
    if (this.editing) {
      if (key === 'Escape') {
        this.endTextEdit()
        return true
      }
      if (key === 'Enter' && !mod) {
        this.doc!.execCommand('insertLineBreak')
        return true
      }
      return false
    }
    if (!this.interactive) return false
    const sel = this.selected
    if (mod && key.toLowerCase() === 'z') {
      if (e.shiftKey) this.redo()
      else this.undo()
      return true
    }
    if (mod && key.toLowerCase() === 'y') {
      this.redo()
      return true
    }
    if (!sel) return false
    const isBody = sel === this.doc?.body
    if ((key === 'Delete' || key === 'Backspace') && !isBody) {
      this.ops.remove(sel)
      return true
    }
    if (mod && key.toLowerCase() === 'd' && !isBody) {
      this.ops.duplicate(sel)
      return true
    }
    if (mod && key.toLowerCase() === 'c' && !isBody) {
      this.copy(sel)
      return true
    }
    if (mod && key.toLowerCase() === 'x' && !isBody) {
      this.copy(sel)
      this.ops.remove(sel)
      return true
    }
    if (mod && key.toLowerCase() === 'v' && this.clipboardHtml) {
      this.paste(sel)
      return true
    }
    if (key === 'Escape') {
      this.select(null)
      return true
    }
    if (key === 'Enter' && sel instanceof (this.win as Window & typeof globalThis).HTMLElement && isTextEditable(sel)) {
      this.startTextEdit(sel)
      return true
    }
    if (e.altKey && (key === 'ArrowUp' || key === 'ArrowDown') && !isBody) {
      this.ops.nudge(sel, key === 'ArrowUp' ? -1 : 1)
      return true
    }
    return false
  }
}

function lineFor(r: Rect, pos: 'before' | 'after', row: boolean): Rect & { kind: 'line-h' | 'line-v' } {
  if (row) {
    return { left: (pos === 'before' ? r.left : r.left + r.width) - 2, top: r.top, width: 4, height: r.height, kind: 'line-v' }
  }
  return { left: r.left, top: (pos === 'before' ? r.top : r.top + r.height) - 2, width: r.width, height: 4, kind: 'line-h' }
}

export { hasElementChildren }
