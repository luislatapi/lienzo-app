import { Copy, FilePlus2, Home, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { errorMessage } from '../../../lib/git/errors'
import { basename } from '../../../lib/site/paths'
import { useUI } from '../../../store/ui'
import { Popover } from '../../kit'
import { useEditor, useEngineState, useProjectState } from '../context'

export function PagesPanel() {
  const { controller, engine } = useEditor()
  useEngineState()
  const project = useProjectState()
  const ui = useUI()
  const open = (p: string) => controller.openPage(p).catch((e) => ui.toast('error', errorMessage(e)))

  return (
    <div className="panel">
      <header className="panel-head">
        <h3>Páginas</h3>
        <p>Cada archivo .html de tu sitio es una página.</p>
      </header>
      <div className="panel-actions">
        <button className="btn small" onClick={() => ui.openDialog('new-page')}>
          <FilePlus2 size={14} /> Nueva página
        </button>
      </div>
      <div className="panel-scroll">
        {project.site.pages.length === 0 && (
          <p className="panel-empty">
            {project.site.framework
              ? `Este repositorio es una app de ${project.site.framework}. Lienzo edita sitios hechos con archivos HTML; puedes usar “Archivos” para modificar el código.`
              : 'No encontramos archivos .html en este repositorio. Crea una página nueva para empezar.'}
          </p>
        )}
        {project.site.pages.map((p) => (
          <div key={p} className={'file-row' + (p === engine.pagePath ? ' active' : '')}>
            <button className="file-main" onClick={() => open(p)}>
              {p === 'index.html' ? <Home size={14} /> : <span className="file-dot" />}
              <span className="file-name">
                <b>{p === 'index.html' ? 'Inicio' : basename(p)}</b>
                <small className="mono">{p}</small>
              </span>
              {project.isModified(p) && <i className="dot-mod" title="Con cambios sin publicar" />}
            </button>
            <Popover
              align="right"
              width={200}
              trigger={({ toggle }) => (
                <button className="icon-btn" onClick={toggle} aria-label={`Opciones de ${p}`}>
                  <MoreHorizontal size={15} />
                </button>
              )}
            >
              {(close) => (
                <div className="menu">
                  <button
                    className="menu-item"
                    onClick={() => {
                      close()
                      ui.openDialog('new-page', { mode: 'copy', from: p })
                    }}
                  >
                    <Copy size={14} /> Duplicar
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      close()
                      ui.openDialog('new-page', { mode: 'rename', from: p })
                    }}
                  >
                    <Pencil size={14} /> Cambiar nombre
                  </button>
                  <div className="menu-sep" />
                  <button
                    className="menu-item danger"
                    disabled={project.site.pages.length <= 1}
                    onClick={() => {
                      close()
                      ui.openDialog('new-page', { mode: 'delete', from: p })
                    }}
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              )}
            </Popover>
          </div>
        ))}
      </div>
    </div>
  )
}
