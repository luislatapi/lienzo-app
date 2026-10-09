import { cleanTree, inertCopy } from '../site/document'
import type { Command } from './history'
import type { EditorEngine } from './engine'
import { type El, appendToHead, applyPlan, isSkippable, leadingBlank, parseFragment, planInsert, prettify, randomId, uniqueDomId } from './dom-utils'
import { type MediaKey } from './responsive'

export type Position = 'before' | 'after' | 'prepend' | 'append'

export interface InsertOptions {
  select?: boolean
  label?: string
  /** CSS propio del bloque; se agrega una sola vez a <style id="lienzo-blocks"> */
  css?: Array<{ id: string; css: string }>
  /** Reparte el HTML nuevo en líneas con sangría (solo para plantillas propias, donde los espacios no importan) */
  pretty?: boolean
}

const INLINE = new Set(['A', 'SPAN', 'B', 'I', 'U', 'EM', 'STRONG', 'SMALL', 'CODE', 'MARK', 'SUB', 'SUP', 'LABEL', 'FONT', 'Q', 'CITE', 'ABBR', 'TIME'])
const BLOCKS_STYLE_ID = 'lienzo-blocks'

/** Todas las modificaciones del documento pasan por aquí para quedar registradas en el historial. */
export class Ops {
  constructor(private e: EditorEngine) {}

  private get doc(): Document {
    return this.e.doc!
  }

  private push(cmd: Command) {
    this.e.history.push(cmd)
    this.e.emit()
  }

  // ── atributos y texto ────────────────────────────────────────────────────
  setAttr(el: El, name: string, value: string | null, label = 'Cambiar propiedad') {
    this.setAttrs(el, { [name]: value }, label)
  }

  setAttrs(el: El, attrs: Record<string, string | null>, label = 'Cambiar propiedades') {
    this.e.endTextEdit()
    const prev: Record<string, string | null> = {}
    let changed = false
    for (const [k, v] of Object.entries(attrs)) {
      prev[k] = el.hasAttribute(k) ? el.getAttribute(k) : null
      if (prev[k] !== v) changed = true
    }
    if (!changed) return
    const apply = (set: Record<string, string | null>) => {
      for (const [k, v] of Object.entries(set)) {
        if (v === null) el.removeAttribute(k)
        else el.setAttribute(k, v)
      }
    }
    apply(attrs)
    this.push({
      label,
      key: `attr:${this.e.idOf(el)}:${Object.keys(attrs).join(',')}`,
      undo: () => apply(prev),
      redo: () => apply(attrs),
    })
  }

  setInnerHtml(el: El, html: string, label = 'Editar contenido') {
    this.e.endTextEdit()
    const before = el.innerHTML
    if (before === html) return
    el.innerHTML = html
    this.push({
      label,
      key: `html:${this.e.idOf(el)}`,
      undo: () => void (el.innerHTML = before),
      redo: () => void (el.innerHTML = html),
    })
  }

  setText(el: El, text: string) {
    this.e.endTextEdit()
    const before = el.innerHTML
    // conserva saltos de línea como <br>
    const frag = this.doc.createDocumentFragment()
    text.split('\n').forEach((line, i) => {
      if (i) frag.appendChild(this.doc.createElement('br'))
      frag.appendChild(this.doc.createTextNode(line))
    })
    el.replaceChildren(frag)
    const after = el.innerHTML
    if (before === after) return
    this.push({
      label: 'Editar texto',
      key: `text:${this.e.idOf(el)}`,
      undo: () => void (el.innerHTML = before),
      redo: () => void (el.innerHTML = after),
    })
  }

  /** Ejecuta un cambio propio (por ejemplo, editar un archivo CSS) y lo deja en el historial. */
  custom(label: string, redo: () => void, undo: () => void, key?: string) {
    this.e.endTextEdit()
    redo()
    this.push({ label, key, undo, redo })
  }

