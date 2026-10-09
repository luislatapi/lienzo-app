import type { El } from '../../lib/editor/dom-utils'
import { BASE_CSS, detectAccent, type BlockDef } from '../../lib/editor/blocks'
import { parseFragment } from '../../lib/editor/dom-utils'
import type { Position } from '../../lib/editor/ops'
import { isImagePath, joinPath, relativeRef, slugifyFilename, uniquePath } from '../../lib/site/paths'
import { useUI } from '../../store/ui'
import type { FontDef } from '../../lib/site/fonts'
import type { EditorCtx } from './context'

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const IMAGE_DIRS = ['img', 'images', 'assets/img', 'assets/images', 'assets', 'static/images', 'static/img', 'media']

/** Carpeta donde se guardan las imágenes nuevas: la que ya usa el sitio o una por defecto. */
export function imagesDir(ctx: EditorCtx): string {
  const root = ctx.project.site.siteRoot
  const paths = [...ctx.project.tree.keys(), ...ctx.project.working.keys()]
  for (const d of IMAGE_DIRS) {
    const full = joinPath(root, d)
    if (paths.some((p) => p.startsWith(full + '/'))) return full
  }
  return joinPath(root, 'img')
}

export interface PlacedImage {
  path: string
  blobUrl: string
  ref: string
}

/** Agrega un archivo de imagen a la copia de trabajo y devuelve cómo referenciarlo desde la página. */
export async function addImageFile(ctx: EditorCtx, file: File): Promise<PlacedImage | null> {
  const toast = useUI.getState().toast
  if (!file.type.startsWith('image/') && !isImagePath(file.name)) {
    toast('error', `“${file.name}” no es una imagen.`)
    return null
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    toast('error', `“${file.name}” pesa más de 12 MB. Redúcela antes de subirla para que tu sitio cargue rápido.`)
    return null
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const dir = imagesDir(ctx)
  const path = uniquePath(joinPath(dir, slugifyFilename(file.name)), (p) => ctx.project.has(p))
  ctx.project.writeBytes(path, bytes)
  const blobUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: file.type || 'image/png' }))
  const ref = relativeRef(ctx.engine.pagePath, path, ctx.project.site.siteRoot)
  ctx.engine.hub?.register(blobUrl, ref, path)
  return { path, blobUrl, ref }
}

/** Usa una imagen que ya está en el repo. */
export async function loadRepoImage(ctx: EditorCtx, path: string): Promise<PlacedImage | null> {
  const hub = ctx.engine.hub
  if (!hub) return null
  const ref = relativeRef(ctx.engine.pagePath, path, ctx.project.site.siteRoot)
  const blobUrl = await hub.urlFor(path, ref)
  if (!blobUrl) return null
  return { path, blobUrl, ref }
}

/** Coloca una imagen en el elemento: como <img> o como fondo. */
export function applyImage(ctx: EditorCtx, el: El, img: PlacedImage, mode: 'auto' | 'background' = 'auto') {
  const ops = ctx.engine.ops
  if (el.tagName === 'IMG' && mode === 'auto') {
    ops.setAttrs(el, { src: img.blobUrl, srcset: null, sizes: null }, 'Cambiar imagen')
  } else {
    ops.setStyle(el, { 'background-image': `url("${img.blobUrl}")` })
  }
}

// ── bloques ─────────────────────────────────────────────────────────────────
const TAIL_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK'])

function endOf(host: El): { ref: El; position: Position } {
  const kids = Array.from(host.children).filter((c) => !TAIL_TAGS.has(c.tagName)) as El[]
  const last = kids[kids.length - 1]
  if (!last) return { ref: host, position: 'append' }
  if (last.tagName === 'FOOTER') return { ref: last, position: 'before' }
  return { ref: last, position: 'after' }
}

/** Lugar por defecto para un bloque nuevo: junto a lo seleccionado, o al final de la página (antes del pie). */
export function defaultInsertPoint(ctx: EditorCtx, kind: 'element' | 'section'): { ref: El; position: Position } {
  const body = ctx.engine.body as El
  const sel = ctx.engine.selected
  const main = body.querySelector('main') as El | null
  if (kind === 'element') {
    if (sel && sel !== body) return { ref: sel, position: 'after' }
    return endOf(main ?? body)
  }
  if (sel && sel !== body) {
    const host = main && main.contains(sel) ? main : body
    let cur: El = sel
    while (cur.parentElement && cur.parentElement !== host) cur = cur.parentElement as El
    if (cur.parentElement === host) return { ref: cur, position: 'after' }
  }
  return endOf(main ?? body)
}

export function insertBlock(ctx: EditorCtx, block: BlockDef, at?: { ref: El; position: Position }) {
  const { engine } = ctx
  if (!engine.doc || !engine.win) return
  const nodes = parseFragment(engine.doc, block.html)
  const first = nodes.find((n): n is El => n.nodeType === Node.ELEMENT_NODE)
  if (!first) return
  const colors = detectAccent(engine.doc, engine.win)
  first.style.setProperty('--lz-accent', colors.accent)
  first.style.setProperty('--lz-on-accent', colors.onAccent)
  const target = at ?? defaultInsertPoint(ctx, block.kind)
  const css: Array<{ id: string; css: string }> = []
  if (block.base) css.push({ id: 'base', css: BASE_CSS })
  if (block.css) css.push({ id: block.id, css: block.css })
  const inserted = engine.ops.insert(nodes, target.ref, target.position, {
    label: `Insertar ${block.name.toLowerCase()}`,
    css: css.length ? css : undefined,
    select: true,
    pretty: true,
  })
  if (inserted[0]) requestAnimationFrame(() => engine.scrollTo(inserted[0]))
}

// ── tipografías ─────────────────────────────────────────────────────────────
/** Agrega a la página el enlace de Google Fonts necesario para usar una tipografía. */
export function ensureGoogleFont(ctx: EditorCtx, font: FontDef) {
  const doc = ctx.engine.doc
  if (!doc) return
  const sel = 'link[href^="https://fonts.googleapis.com/css2"]'
  const existing = doc.head.querySelector<HTMLLinkElement>(sel)
  const have = existing ? new URL(existing.href).searchParams.getAll('family') : []
  if (have.some((f) => f === font.name || f.startsWith(font.name + ':'))) return
  const spec = font.weights.length === 1 && font.weights[0] === 400 ? font.name : `${font.name}:wght@${font.weights.join(';')}`
  const families = [...have, spec].map((f) => 'family=' + f.replace(/ /g, '+'))
  const href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
  const ops = ctx.engine.ops
  if (!existing) {
    ops.ensureLink('link[rel="preconnect"][href="https://fonts.googleapis.com"]', { rel: 'preconnect', href: 'https://fonts.googleapis.com' })
    ops.ensureLink('link[rel="preconnect"][href="https://fonts.gstatic.com"]', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' })
  }
  ops.ensureLink(sel, { rel: 'stylesheet', href })
}
