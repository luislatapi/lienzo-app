import { ChevronRight, Eye, MousePointerClick, Smartphone, Tablet } from 'lucide-react'
import { friendlyName, selectorLabel, type El } from '../../lib/editor/dom-utils'
import { useUI, type RightTab } from '../../store/ui'
import { useEditor, useEngineState } from './context'
import { AdvancedTab } from './inspector/AdvancedTab'
import { ContentTab } from './inspector/ContentTab'
import { StyleTab } from './inspector/StyleTab'

const TABS: Array<{ id: RightTab; label: string }> = [
  { id: 'style', label: 'Estilo' },
  { id: 'content', label: 'Contenido' },
  { id: 'advanced', label: 'Avanzado' },
]

/** Panel de la derecha: propiedades del elemento seleccionado. */
export function Inspector() {
  const { engine } = useEditor()
  useEngineState()
  const { rightTab, setRightTab, preview, setPreview } = useUI()
  const el = engine.loaded ? engine.selected : null

  if (preview) {
    return (
      <aside className="inspector" aria-label="Propiedades">
        <div className="insp-empty">
          <Eye size={26} />
          <strong>Estás en la vista previa</strong>
          <p>Aquí tu página funciona como en internet: los scripts, las animaciones y los enlaces entre páginas están activos. Nada de lo que hagas aquí se guarda.</p>
          <button className="btn small primary" onClick={() => setPreview(false)}>
            Volver a editar
          </button>
        </div>
      </aside>
    )
  }

  if (!el) {
    return (
      <aside className="inspector" aria-label="Propiedades">
        <div className="insp-empty">
          <MousePointerClick size={26} />
          <strong>Elige algo para editarlo</strong>
          <p>Haz clic en cualquier texto, imagen o sección de la página. Aquí aparecerán sus opciones.</p>
          <ul>
            <li>
              <kbd>Doble clic</kbd> en un texto para escribir
            </li>
            <li>
              <kbd>Doble clic</kbd> en una imagen para cambiarla
            </li>
            <li>
              Arrastra desde <b>Añadir</b> para insertar secciones
            </li>
          </ul>
          {engine.loaded && (
            <button className="btn small" onClick={() => engine.body && engine.select(engine.body as El)}>
              Editar la página completa
            </button>
          )}
        </div>
      </aside>
    )
  }

  const crumbs: El[] = []
  for (let p: El | null = el; p && p !== (engine.doc?.documentElement as unknown); p = p.parentElement as El | null) crumbs.unshift(p)
  const shown = crumbs.length > 4 ? crumbs.slice(-4) : crumbs

  return (
    <aside className="inspector" aria-label="Propiedades">
      <header className="insp-head">
        <div className="insp-title">
          <strong>{friendlyName(el)}</strong>
          <span className="mono">{selectorLabel(el)}</span>
        </div>
        <nav className="crumbs" aria-label="Ruta del elemento">
          {crumbs.length > shown.length && <span className="crumb-more">…</span>}
          {shown.map((c, i) => (
            <span key={i} className="crumb-wrap">
              {i > 0 && <ChevronRight size={11} />}
              <button className={'crumb' + (c === el ? ' on' : '')} onClick={() => engine.select(c)} title={selectorLabel(c)}>
                {c === engine.body ? 'Página' : friendlyName(c)}
              </button>
            </span>
          ))}
        </nav>
      </header>

      {engine.device !== 'desktop' && (
        <div className="device-note" role="note">
          {engine.device === 'tablet' ? <Tablet size={14} /> : <Smartphone size={14} />}
          <span>
            Los cambios de estilo solo afectan a {engine.device === 'tablet' ? 'tablets (hasta 991 px)' : 'móviles (hasta 767 px)'}.
          </span>
          <button onClick={() => engine.setDevice('desktop')}>Escritorio</button>
        </div>
      )}

      <div className="insp-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={rightTab === t.id} className={rightTab === t.id ? 'on' : ''} onClick={() => setRightTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="insp-body" key={`${engine.idOf(el)}:${engine.device}`}>
        {rightTab === 'style' && <StyleTab />}
        {rightTab === 'content' && <ContentTab />}
        {rightTab === 'advanced' && <AdvancedTab />}
      </div>
    </aside>
  )
}