  /** Cambia el contenido de una etiqueta <style> de la página. */
  setStyleText(el: Element, css: string, label = 'Cambiar estilos del sitio') {
    const before = el.textContent ?? ''
    if (before === css) return
    this.custom(
      label,
      () => void (el.textContent = css),
      () => void (el.textContent = before),
      `csstext:${this.e.idOf(el)}`,
    )
  }

  /** Agrega (o actualiza) una etiqueta <link> de <head> identificada por un selector. */
  ensureLink(selector: string, attrs: Record<string, string>) {
    this.headNode(selector, 'link', attrs)
  }

  setClasses(el: El, classes: string[]) {
    const keep = Array.from(el.classList).filter((c) => /^lz-[a-z0-9]{5}$/.test(c))
    const next = [...classes.filter((c) => !/^lz-[a-z0-9]{5}$/.test(c)), ...keep].join(' ')
    this.setAttr(el, 'class', next || null, 'Cambiar clases')
  }

  // ── estilos ──────────────────────────────────────────────────────────────
  /** Lee el valor puesto directamente en el elemento para el dispositivo actual ('' = sin valor propio). */
  getOwnStyle(el: El, prop: string): string {
    if (this.e.device === 'desktop') return el.style.getPropertyValue(prop)
    const key: MediaKey = this.e.device
    return this.e.responsive?.get(el, key)[prop] ?? ''
  }

  hasOwnStyle(el: El, prop: string): boolean {
    return this.getOwnStyle(el, prop) !== ''
  }

  setStyle(el: El, props: Record<string, string>) {
    this.e.endTextEdit()
    if (this.e.device === 'desktop') {
      const prev = el.getAttribute('style')
      for (const [k, v] of Object.entries(props)) {
        if (v === '' || v == null) el.style.removeProperty(k)
        else el.style.setProperty(k, v)
      }
      const next = el.getAttribute('style')
      if (prev === next) return
      const restore = (v: string | null) => {
        if (v === null || v.trim() === '') el.removeAttribute('style')
        else el.setAttribute('style', v)
      }
      if (next !== null && next.trim() === '') el.removeAttribute('style')
      this.push({
        label: 'Cambiar estilo',
        key: `style:${this.e.idOf(el)}:${Object.keys(props).join(',')}`,
        undo: () => restore(prev),
        redo: () => restore(next),
      })
      return
    }
    const rs = this.e.responsive
    if (!rs) return
    const key: MediaKey = this.e.device
    const beforeRules = rs.snapshot()
    const beforeClass = el.getAttribute('class')
    rs.set(el, key, props)
    const afterRules = rs.snapshot()
    const afterClass = el.getAttribute('class')
    if (beforeRules === afterRules && beforeClass === afterClass) return
    const setClass = (c: string | null) => (c === null || c === '' ? el.removeAttribute('class') : el.setAttribute('class', c))
    this.push({
      label: `Cambiar estilo (${key === 'tablet' ? 'tablet' : 'móvil'})`,
      key: `rstyle:${this.e.idOf(el)}:${key}:${Object.keys(props).join(',')}`,
      undo: () => {
        rs.restore(beforeRules)
        setClass(beforeClass)
      },
      redo: () => {
        rs.restore(afterRules)
        setClass(afterClass)
      },
    })
  }

  /** Quita todos los estilos propios del elemento en el dispositivo actual. */
  clearStyles(el: El) {
    if (this.e.device === 'desktop') {
      const props: Record<string, string> = {}
      for (let i = 0; i < el.style.length; i++) props[el.style.item(i)] = ''
      this.setStyle(el, props)
    } else {
      const cur = this.e.responsive?.get(el, this.e.device) ?? {}
      this.setStyle(el, Object.fromEntries(Object.keys(cur).map((k) => [k, ''])))
    }
  }

