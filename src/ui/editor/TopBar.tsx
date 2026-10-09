import {
  ArrowLeft,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  Eye,
  FilePlus2,
  GitBranch,
  Loader2,
  Monitor,
  Redo2,
  Rocket,
  Smartphone,
  Tablet,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { errorMessage } from '../../lib/git/errors'
import type { Device } from '../../lib/editor/engine'
import { basename } from '../../lib/site/paths'
import { useUI } from '../../store/ui'
import { LogoMark } from '../icons'
import { Popover } from '../kit'
import { navigate } from '../route'
import { useEditor, useEngineState, useProjectState } from './context'
import { useDeploy } from './deploy'

const DEVICES: Array<{ id: Device; label: string; icon: typeof Monitor; hint: string }> = [
  { id: 'desktop', label: 'Escritorio', icon: Monitor, hint: 'Escritorio' },
  { id: 'tablet', label: 'Tablet', icon: Tablet, hint: 'Tablet (hasta 991 px)' },
  { id: 'mobile', label: 'Móvil', icon: Smartphone, hint: 'Móvil (hasta 767 px)' },
]

export function TopBar() {
  const { engine, controller } = useEditor()
  useEngineState()
  const project = useProjectState()
  const ui = useUI()
  const pending = project.working.size + (engine.dirty && !project.working.has(engine.pagePath) ? 1 : 0)
  const isProd = project.branch === project.repo.defaultBranch

  const goBack = () => {
    if (controller.hasUnsaved) ui.openDialog('leave')
    else navigate('#/')
  }

  const openPage = (path: string) => {
    controller.openPage(path).catch((e) => ui.toast('error', errorMessage(e)))
  }

  return (
    <header className="topbar">
      <div className="tb-left">
        <button className="icon-btn" onClick={goBack} title="Volver a mis sitios" aria-label="Volver a mis sitios">
          <ArrowLeft size={17} />
        </button>
        <LogoMark size={22} />
        <div className="tb-repo">
          <b>{project.repo.name}</b>
          <button className={'branch-chip' + (isProd ? '' : ' draft')} onClick={() => ui.openDialog('branch')} title="Rama de trabajo">
            <GitBranch size={12} /> {project.branch}
          </button>
        </div>
        <Popover
          trigger={({ toggle }) => (
            <button className="btn small page-select" onClick={toggle} aria-label="Cambiar de página">
              {engine.pagePath ? basename(engine.pagePath) : 'Sin páginas'}
              <ChevronDown size={13} />
            </button>
          )}
          width={280}
        >
          {(close) => (
            <div className="menu">
              <div className="menu-title">Páginas del sitio</div>
              {project.site.pages.map((p) => (
                <button
                  key={p}
                  className={'menu-item' + (p === engine.pagePath ? ' active' : '')}
                  onClick={() => {
                    close()
                    if (p !== engine.pagePath) openPage(p)
                  }}
                >
                  <span className="mono">{p}</span>
                  {project.isModified(p) && <i className="dot-mod" title="Con cambios sin publicar" />}
                  {p === engine.pagePath && <Check size={13} />}
                </button>
              ))}
              {project.site.pages.length === 0 && <div className="menu-empty">Este repositorio no tiene archivos .html.</div>}
              <div className="menu-sep" />
              <button
                className="menu-item"
                onClick={() => {
                  close()
                  ui.openDialog('new-page')
                }}
              >
                <FilePlus2 size={14} /> Nueva página…
              </button>
            </div>
          )}
        </Popover>
      </div>

      <div className="tb-center">
        <div className="device-switch" role="group" aria-label="Tamaño de pantalla">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              className={'icon-btn' + (engine.device === d.id ? ' active' : '')}
              onClick={() => engine.setDevice(d.id)}
              title={d.hint}
              aria-label={d.label}
              aria-pressed={engine.device === d.id}
            >
              <d.icon size={16} />
            </button>
          ))}
        </div>
        <select
          className="select zoom-select"
          value={String(ui.zoom)}
          onChange={(e) => ui.setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
          aria-label="Zoom"
        >
          <option value="fit">Ajustar</option>
          <option value="0.5">50 %</option>
          <option value="0.75">75 %</option>
          <option value="1">100 %</option>
        </select>
        <div className="tb-sep-v" />
        <button className="icon-btn" disabled={!engine.history.canUndo} onClick={() => engine.undo()} title="Deshacer (Ctrl + Z)" aria-label="Deshacer">
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" disabled={!engine.history.canRedo} onClick={() => engine.redo()} title="Rehacer (Ctrl + Mayús + Z)" aria-label="Rehacer">
          <Redo2 size={16} />
        </button>
      </div>

      <div className="tb-right">
        <DeployChip />
        <button className={'btn small' + (ui.preview ? ' primary' : '')} onClick={() => ui.setPreview(!ui.preview)} title="Vista previa con scripts">
          <Eye size={14} /> Vista previa
        </button>
        <button className="btn small" onClick={() => ui.openDialog('code')} title="Ver y editar el código de la página">
          <Code2 size={14} /> Código
        </button>
        <button className="btn primary" onClick={() => ui.openDialog('publish')}>
          <Rocket size={15} />
          {isProd ? 'Publicar' : 'Guardar'}
          {pending > 0 && <span className="badge">{pending}</span>}
        </button>
      </div>
    </header>
  )
}

function DeployChip() {
  const { project } = useEditor()
  const { watch, info, liveUrl } = useDeploy()
  const demo = project.provider.kind === 'demo'
  if (watch && info) {
    if (info.state === 'pending')
      return (
        <span className="chip rosa" role="status">
          <Loader2 size={12} className="spin" /> Desplegando en Vercel…
        </span>
      )
    if (info.state === 'success')
      return (
        <a className="chip ok" href={demo ? undefined : info.url} target="_blank" rel="noreferrer" role="status" title={info.description}>
          <Check size={12} /> {demo ? 'Publicado (simulado)' : 'Publicado'}
          {info.url && !demo && <ExternalLink size={11} />}
        </a>
      )
    if (info.state === 'failure')
      return (
        <a className="chip bad" href={info.inspectorUrl} target="_blank" rel="noreferrer" role="status" title={info.description}>
          <TriangleAlert size={12} /> Falló el despliegue
        </a>
      )
    return (
      <span className="chip" role="status" title={info.description}>
        <Check size={12} /> Guardado en GitHub
      </span>
    )
  }
  if (liveUrl && !demo)
    return (
      <a className="chip ok" href={liveUrl} target="_blank" rel="noreferrer" title="Abrir el sitio publicado">
        En línea <ExternalLink size={11} />
      </a>
    )
  return null
}
