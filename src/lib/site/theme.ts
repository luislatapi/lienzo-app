// Lectura y cambio de colores, tipografías y variables de las hojas de estilo (CSS) de un sitio.
// Son funciones puras sobre texto: no tocan el DOM, así se pueden probar fácilmente.

const MARK = '\u0001'
const TOKENS = /\u0001\d+\u0001/g

/** Oculta url(...), textos entre comillas y comentarios para que no confundan al leer el CSS. */
function mask(css: string): { text: string; parts: string[] } {
  const parts: string[] = []
  const text = css.replace(
    /url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\/\*[\s\S]*?\*\//g,
    (m) => {
      parts.push(m)
      return `${MARK}${parts.length - 1}${MARK}`
    },
  )
  return { text, parts }
}

function unmask(text: string, parts: string[]): string {
  return text.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i: string) => parts[Number(i)] ?? '')
}

export interface CssVar {
  name: string
  value: string
}

export type VarKind = 'color' | 'font' | 'length' | 'other'

const ROOT_RULE = /(?:^|[};]|\u0001\d+\u0001)\s*(?::root|html)(?:\s*,\s*(?::root|html))*\s*\{([^{}]*)\}/g

/** Variables (--nombre: valor) declaradas en :root. */
export function parseRootVars(css: string): CssVar[] {
  const { text, parts } = mask(css)
  const out = new Map<string, string>()
  for (const m of text.matchAll(ROOT_RULE)) {
    for (const decl of m[1].split(';')) {
      const i = decl.indexOf(':')
      if (i < 0) continue
      const name = decl.slice(0, i).replace(TOKENS, '').trim() // sin los comentarios que haya antes
      if (!name.startsWith('--')) continue
      out.set(name, unmask(decl.slice(i + 1), parts).trim())
    }
  }
  return [...out].map(([name, value]) => ({ name, value }))
}

/** Espacios y comentarios al final de un valor (se conservan al cambiarlo). */
function trailingTrivia(s: string, parts: string[]): string {
  let end = s.length
  for (;;) {
    const m = /(\s+|\u0001(\d+)\u0001)$/.exec(s.slice(0, end))
    if (!m) break
    if (m[2] !== undefined && !(parts[Number(m[2])] ?? '').startsWith('/*')) break
    end -= m[0].length
  }
  return s.slice(end)
}

/** Cambia el valor de una variable de :root. Devuelve el mismo texto si no la encuentra. */
export function setRootVar(css: string, name: string, value: string): string {
  const { text, parts } = mask(css)
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|;|\\{)((?:\\s|\\u0001\\d+\\u0001)*${esc}\\s*:)([^;}]*)`, 'g')
  const safe = value.replace(/[;{}]/g, '').trim()
  const out = text.replace(ROOT_RULE, (rule) => {
    let done = false
    return rule.replace(re, (all, pre: string, head: string, old: string) => {
      if (done) return all
      done = true
      const lead = /^\s*/.exec(old)?.[0] ?? ' '
      return `${pre}${head}${lead}${safe}${trailingTrivia(old, parts)}`
    })
  })
  return unmask(out, parts)
}

const COLOR_FN = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
const FONT_GENERIC = /\b(sans-serif|serif|monospace|system-ui|cursive|fantasy|ui-sans-serif|ui-serif|ui-monospace)\b/i

export function varKind(name: string, value: string): VarKind {
  const v = value.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(v) || COLOR_FN.test(v)) return 'color'
  if (FONT_GENERIC.test(v) && (v.includes(',') || /font|tipo|letra|family/i.test(name))) return 'font'
  if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch|svh|dvh)$/i.test(v)) return 'length'
  return 'other'
}

/** "#abc" -> "#aabbcc". Conserva el canal de transparencia si existe. */
export function normalizeHex(h: string): string | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(h.trim())
  if (!m) return null
  let x = m[1].toLowerCase()
  if (x.length <= 4) x = x.replace(/./g, (c) => c + c)
  return '#' + x
}

/** Pone en `to` (#rrggbb) la transparencia que tenía `from` (#rrggbbaa). */
export function withAlphaOf(from: string, to: string): string {
  const f = normalizeHex(from)
  const t = normalizeHex(to)
  if (!t) return to
  return f && f.length === 9 ? t.slice(0, 7) + f.slice(7) : t.slice(0, 7)
}

/** Convierte rgb()/rgba() a #rrggbb. Devuelve null si no se puede (hsl, variables…). */
export function toHex(value: string): string | null {
  const hex = normalizeHex(value)
  if (hex) return hex.slice(0, 7)
  const m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/i.exec(value.trim())
  if (!m) return null
  const h = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0')
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`
}

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/gi
const INNER_BODY = /\{([^{}]*)\}/g

