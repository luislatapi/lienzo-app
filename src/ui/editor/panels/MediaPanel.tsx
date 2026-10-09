import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Plus, Trash2, Upload } from 'lucide-react'
import { basename, isImagePath, mimeFromPath } from '../../../lib/site/paths'
import { isIgnoredPath } from '../../../lib/site/site-info'
import { useUI } from '../../../store/ui'
import { addImageFile, applyImage, insertBlock, loadRepoImage } from '../actions'
import { BLOCKS } from '../../../lib/editor/blocks'
import { useEditor, useEngineState, useProjectState } from '../context'
import type { Project } from '../../../lib/project'

/** Lista de imágenes del repositorio (más las que acabas de subir). */
export function useRepoImages(project: Project): string[] {
  return useMemo(() => {
    const set = new Set<string>()
    for (const p of project.tree.keys()) if (isImagePath(p) && !isIgnoredPath(p)) set.add(p)
    for (const [p, w] of project.working) {
      if (!isImagePath(p)) continue
      if (w.deleted) set.delete(p)
      else set.add(p)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, project.getVersion()])
}

export function Thumb({ project, path }: { project: Project; path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let revoke: string | null = null
    let cancelled = false
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      project.readBytes(path).then((bytes) => {
        if (!bytes || cancelled) return
        revoke = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFromPath(path) }))
        setUrl(revoke)
      })
    })
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [project, path])
  return <div ref={ref} className="thumb">{url && <img src={url} alt="" draggable={false} />}</div>
}

export function MediaPanel() {
  const ctx = useEditor()
  const { engine } = ctx
  useEngineState()
  const project = useProjectState()
  const images = useRepoImages(project)
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const toast = useUI((s) => s.toast)
  const sel = engine.selected && engine.selected !== engine.body ? engine.selected : null

  const upload = async (files: FileList | File[]) => {
    let n = 0
    for (const f of Array.from(files)) if (await addImageFile(ctx, f)) n++
    if (n) toast('ok', n === 1 ? 'Imagen agregada. Se guardará al publicar.' : `${n} imágenes agregadas. Se guardarán al publicar.`)
  }

  const use = async (path: string) => {
    const placed = await loadRepoImage(ctx, path)
    if (!placed) return toast('error', 'No se pudo cargar esa imagen.')
    if (sel) applyImage(ctx, sel, placed)
    else insertImage(placed)
  }

  const insertImage = (placed: { blobUrl: string }) => {
    const block = BLOCKS.find((b) => b.id === 'imagen')!
    insertBlock(ctx, { ...block, html: `<img src="${placed.blobUrl}" alt="" style="max-width:100%;height:auto;display:block">` })
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <h3>Medios</h3>
        <p>Imágenes de tu sitio. {sel ? 'Elige una para la selección.' : 'Selecciona un elemento y elige una imagen.'}</p>
      </header>
      <div className="panel-actions">
        <button className="btn small primary" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Subir imágenes
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      <div
        className={'panel-scroll drop-zone' + (over ? ' over' : '')}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void upload(e.dataTransfer.files)
        }}
      >
        {images.length === 0 && (
          <div className="panel-empty">
            <ImagePlus size={22} />
            <p>Aún no hay imágenes. Sube una o arrástrala aquí.</p>
          </div>
        )}
        <div className="media-grid">
          {images.map((p) => (
            <div key={p} className="media-tile">
              <button className="media-use" onClick={() => void use(p)} title={sel ? 'Usar en la selección' : 'Insertar en la página'}>
                <Thumb project={project} path={p} />
              </button>
              <div className="media-name" title={p}>
                {basename(p)}
              </div>
              <div className="media-actions">
                {sel && (
                  <button className="btn small" title="Insertar como imagen nueva" onClick={async () => {
                    const placed = await loadRepoImage(ctx, p)
                    if (placed) insertImage(placed)
                  }}>
                    <Plus size={12} /> Insertar
                  </button>
                )}
                {project.isNew(p) && (
                  <button className="icon-btn" title="Quitar (aún no está publicada)" aria-label="Quitar imagen" onClick={() => project.discard(p)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {project.isModified(p) && <i className="dot-mod tile" title="Nueva o modificada" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