  /** Muestra u oculta el elemento en un tipo de pantalla concreto. */
  setHiddenOn(el: El, which: 'desktop' | 'tablet' | 'mobile', hidden: boolean) {
    const rs = this.e.responsive
    if (!rs) return
    const key: MediaKey = which === 'desktop' ? 'only-desktop' : which === 'tablet' ? 'only-tablet' : 'only-mobile'
    const beforeRules = rs.snapshot()
    const beforeClass = el.getAttribute('class')
    rs.set(el, key, { display: hidden ? 'none' : '' })
    const afterRules = rs.snapshot()
    const afterClass = el.getAttribute('class')
    if (beforeRules === afterRules) return
    const setClass = (c: string | null) => (c === null || c === '' ? el.removeAttribute('class') : el.setAttribute('class', c))
    this.push({
      label: hidden ? 'Ocultar elemento' : 'Mostrar elemento',
      undo: () => {
        rs.restore(beforeRules)
        setClass(beforeClass)
      },
      redo: () => {
        rs.restore(afterRules)
        setClass(afterClass)
      },
    })
  }

  isHiddenOn(el: El, which: 'desktop' | 'tablet' | 'mobile'): boolean {
    const key: MediaKey = which === 'desktop' ? 'only-desktop' : which === 'tablet' ? 'only-tablet' : 'only-mobile'
    return this.e.responsive?.get(el, key).display === 'none'
  }

  // ── estructura ───────────────────────────────────────────────────────────
  private blockRef(ref: El, position: Position): El {
    if (position === 'prepend' || position === 'append') return ref
    let cur: El = ref
    while (INLINE.has(cur.tagName) && cur.parentElement && cur.parentElement !== this.doc.body) cur = cur.parentElement as El
    return cur
  }

  /** Agrega fragmentos de CSS de bloques (una sola vez cada uno). Devuelve cómo deshacer y rehacer. */
  private ensureBlockCss(chunks: Array<{ id: string; css: string }>): { undo: () => void; redo: () => void } | null {
    let style = this.doc.getElementById(BLOCKS_STYLE_ID) as HTMLStyleElement | null
    const prevText = style?.textContent ?? null
    const created = !style
    const missing = chunks.filter((c) => !(prevText ?? '').includes(`/* bloque:${c.id} */`))
    if (!missing.length) return null
    let added: Node[] = []
    if (!style) {
      style = this.doc.createElement('style')
      style.id = BLOCKS_STYLE_ID
      added = appendToHead(this.doc, style)
    }
    const add = missing.map((c) => `/* bloque:${c.id} */\n${c.css.trim()}\n`).join('')
    const nextText = (prevText ? prevText.replace(/\n*$/, '\n') : '') + add
    style.textContent = nextText
    const el = style
    const parent = el.parentNode!
    const next = added.length ? added[added.length - 1]!.nextSibling : null
    return {
      undo: () => {
        if (created) added.forEach((n) => n.parentNode?.removeChild(n))
        else el.textContent = prevText
      },
      redo: () => {
        if (created) added.forEach((n) => parent.insertBefore(n, next))
        el.textContent = nextText
      },
    }
  }

