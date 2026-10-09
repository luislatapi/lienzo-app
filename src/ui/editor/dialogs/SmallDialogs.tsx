import { useEffect, useState } from 'react'
import { Check, GitBranch, Loader2, Plus, TriangleAlert } from 'lucide-react'
import { errorMessage } from '../../../lib/git/errors'
import { useUI } from '../../../store/ui'
import { Modal } from '../../kit'
import { navigate } from '../../route'
import { useEditor } from '../context'
import { useDeploy } from '../deploy'
import { defaultDraftName } from './PublishDialog'

// ── conflicto ───────────────────────────────────────────────────────────────
interface ConflictData {
  paths: string[]
  message: string
  kind?: string
  draftName?: string
}

export function ConflictDialog() {
  const { project, controller } = useEditor()
  const ui = useUI()
  const data = (useUI((s) => s.dialogData) as ConflictData | null) ?? { paths: [], message: 'Actualiza el sitio' }
  const [busy, setBusy] = useState<'draft' | 'overwrite' | 'discard' | null>(null)
  const [error, setError] = useState('')

  const finish = (text: string) => {
    ui.closeDialog()
    ui.toast('ok', text)
  }

  const saveDraft = async () => {
    setBusy('draft')
    setError('')
    try {
      await project.startBranch(data.draftName || defaultDraftName())
      const res = await controller.save(data.message)
      useDeploy.getState().begin(res.sha, res.branch)
      finish(`Tus cambios se guardaron en la rama ${res.branch}.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const overwrite = async () => {
    setBusy('overwrite')
    setError('')
    try {
      const res = await controller.save(data.message, { overwrite: true })
      useDeploy.getState().begin(res.sha, res.branch)
      finish('Listo: tus versiones reemplazaron a las de GitHub.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const discardTheirs = async () => {
    setBusy('discard')
    setError('')
    try {
      for (const p of data.paths) project.discard(p)
      await project.reload(true)
      await controller.reloadCurrent()
      ui.openDialog('publish', { message: data.message })
      ui.toast('info', 'Traje los cambios nuevos de GitHub. Revisa tu página y vuelve a publicar.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      title="Alguien cambió estos archivos en GitHub"
      onClose={() => !busy && ui.closeDialog()}
      size="lg"
      footer={
        <button className="btn ghost" onClick={() => ui.closeDialog()} disabled={!!busy}>
          Cancelar
        </button>
      }
    >
      <p>
        Mientras editabas, otra persona (o una herramienta) modificó {data.paths.length === 1 ? 'este archivo' : 'estos archivos'} en el repositorio. Para no pisar su trabajo
        sin querer, no publiqué nada todavía.
      </p>
      <ul className="conflict-files">
        {data.paths.slice(0, 8).map((p) => (
          <li key={p} className="mono">
            {p}
          </li>
        ))}
        {data.paths.length > 8 && <li className="muted">y {data.paths.length - 8} más…</li>}
      </ul>
      <div className="option-list">
        <button className="option" onClick={saveDraft} disabled={!!busy}>
          <span className="option-icon">{busy === 'draft' ? <Loader2 size={16} className="spin" /> : <GitBranch size={16} />}</span>
          <span>
            <b>Guardar mis cambios en una rama aparte</b>
            <small>La opción más segura. No cambia tu sitio en vivo; después puedes unir las dos versiones en GitHub.</small>
          </span>
        </button>
        <button className="option" onClick={overwrite} disabled={!!busy}>
          <span className="option-icon">{busy === 'overwrite' ? <Loader2 size={16} className="spin" /> : <Check size={16} />}</span>
          <span>
            <b>Usar mi versión de esos archivos</b>
            <small>Reemplaza lo que cambió en GitHub por lo que editaste aquí. Lo demás se conserva.</small>
          </span>
        </button>
        <button className="option" onClick={discardTheirs} disabled={!!busy}>
          <span className="option-icon">{busy === 'discard' ? <Loader2 size={16} className="spin" /> : <TriangleAlert size={16} />}</span>
          <span>
            <b>Quedarme con la versión de GitHub</b>
            <small>Descarta mis cambios en esos archivos y trae lo nuevo. Mis cambios en otros archivos se conservan.</small>
          </span>
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}

// ── salir con cambios ───────────────────────────────────────────────────────
export function LeaveDialog() {
  const ui = useUI()
  return (
    <Modal
      title="Tienes cambios sin publicar"
      onClose={ui.closeDialog}
      size="sm"
      footer={
        <>
          <button className="btn ghost danger" onClick={() => (ui.closeDialog(), navigate('#/'))}>
            Salir sin guardar
          </button>
          <button className="btn" onClick={ui.closeDialog}>
            Seguir editando
          </button>
          <button className="btn primary" onClick={() => ui.openDialog('publish')}>
            Publicar…
          </button>
        </>
      }
    >
      <p>Si sales ahora, se perderán los cambios que todavía no publicaste.</p>
    </Modal>
  )
}

// ── atajos ──────────────────────────────────────────────────────────────────
const SHORTCUTS: Array<[string, string]> = [
  ['Doble clic en un texto', 'Escribir directamente en la página'],
  ['Doble clic en una imagen', 'Cambiar la imagen'],
  ['Clic derecho', 'Menú del elemento'],
  ['Ctrl + S', 'Publicar o guardar'],
  ['Ctrl + Z', 'Deshacer'],
  ['Ctrl + Mayús + Z  /  Ctrl + Y', 'Rehacer'],
  ['Ctrl + D', 'Duplicar el elemento'],
  ['Ctrl + C / X / V', 'Copiar, cortar y pegar elemento'],
  ['Supr', 'Eliminar el elemento'],
  ['Alt + ↑ / ↓', 'Mover el elemento'],
  ['Enter', 'Empezar a escribir en el texto seleccionado'],
  ['Esc', 'Salir del texto o quitar la selección'],
  ['?', 'Ver esta lista'],
]

export function ShortcutsDialog() {
  const ui = useUI()
  return (
    <Modal title="Atajos de teclado" onClose={ui.closeDialog} footer={<button className="btn primary" onClick={ui.closeDialog}>Entendido</button>}>
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k}>
              <th>
                <kbd>{k}</kbd>
              </th>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}

// ── ramas ───────────────────────────────────────────────────────────────────
export function BranchDialog() {
  const { project, controller, engine } = useEditor()
  const ui = useUI()
  const [branches, setBranches] = useState<string[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const unsaved = controller.hasUnsaved

  useEffect(() => {
    let alive = true
    project.provider
      .listBranches(project.repo.owner, project.repo.name)
      .then((b) => alive && setBranches(b))
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [project])

  const switchTo = async (branch: string) => {
    if (unsaved && confirm !== branch) return setConfirm(branch)
    setBusy(true)
    setError('')
    try {
      engine.markSaved()
      await project.switchBranch(branch)
      const page = project.has(engine.pagePath) ? engine.pagePath : project.site.pages[0]
      if (page) await controller.openPage(page)
      ui.closeDialog()
      ui.toast('ok', `Ahora trabajas en ${branch}.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    const n = name.trim().replace(/\s+/g, '-')
    if (!/^[\w./-]+$/.test(n)) return setError('Usa letras, números, guiones o diagonales en el nombre de la rama.')
    setBusy(true)
    setError('')
    try {
      await controller.commitCurrentPage()
      await project.startBranch(n)
      ui.closeDialog()
      ui.toast('ok', `Creé la rama ${n}. Tus cambios siguen aquí; publícalos cuando quieras.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Ramas de trabajo" onClose={() => !busy && ui.closeDialog()} footer={<button className="btn" onClick={ui.closeDialog} disabled={busy}>Cerrar</button>}>
      <p className="muted">
        Una rama es una copia de tu sitio para probar cambios sin afectar la versión en vivo (<span className="mono">{project.repo.defaultBranch}</span>).
      </p>
      <div className="branch-list">
        {branches === null && !error && <Loader2 className="spin" size={16} />}
        {branches?.map((b) => (
          <div key={b} className={'branch-row' + (b === project.branch ? ' on' : '')}>
            <GitBranch size={13} />
            <span className="mono">{b}</span>
            {b === project.repo.defaultBranch && <span className="chip">principal</span>}
            {b === project.branch ? (
              <span className="chip ok">
                <Check size={11} /> actual
              </span>
            ) : confirm === b ? (
              <button className="btn small danger" onClick={() => switchTo(b)} disabled={busy}>
                Cambiar y descartar mis cambios
              </button>
            ) : (
              <button className="btn small" onClick={() => switchTo(b)} disabled={busy}>
                Cambiar
              </button>
            )}
          </div>
        ))}
      </div>
      {unsaved && <p className="hint warn"><TriangleAlert size={12} /> Tienes cambios sin publicar: se perderán si cambias de rama. Para conservarlos, crea una rama nueva.</p>}
      <div className="field-block">
        <label className="field-label">Crear una rama nueva desde aquí</label>
        <div className="input-row">
          <input className="input mono" value={name} placeholder="mi-prueba" aria-label="Nombre de la rama nueva" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()} spellCheck={false} />
          <button className="btn" onClick={create} disabled={busy || !name.trim()}>
            <Plus size={14} /> Crear
          </button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
