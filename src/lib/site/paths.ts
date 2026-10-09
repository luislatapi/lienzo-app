// Utilidades de rutas para trabajar con archivos de un repositorio.
// Todas las rutas del repo son relativas a la raíz del repo, sin "/" inicial.

export function normalizePath(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length === 0) return '' // se sale del repo
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.join('/')
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join('/'))
}

export function dirname(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

export function basename(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? p : p.slice(i + 1)
}

export function extname(p: string): string {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i <= 0 ? '' : b.slice(i).toLowerCase()
}

/** Referencias que no apuntan a un archivo del repo (URLs externas, anclas, esquemas especiales). */
export function isExternalRef(ref: string): boolean {
  const r = ref.trim()
  if (r === '') return true
  if (r.startsWith('#')) return true
  if (r.startsWith('//')) return true
  return /^[a-z][a-z0-9+.-]*:/i.test(r)
}

/** Separa "ruta?consulta#ancla" en ruta y sufijo. */
export function splitRef(ref: string): { path: string; suffix: string } {
  const i = ref.search(/[?#]/)
  if (i < 0) return { path: ref, suffix: '' }
  return { path: ref.slice(0, i), suffix: ref.slice(i) }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Convierte una referencia escrita en un archivo (por ejemplo "../img/a.png" o "/img/a.png")
 * en una ruta de repo. Devuelve null si no apunta a un archivo del repo.
 */
export function resolveRef(ref: string, fromFile: string, siteRoot = ''): string | null {
  if (isExternalRef(ref)) return null
  const { path } = splitRef(ref.trim())
  if (path === '') return null
  const decoded = path.split('/').map(safeDecode).join('/')
  let resolved: string
  if (decoded.startsWith('/')) {
    resolved = joinPath(siteRoot, decoded)
  } else {
    resolved = joinPath(dirname(fromFile), decoded)
  }
  if (!resolved) return null
  return resolved
}

/** Ruta relativa desde un archivo hacia otro archivo del repo, lista para usar en src/href. */
export function relativeRef(fromFile: string, toPath: string, siteRoot = '', style: 'relative' | 'root' = 'relative'): string {
  const enc = (p: string) => p.split('/').map((s) => encodeURIComponent(s).replace(/%40/g, '@')).join('/')
  if (style === 'root') {
    let p = toPath
    if (siteRoot && (toPath === siteRoot || toPath.startsWith(siteRoot + '/'))) p = toPath.slice(siteRoot.length + 1)
    return '/' + enc(p)
  }
  const from = dirname(fromFile).split('/').filter(Boolean)
  const to = toPath.split('/').filter(Boolean)
  let i = 0
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++
  const ups = from.length - i
  const rest = to.slice(i)
  return enc([...Array(ups).fill('..'), ...rest].join('/'))
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.md': 'text/markdown',
}

export function mimeFromPath(p: string): string {
  return MIME[extname(p)] ?? 'application/octet-stream'
}

export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.bmp']
export const TEXT_EXTS = ['.html', '.htm', '.css', '.js', '.mjs', '.json', '.txt', '.xml', '.md', '.svg', '.ts', '.tsx', '.jsx', '.vue', '.astro', '.yml', '.yaml', '.toml', '.csv', '.env', '.gitignore']

export const isHtmlPath = (p: string) => ['.html', '.htm'].includes(extname(p))
export const isCssPath = (p: string) => extname(p) === '.css'
export const isImagePath = (p: string) => IMAGE_EXTS.includes(extname(p))
export const isTextPath = (p: string) => {
  const e = extname(p)
  return TEXT_EXTS.includes(e) || basename(p).startsWith('.') || e === ''
}

/** Nombre de archivo seguro para subir: minúsculas, sin acentos ni espacios. */
export function slugifyFilename(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (slug || 'archivo') + ext.replace(/[^a-z0-9.]/g, '')
}

/** Si la ruta ya existe, agrega -2, -3… antes de la extensión. */
export function uniquePath(path: string, exists: (p: string) => boolean): string {
  if (!exists(path)) return path
  const dot = path.lastIndexOf('.')
  const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path
  const ext = dot > path.lastIndexOf('/') ? path.slice(dot) : ''
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`
    if (!exists(candidate)) return candidate
  }
  return `${stem}-${Date.now()}${ext}`
}
