import { appendToHead, randomId } from './dom-utils'

export type MediaKey = 'tablet' | 'mobile' | 'only-desktop' | 'only-tablet' | 'only-mobile'

export const MEDIA: Record<MediaKey, string> = {
  tablet: '(max-width: 991px)',
  mobile: '(max-width: 767px)',
  'only-desktop': '(min-width: 992px)',
  'only-tablet': '(min-width: 768px) and (max-width: 991px)',
  'only-mobile': '(max-width: 767px)',
}

const ORDER: MediaKey[] = ['tablet', 'mobile', 'only-desktop', 'only-tablet', 'only-mobile']
const STYLE_ID = 'lienzo-responsive'
const CLASS_PREFIX = 'lz-'

type RuleSet = Partial<Record<MediaKey, Record<string, string>>>

/**
 * Estilos por tamaño de pantalla. Los cambios hechos en "Tablet" o "Móvil" se guardan como reglas
 * @media dentro de un único <style id="lienzo-responsive"> y se enlazan al elemento con una clase lz-xxxxx.
 */
export class ResponsiveStyles {
  rules = new Map<string, RuleSet>()
  /** espacios de sangría que se pusieron antes de la etiqueta <style> al crearla */
  private styleBlank: Text | null = null

  constructor(private doc: Document) {}

  private get styleEl(): HTMLStyleElement | null {
    return this.doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  }

  /** Lee las reglas guardadas anteriormente en la página. */
  load() {
    this.rules.clear()
    const el = this.styleEl
    const sheet = el?.sheet
    if (!sheet) return
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof (this.doc.defaultView as Window & typeof globalThis).CSSMediaRule)) continue
      const cond = rule.conditionText.replace(/\s+/g, ' ')
      const key = (Object.keys(MEDIA) as MediaKey[]).find((k) => MEDIA[k] === cond)
      if (!key) continue
      for (const inner of Array.from(rule.cssRules)) {
        const sr = inner as CSSStyleRule
        const m = sr.selectorText?.match(/^\.(lz-[a-z0-9]+)$/)
        if (!m) continue
        const props: Record<string, string> = {}
        for (let i = 0; i < sr.style.length; i++) {
          const p = sr.style.item(i)
          props[p] = sr.style.getPropertyValue(p)
        }
        const set = this.rules.get(m[1]) ?? {}
        set[key] = { ...(set[key] ?? {}), ...props }
        this.rules.set(m[1], set)
      }
    }
  }

  classFor(el: Element): string | null {
    return Array.from(el.classList).find((c) => c.startsWith(CLASS_PREFIX) && /^lz-[a-z0-9]{5}$/.test(c)) ?? null
  }

  ensureClass(el: Element): string {
    const existing = this.classFor(el)
    if (existing) return existing
    let name = CLASS_PREFIX + randomId()
    while (this.rules.has(name) || this.doc.querySelector('.' + name)) name = CLASS_PREFIX + randomId()
    el.classList.add(name)
    return name
  }

  get(el: Element, key: MediaKey): Record<string, string> {
    const c = this.classFor(el)
    return c ? { ...(this.rules.get(c)?.[key] ?? {}) } : {}
  }

  set(el: Element, key: MediaKey, props: Record<string, string>) {
    const cls = this.ensureClass(el)
    const set = this.rules.get(cls) ?? {}
    const cur = { ...(set[key] ?? {}) }
    for (const [k, v] of Object.entries(props)) {
      if (v === '' || v == null) delete cur[k]
      else cur[k] = v
    }
    if (Object.keys(cur).length) set[key] = cur
    else delete set[key]
    if (Object.keys(set).length) this.rules.set(cls, set)
    else {
      this.rules.delete(cls)
      el.classList.remove(cls)
      if (!el.getAttribute('class')) el.removeAttribute('class')
    }
    this.render()
  }

  snapshot(): string {
    return JSON.stringify([...this.rules.entries()])
  }

  restore(json: string) {
    this.rules = new Map(JSON.parse(json))
    this.render()
  }

  /** Copia las reglas de una clase a otra (al duplicar elementos). */
  cloneRules(fromClass: string, toClass: string) {
    const src = this.rules.get(fromClass)
    if (src) this.rules.set(toClass, JSON.parse(JSON.stringify(src)))
  }

  /** Elimina reglas de clases que ya no se usan en el documento. */
  prune() {
    for (const cls of [...this.rules.keys()]) {
      if (!this.doc.querySelector('.' + cls)) this.rules.delete(cls)
    }
  }

  render() {
    let el = this.styleEl
    const blocks: string[] = []
    for (const key of ORDER) {
      const lines: string[] = []
      for (const [cls, set] of this.rules) {
        const props = set[key]
        if (!props) continue
        const decl = Object.entries(props)
          .map(([p, v]) => `${p}: ${v.replace(/\s*!important\s*$/i, '')} !important;`)
          .join(' ')
        lines.push(`  .${cls} { ${decl} }`)
      }
      if (lines.length) blocks.push(`@media ${MEDIA[key]} {\n${lines.join('\n')}\n}`)
    }
    if (!blocks.length) {
      if (el) {
        // se quita también la sangría que se puso al crearla
        const ws = this.styleBlank
        el.remove()
        if (ws && ws.parentNode && !(ws.nodeValue ?? '').trim()) ws.parentNode.removeChild(ws)
        this.styleBlank = null
      }
      return
    }
    const css = `/* Lienzo: estilos para tablet y móvil */\n${blocks.join('\n')}\n`
    if (!el) {
      el = this.doc.createElement('style')
      el.id = STYLE_ID
      const added = appendToHead(this.doc, el)
      this.styleBlank = added.length > 1 ? (added[0] as Text) : null
    }
    if (el.textContent !== css) el.textContent = css
  }
}
