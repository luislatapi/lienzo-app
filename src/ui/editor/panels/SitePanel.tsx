import { useEffect, useState } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { relativeRef } from '../../../lib/site/paths'
import { useUI } from '../../../store/ui'
import { Row, Section } from '../../kit'
import { useEditor, useEngineState } from '../context'
import { ThemePanel } from './ThemePanel'

/** Datos de la página que ven Google y las redes sociales + diseño global del sitio. */
export function SitePanel() {
  const { engine } = useEditor()
  useEngineState()
  const ui = useUI()

  if (!engine.loaded || !engine.doc) {
    return (
      <div className="panel">
        <header className="panel-head">
          <h3>Sitio</h3>
        </header>
        <p className="panel-empty">Abre una página para editar sus datos.</p>
      </div>
    )
  }
  const ops = engine.ops
  const favicon = ops.getFavicon()
  const ogImage = ops.getMeta('og:image', 'property')

  const pickImage = (field: 'favicon' | 'og') =>
    ui.openDialog('image-picker', { target: field })

  return (
    <div className="panel">
      <header className="panel-head">
        <h3>Sitio</h3>
        <p>Datos de esta página y diseño de todo el sitio.</p>
      </header>
      <div className="panel-scroll">
        <Section title="Datos de la página">
          <TextRow label="Título de la pestaña" value={ops.getTitle()} onChange={(v) => ops.setTitle(v)} max={70} />
          <TextRow
            label="Descripción para Google"
            value={ops.getMeta('description')}
            onChange={(v) => {
              ops.setMeta('description', v)
              ops.setMeta('og:description', v, 'property')
            }}
            multiline
            max={160}
          />
          <Row label="Idioma">
            <select className="select" value={ops.getLang() || ''} onChange={(e) => ops.setLang(e.target.value)} aria-label="Idioma">
              <option value="">Sin definir</option>
              <option value="es">Español</option>
              <option value="es-MX">Español (México)</option>
              <option value="en">Inglés</option>
              <option value="pt">Portugués</option>
              <option value="fr">Francés</option>
            </select>
          </Row>
        </Section>

        <Section title="Imágenes">
          <ImageRow label="Ícono de la pestaña" value={favicon} onPick={() => pickImage('favicon')} onClear={() => ops.setFavicon('')} />
          <ImageRow
            label="Imagen al compartir"
            value={ogImage}
            onPick={() => pickImage('og')}
            onClear={() => {
              ops.setMeta('og:image', '', 'property')
              ops.setMeta('twitter:image', '')
            }}
          />
          <p className="hint">La imagen al compartir se ve cuando alguien manda tu enlace por WhatsApp, Facebook o X.</p>
        </Section>

        <ThemePanel />
      </div>
    </div>
  )
}

function TextRow({
  label,
  value,
  onChange,
  multiline,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  max?: number
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  const commit = (v: string) => {
    setLocal(v)
    onChange(v)
  }
  return (
    <div className="field-block">
      <label className="field-label">
        {label}
        {max && <small className={local.length > max ? 'over' : ''}>{local.length}/{max}</small>}
      </label>
      {multiline ? (
        <textarea className="textarea" rows={3} value={local} onChange={(e) => commit(e.target.value)} aria-label={label} />
      ) : (
        <input className="input" value={local} onChange={(e) => commit(e.target.value)} aria-label={label} />
      )}
    </div>
  )
}

function ImageRow({ label, value, onPick, onClear }: { label: string; value: string; onPick: () => void; onClear: () => void }) {
  return (
    <div className="field-block">
      <label className="field-label">{label}</label>
      <div className="image-row">
        <button className="btn small" onClick={onPick}>
          <ImageIcon size={13} /> {value ? 'Cambiar' : 'Elegir imagen'}
        </button>
        {value && (
          <>
            <span className="mono image-row-path" title={value}>
              {value.split('/').pop()}
            </span>
            <button className="icon-btn" onClick={onClear} aria-label={`Quitar ${label.toLowerCase()}`}>
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export { relativeRef }