  insert(html: string | Node[], ref: El, position: Position, opts: InsertOptions = {}): El[] {
    this.e.endTextEdit()
    const useRef = this.blockRef(ref, position)
    const nodes = typeof html === 'string' ? parseFragment(this.doc, html) : html
    const els = nodes.filter((n): n is El => n.nodeType === Node.ELEMENT_NODE)
    if (!els.length) return []
    // HTML escrito con rutas del repo (pegado, de un bloque…): se cambian por URLs que el lienzo sí puede mostrar
    if (typeof html === 'string') void this.e.hub?.adoptNodes(nodes, this.e.pagePath)
    // los ids repetidos se renombran
    for (const root of els) {
      for (const n of [root, ...Array.from(root.querySelectorAll('[id]'))]) {
        if (n.id && this.doc.getElementById(n.id)) n.id = uniqueDomId(this.doc, n.id)
      }
    }
    const css = opts.css ? this.ensureBlockCss(opts.css) : null
    const plan = planInsert(this.doc, useRef, position, nodes, !INLINE.has(useRef.tagName))
    if (opts.pretty) {
      // bloques nuevos: se reparten en líneas con la sangría del lugar donde caen
      const gap = plan.list.find((n) => n.nodeType === Node.TEXT_NODE && /^\n[ \t]*$/.test(n.nodeValue ?? ''))
      if (gap) els.forEach((root) => prettify(root, gap.nodeValue ?? '\n'))
    }
    applyPlan(plan)
    const all = plan.list
    const parent = plan.parent
    const next = all[all.length - 1]!.nextSibling
    const prevSelected = this.e.selected
    if (opts.select !== false) this.e.selected = els[0]
    this.push({
      label: opts.label ?? 'Insertar',
      undo: () => {
        all.forEach((n) => n.parentNode?.removeChild(n))
        css?.undo()
        if (this.e.selected && !this.e.selected.isConnected) this.e.selected = prevSelected?.isConnected ? prevSelected : null
      },
      redo: () => {
        all.forEach((n) => parent.insertBefore(n, next))
        css?.redo()
      },
    })
    return els
  }

  /** Quita un elemento junto con su sangría (si es un bloque), para no dejar líneas vacías en el código. */
  private takeOut(el: El): Node[] {
    const blank = INLINE.has(el.tagName) ? null : leadingBlank(el)
    const nodes: Node[] = blank ? [blank, el] : [el]
    nodes.forEach((n) => n.parentNode?.removeChild(n))
    return nodes
  }

  remove(el: El) {
    this.e.endTextEdit()
    if (el === this.doc.body || !el.parentNode) return
    const parent = el.parentNode
    const next = el.nextSibling
    const wasSelected = this.e.selected && (this.e.selected === el || el.contains(this.e.selected))
    const removed = this.takeOut(el)
    if (wasSelected) this.e.selected = parent instanceof Element && parent !== this.doc.documentElement ? (parent as El) : null
    this.push({
      label: 'Eliminar',
      undo: () => {
        removed.forEach((n) => parent.insertBefore(n, next))
        this.e.selected = el
      },
      redo: () => {
        removed.forEach((n) => n.parentNode?.removeChild(n))
        if (this.e.selected && !this.e.selected.isConnected) this.e.selected = null
      },
    })
  }

  duplicate(el: El): El | null {
    this.e.endTextEdit()
    if (el === this.doc.body || !el.parentNode) return null
    const rs = this.e.responsive
    const beforeRules = rs?.snapshot()
    const clone = el.cloneNode(true) as El
    // ids únicos
    for (const n of [clone, ...Array.from(clone.querySelectorAll('[id]'))]) {
      if (n.id) n.id = uniqueDomId(this.doc, n.id)
    }
    // clases responsivas propias para que editar la copia no cambie el original
    if (rs) {
      const map = new Map<string, string>()
      for (const n of [clone, ...Array.from(clone.querySelectorAll('[class]'))]) {
        for (const c of Array.from(n.classList)) {
          if (!/^lz-[a-z0-9]{5}$/.test(c)) continue
          let nc = map.get(c)
          if (!nc) {
            nc = 'lz-' + randomId()
            map.set(c, nc)
            rs.cloneRules(c, nc)
          }
          n.classList.replace(c, nc)
        }
      }
      rs.render()
    }
    const plan = planInsert(this.doc, el, 'after', [clone], !INLINE.has(el.tagName))
    applyPlan(plan)
    const all = plan.list
    const parent = plan.parent
    const next = all[all.length - 1]!.nextSibling
    this.e.selected = clone
    const afterRules = rs?.snapshot()
    this.push({
      label: 'Duplicar',
      undo: () => {
        all.forEach((n) => n.parentNode?.removeChild(n))
        if (beforeRules && rs) rs.restore(beforeRules)
        this.e.selected = el
      },
      redo: () => {
        all.forEach((n) => parent.insertBefore(n, next))
        if (afterRules && rs) rs.restore(afterRules)
        this.e.selected = clone
      },
    })
    return clone
  }