/** Aplica fn a cada declaración "propiedad: valor" de cada regla (sin las variables --x). */
function mapDeclarations(css: string, fn: (prop: string, value: string) => string | null): string {
  const { text, parts } = mask(css)
  const out = text.replace(INNER_BODY, (_all, body: string) => {
    const fixed = body.replace(/(^|;)([^;]*)/g, (whole: string, sep: string, decl: string) => {
      const i = decl.indexOf(':')
      if (i < 0) return whole
      const prop = decl.slice(0, i).replace(TOKENS, '').trim().toLowerCase()
      if (prop.startsWith('--')) return whole
      const value = decl.slice(i + 1)
      const next = fn(prop, value)
      return next === null ? whole : `${sep}${decl.slice(0, i + 1)}${next}`
    })
    return `{${fixed}}`
  })
  return unmask(out, parts)
}

/** Colores en hexadecimal que usa el CSS, con cuántas veces aparece cada uno. */
export function findHexColors(css: string): Map<string, number> {
  const found = new Map<string, number>()
  mapDeclarations(css, (_prop, value) => {
    for (const m of value.matchAll(HEX)) {
      const n = normalizeHex(m[0])
      if (n) found.set(n, (found.get(n) ?? 0) + 1)
    }
    return null
  })
  return found
}

/** Cambia un color en todo el CSS (acepta #abc, #aabbcc y #aabbccdd). */
export function replaceHexColor(css: string, fromNorm: string, to: string): string {
  const target = normalizeHex(to)
  if (!target) return css
  return mapDeclarations(css, (_prop, value) => {
    let changed = false
    const next = value.replace(HEX, (tok) => {
      const n = normalizeHex(tok)
      if (n !== fromNorm) return tok
      changed = true
      return withAlphaOf(n, target)
    })
    return changed ? next : null
  })
}

const tidy = (s: string) => s.replace(/\s*!important\s*$/i, '').replace(/\s+/g, ' ').trim()

/** Listas de tipografías (font-family) que usa el CSS, con su frecuencia. */
export function findFontStacks(css: string): Map<string, number> {
  const found = new Map<string, number>()
  const { parts } = mask(css)
  mapDeclarations(css, (prop, value) => {
    if (prop === 'font-family') {
      const v = tidy(unmask(value, parts))
      if (v && !/^(inherit|initial|unset)$/i.test(v)) found.set(v, (found.get(v) ?? 0) + 1)
    }
    return null
  })
  return found
}

export function replaceFontStack(css: string, from: string, to: string): string {
  const { parts } = mask(css)
  return mapDeclarations(css, (prop, value) => {
    if (prop !== 'font-family') return null
    const raw = unmask(value, parts)
    if (tidy(raw) !== from) return null
    const important = /!important\s*$/i.test(raw) ? ' !important' : ''
    return ` ${to}${important}`
  })
}

/** Nombre de la primera tipografía de una lista: `'Lora', serif` -> `Lora`. */
export function primaryFamily(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? ''
  return first.replace(/^["']|["']$/g, '')
}
