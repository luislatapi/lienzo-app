// Localiza y reemplaza url(...) y @import dentro de texto CSS, ignorando comentarios.

export interface CssUrlRef {
  /** posición de inicio de la URL dentro del texto (sin comillas) */
  start: number
  end: number
  raw: string
  kind: 'url' | 'import'
}

function maskComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
}

const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"'][^)]*?))\s*\)/gid
const IMPORT_RE = /@import\s+(?:"([^"]*)"|'([^']*)')/gid

export function scanCssUrls(css: string): CssUrlRef[] {
  const masked = maskComments(css)
  const refs: CssUrlRef[] = []
  for (const m of masked.matchAll(URL_RE)) {
    const idx = (m as RegExpMatchArray & { indices: Array<[number, number] | undefined> }).indices
    for (let g = 1; g <= 3; g++) {
      const span = idx[g]
      if (span && m[g] !== undefined) {
        refs.push({ start: span[0], end: span[1], raw: css.slice(span[0], span[1]), kind: 'url' })
        break
      }
    }
  }
  for (const m of masked.matchAll(IMPORT_RE)) {
    const idx = (m as RegExpMatchArray & { indices: Array<[number, number] | undefined> }).indices
    for (let g = 1; g <= 2; g++) {
      const span = idx[g]
      if (span && m[g] !== undefined) {
        refs.push({ start: span[0], end: span[1], raw: css.slice(span[0], span[1]), kind: 'import' })
        break
      }
    }
  }
  return refs.sort((a, b) => a.start - b.start)
}

/** Reemplaza cada URL por lo que devuelva fn (null = dejar igual). */
export function replaceCssUrls(css: string, fn: (raw: string, kind: 'url' | 'import') => string | null): string {
  const refs = scanCssUrls(css)
  if (refs.length === 0) return css
  let out = ''
  let last = 0
  for (const r of refs) {
    const next = fn(r.raw, r.kind)
    out += css.slice(last, r.start)
    out += next === null ? r.raw : next
    last = r.end
  }
  out += css.slice(last)
  return out
}

/** Valores de srcset: "a.png 1x, b.png 2x" -> lista de URLs con su descriptor. */
export function parseSrcset(value: string): Array<{ url: string; descriptor: string }> {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, ...rest] = part.split(/\s+/)
      return { url, descriptor: rest.join(' ') }
    })
}

export function replaceSrcset(value: string, fn: (url: string) => string | null): string {
  // Conserva el formato original lo más posible: reemplaza solo las URLs.
  return value
    .split(',')
    .map((part) => {
      const m = part.match(/^(\s*)(\S+)(.*)$/s)
      if (!m) return part
      const next = fn(m[2])
      return `${m[1]}${next === null ? m[2] : next}${m[3]}`
    })
    .join(',')
}
