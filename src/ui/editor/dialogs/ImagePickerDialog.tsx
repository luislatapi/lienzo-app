import { useRef, useState } from 'react'
import { ImagePlus, Search, Upload } from 'lucide-react'
import { basename, mimeFromPath } from '../../../lib/site/paths'
import { useUI } from '../../../store/ui'
import { Modal } from '../../kit'
import { addImageFile, applyImage, loadRepoImage, type PlacedImage } from '../actions'
import { useEditor, useProjectState } from '../context'
import { useDeploy } from '../deploy'
import { Thumb, useRepoImages } from '../panels/MediaPanel'

type Target = 'element' | 'background' | 'favicon' | 'og'

const TITLES: Record<Target, string> = {
  element: 'Elegir imagen',
  background: 'Imagen de fondo',
  favicon: 'Ícono de la pestaña',
  og: 'Imagen al compartir en redes',
}

/** Elegir o subir una imagen para un elemento, un fondo, el ícono de la pestaña o la imagen para redes sociales. */
export function ImagePickerDialog() {
  const ctx = useEditor()
  const { engine, project } = ctx
  useProjectState()
  const ui = useUI()
  const target = ((useUI((s) => s.dialogData) as { target?: Target } | null)?.target ?? 'element') as Target
  const images = useRepoImages(project)
  const [query, setQuery] = useState('')
  const [over, setOver] = useState(false)
  const [siteUrl, setSiteUrl] = useState(() => useDeploy.getState().liveUrl ?? project.repo.homepage ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const sel = engine.selected
  const list = images.filter((p) => p.toLowerCase().includes(query.trim().toLowerCase()))

  const apply = (placed: PlacedImage) => {
    const ops = engine.ops
    if (target === 'element' || target === 'background') {
      if (!sel) return ui.toast('error', 'Selecciona primero un elemento de la página.')
      applyImage(ctx, sel, placed, target === 'background' ? 'background' : 'auto')
    } else if (target === 'favicon') {
      ops.ensureLink('link[rel~="icon"]', { rel: 'icon', href: placed.ref, type: mimeFromPath(placed.path) })
    } else {
      const root = project.site.siteRoot
      const rel = root && placed.path.startsWith(root + '/') ? placed.path.slice(root.length + 1) : placed.path
      const base = siteUrl.trim().replace(/\/+$/, '')
      const abs = base ? `${/^https?:\/\//i.test(base) ? base : 'https://' + base}/${rel}` : placed.ref
      ops.setMeta('og:image', abs, 'property')
      ops.setMeta('twitter:image', abs)
      if (!ops.getMeta('twitter:card')) ops.setMeta('twitter:card', 'summary_large_image')
      if (!base) ui.toast('info', 'Para que las redes la muestren, la imagen necesita la dirección completa de tu sitio.')
    }
    ui.closeDialog()
  }

  const pick = async (path: string) => {
    const placed = await loadRepoImage(ctx, path)
    if (!placed) return ui.toast('error', 'No se pudo cargar esa imagen.')
    apply(placed)
  }

  const upload = async (files: FileList | File[]) => {
    const f = Array.from(files)[0]
    if (!f) return
    const placed = await addImageFile(ctx, f)
    if (placed) apply(placed)
  }

  return (
    <Modal
      title={TITLES[target]}
      size="lg"
      onClose={ui.closeDialog}
      footer={
        <>
          <button className="btn ghost" onClick={ui.closeDialog}>
            Cancelar
          </button>
          <button className="btn primary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Subir una imagen
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (e.target.files && void upload(e.target.files), (e.target.value = ''))} />
        </>
      }
    >
      {target === 'og' && (
        <div className="field-block">
          <label className="field-label" htmlFor="site-url">
            Dirección de tu sitio
          </label>
          <input id="site-url" className="input mono" value={siteUrl} placeholder="https://tusitio.vercel.app" onChange={(e) => setSiteUrl(e.target.value)} spellCheck={false} />
          <p className="hint">WhatsApp, Facebook y X necesitan la dirección completa de la imagen, no solo su ruta.</p>
        </div>
      )}
      <label className="search wide">
        <Search size={14} />
        <input placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar imagen" />
      </label>
      <div
        className={'picker-grid' + (over ? ' over' : '')}
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
        {list.length === 0 && (
          <div className="panel-empty">
            <ImagePlus size={24} />
            <p>{images.length ? 'Ninguna imagen coincide.' : 'Aún no hay imágenes. Sube una o arrástrala aquí.'}</p>
          </div>
        )}
        {list.map((p) => (
          <button key={p} className="picker-tile" onClick={() => void pick(p)} title={p}>
            <Thumb project={project} path={p} />
            <span>{basename(p)}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