  move(el: El, ref: El, position: Position) {
    this.e.endTextEdit()
    if (el === ref || el.contains(ref) || el === this.doc.body) return
    const useRef = this.blockRef(ref, position)
    if (useRef === el || el.contains(useRef)) return
    const oldParent = el.parentNode!
    const oldNext = el.nextSibling
    const oldPrevEl = el.previousElementSibling
    const taken = this.takeOut(el)
    const plan = planInsert(this.doc, useRef, position, [el], !INLINE.has(el.tagName) && !INLINE.has(useRef.tagName))
    applyPlan(plan)
    const all = plan.list
    const sameSpot = el.parentNode === oldParent && el.previousElementSibling === oldPrevEl
    if (sameSpot) {
      // quedó donde estaba: se restaura tal cual
      all.forEach((n) => n.parentNode?.removeChild(n))
      taken.forEach((n) => oldParent.insertBefore(n, oldNext))
      return
    }
    const newParent = plan.parent
    const newNext = all[all.length - 1]!.nextSibling
    this.push({
      label: 'Mover',
      undo: () => {
        all.forEach((n) => n.parentNode?.removeChild(n))
        taken.forEach((n) => oldParent.insertBefore(n, oldNext))
      },
      redo: () => {
        taken.forEach((n) => n.parentNode?.removeChild(n))
        all.forEach((n) => newParent.insertBefore(n, newNext))
      },
    })
  }

  nudge(el: El, dir: -1 | 1) {
    let sib: Element | null = dir < 0 ? el.previousElementSibling : el.nextElementSibling
    while (sib && isSkippable(sib)) sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling
    if (!sib) return
    this.move(el, sib as El, dir < 0 ? 'before' : 'after')
  }

  wrap(el: El, tag = 'div') {
    this.e.endTextEdit()
    if (el === this.doc.body || !el.parentNode) return
    const parent = el.parentNode
    const next = el.nextSibling
    const wrapper = this.doc.createElement(tag) as El
    parent.insertBefore(wrapper, el)
    wrapper.appendChild(el)
    this.e.selected = wrapper
    this.push({
      label: 'Agrupar',
      undo: () => {
        parent.insertBefore(el, wrapper)
        wrapper.remove()
        this.e.selected = el
      },
      redo: () => {
        parent.insertBefore(wrapper, next)
        wrapper.appendChild(el)
        this.e.selected = wrapper
      },
    })
  }

  /** Cambia el tipo de etiqueta (por ejemplo de párrafo a título) conservando atributos y contenido. */
  changeTag(el: El, tag: string): El | null {
    this.e.endTextEdit()
    if (el === this.doc.body || !el.parentNode || el.localName === tag.toLowerCase()) return null
    const parent = el.parentNode
    const repl = this.doc.createElement(tag) as El
    for (const a of Array.from(el.attributes)) repl.setAttribute(a.name, a.value)
    while (el.firstChild) repl.appendChild(el.firstChild)
    parent.insertBefore(repl, el)
    el.remove()
    this.e.selected = repl
    this.push({
      label: 'Cambiar tipo de elemento',
      undo: () => {
        while (repl.firstChild) el.appendChild(repl.firstChild)
        parent.insertBefore(el, repl)
        repl.remove()
        this.e.selected = el
      },
      redo: () => {
        while (el.firstChild) repl.appendChild(el.firstChild)
        parent.insertBefore(repl, el)
        el.remove()
        this.e.selected = repl
      },
    })
    return repl
  }

  replaceOuterHtml(el: El, html: string): El | null {
    this.e.endTextEdit()
    if (el === this.doc.body) return null
    const nodes = parseFragment(this.doc, html)
    if (!nodes.length) return null
    void this.e.hub?.adoptNodes(nodes, this.e.pagePath)
    const parent = el.parentNode!
    const next = el.nextSibling
    nodes.forEach((n) => parent.insertBefore(n, el))
    el.remove()
    const first = nodes.find((n): n is El => n.nodeType === Node.ELEMENT_NODE) ?? null
    this.e.selected = first
    this.push({
      label: 'Editar HTML',
      undo: () => {
        nodes.forEach((n) => n.parentNode?.removeChild(n))
        parent.insertBefore(el, next)
        this.e.selected = el
      },
      redo: () => {
        nodes.forEach((n) => parent.insertBefore(n, next))
        el.remove()
        this.e.selected = first
      },
    })
    return first
  }

  /** HTML de un elemento sin marcas del editor ni URLs temporales. */
  cleanHtmlOf(el: El): string {
    const clone = inertCopy(this.doc, el)
    cleanTree(clone, this.e.hub)
    return clone.outerHTML
  }

  // ── cabecera de la página (SEO) ──────────────────────────────────────────
  private snapshotNode(n: Element) {
    return { attrs: Object.fromEntries(Array.from(n.attributes).map((a) => [a.name, a.value])), text: n.textContent }
  }

  private applySnapshot(n: Element, state: { attrs: Record<string, string>; text: string | null }) {
    for (const a of Array.from(n.attributes)) n.removeAttribute(a.name)
    for (const [k, v] of Object.entries(state.attrs)) n.setAttribute(k, v)
    if (n.localName === 'title') n.textContent = state.text
  }

  /** Crea (si no existe) o actualiza un elemento de <head>. */
  private headNode(selector: string, tag: string, attrs: Record<string, string>, bodyText?: string): void {
    const head = this.doc.head
    let node = head.querySelector(selector) as HTMLElement | null
    const created = !node
    const before = node ? this.snapshotNode(node) : null
    let added: Node[] = []
    if (!node) {
      node = this.doc.createElement(tag)
      added = appendToHead(this.doc, node)
    }
    const n = node
    const spotNext = added.length ? added[added.length - 1]!.nextSibling : null
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    if (bodyText !== undefined) n.textContent = bodyText
    const after = this.snapshotNode(n)
    if (!created && JSON.stringify(before) === JSON.stringify(after)) return
    this.push({
      label: 'Cambiar datos del sitio',
      key: `head:${selector}`,
      undo: () => {
        if (created) added.forEach((x) => x.parentNode?.removeChild(x))
        else this.applySnapshot(n, before!)
      },
      redo: () => {
        if (created && !n.isConnected) added.forEach((x) => head.insertBefore(x, spotNext))
        this.applySnapshot(n, after)
      },
    })
  }

  private removeHeadNode(selector: string) {
    const n = this.doc.head.querySelector(selector)
    if (!n) return
    const parent = n.parentNode!
    const next = n.nextSibling
    n.remove()
    this.push({
      label: 'Cambiar datos del sitio',
      undo: () => void parent.insertBefore(n, next),
      redo: () => void n.remove(),
    })
  }

  getTitle(): string {
    return this.doc.title || ''
  }

  setTitle(text: string) {
    this.headNode('title', 'title', {}, text)
  }

  getMeta(key: string, attr: 'name' | 'property' = 'name'): string {
    return this.doc.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? ''
  }

  setMeta(key: string, content: string, attr: 'name' | 'property' = 'name') {
    const sel = `meta[${attr}="${key}"]`
    if (!content) return this.removeHeadNode(sel)
    this.headNode(sel, 'meta', { [attr]: key, content })
  }

  getLang(): string {
    return this.doc.documentElement.getAttribute('lang') ?? ''
  }

  setLang(lang: string) {
    this.setAttr(this.doc.documentElement as unknown as El, 'lang', lang || null, 'Cambiar idioma')
  }

  getFavicon(): string {
    return this.doc.head.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? ''
  }

  setFavicon(href: string) {
    if (!href) return this.removeHeadNode('link[rel~="icon"]')
    this.headNode('link[rel~="icon"]', 'link', { rel: 'icon', href })
  }
}
