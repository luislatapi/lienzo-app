import { useEffect, useState } from 'react'
import { ArrowUpRight, CheckCircle2, GitBranch, GitPullRequest, Loader2, Rocket, TriangleAlert } from 'lucide-react'
import { ConflictError, errorMessage } from '../../../lib/git/errors'
import type { CommitChange } from '../../../lib/git/types'
import { basename } from '../../../lib/site/paths'
import { useUI } from '../../../store/ui'
import { Modal } from '../../kit'
import { useEditor } from '../context'
import { useDeploy } from '../deploy'

type Kind = 'publish' | 'draft' | 'branch' | 'branch-publish'

interface Done {
  kind: Kind
  sha: string
  branch: string
  files: number
}

export function defaultDraftName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `lienzo/borrador-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export function describeChanges(changes: CommitChange[]): string {
  if (changes.length === 1) {
    const c = changes[0]
    return `${c.delete ? 'Elimina' : 'Edita'} ${basename(c.path)}`
  }
  const pages = changes.filter((c) => /\.html?$/i.test(c.path))
  if (pages.length === 1 && changes.length <= 4) return `Edita ${basename(pages[0].path)} y ${changes.length - 1} archivo${changes.length - 1 === 1 ? '' : 's'} más`
  return `Actualiza ${changes.length} archivos`
}

const STATUS = { new: 'Nuevo', mod: 'Editado', del: 'Eliminado' } as const

export function PublishDialog() {
  const { project, controller } = useEditor()
  const ui = useUI()
  const dialogData = useUI((s) => s.dialogData) as { kind?: Kind; message?: string; draftName?: string } | null
  const isDefault = project.branch === project.repo.defaultBranch
  const [changes, setChanges] = useState<CommitChange[] | null>(null)
  const [message, setMessage] = useState(dialogData?.message ?? '')
  const [touched, setTouched] = useState(!!dialogData?.message)
  const [mode, setMode] = useState<'publish' | 'draft'>(isDefault && !project.protectedBranch ? 'publish' : 'draft')
  const [draftName, setDraftName] = useState(dialogData?.draftName ?? defaultDraftName())
  const [busy, setBusy] = useState<Kind | 'merge' | 'pr' | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const live = useDeploy((s) => s.liveUrl)
  const demo = project.provider.kind === 'demo'

  useEffect(() => {
    let alive = true
    controller
      .commitCurrentPage()
      .then(() => project.collectChanges())
      .then((c) => {
        if (!alive) return
        setChanges(c)
        if (!touched) setMessage(c.length ? describeChanges(c) : '')
      })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    if (!busy) ui.closeDialog()
  }
  const finalMessage = message.trim() || (changes ? describeChanges(changes) : 'Actualiza el sitio')
  const canPush = project.repo.canPush

  const run = async (kind: Kind) => {
    setBusy(kind)
    setError('')
    try {
      if (kind === 'draft') await project.startBranch(draftName.trim() || defaultDraftName())
      const res = await controller.save(finalMessage)
      let target = res.branch
      if (kind === 'branch-publish') {
        target = await mergeIntoDefault(res.branch)
      } else {
        useDeploy.getState().begin(res.sha, res.branch)
      }
      setDone({ kind, sha: project.headSha || res.sha, branch: target, files: res.files })
    } catch (e) {
      if (e instanceof ConflictError) {
        ui.openDialog('conflict', { paths: e.paths, message: finalMessage, kind, draftName })
        return
      }
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const mergeIntoDefault = async (from: string): Promise<string> => {
    const base = project.repo.defaultBranch
    await project.provider.mergeBranch(project.repo.owner, project.repo.name, base, from, finalMessage)
    await project.switchBranch(base)
    await controller.reloadCurrent()
    useDeploy.getState().begin(project.headSha, base)
    return base
  }

  const publishDraftNow = async () => {
    if (!done) return
    setBusy('merge')
    setError('')
    try {
      const branch = await mergeIntoDefault(done.branch)
      setDone({ ...done, kind: 'publish', branch })
    } catch (e) {
      setError(`No se pudo unir automáticamente con la rama principal. ${errorMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const openPullRequest = async () => {
    if (!done) return
    setBusy('pr')
    setError('')
    try {
      const pr = await project.provider.createPullRequest(project.repo.owner, project.repo.name, {
        title: finalMessage,
        head: done.branch,
        base: project.repo.defaultBranch,
        body: 'Cambios hechos con Lienzo.',
      })
      ui.toast('ok', `Pull request #${pr.number} creada.`)
      if (!demo && pr.url) window.open(pr.url, '_blank', 'noopener')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  // ── resultado ──────────────────────────────────────────────────────────
  if (done) {
    const isDraft = done.branch !== project.repo.defaultBranch
    return (
      <Modal
        title={isDraft ? 'Borrador guardado' : 'Publicado'}
        onClose={close}
        footer={
          <>
            {isDraft && (
              <>
                <button className="btn" onClick={openPullRequest} disabled={!!busy}>
                  {busy === 'pr' ? <Loader2 size={14} className="spin" /> : <GitPullRequest size={14} />} Crear Pull Request
                </button>
                <button className="btn primary" onClick={publishDraftNow} disabled={!!busy}>
                  {busy === 'merge' ? <Loader2 size={14} className="spin" /> : <Rocket size={14} />} Publicar ahora
                </button>
              </>
            )}
            {!isDraft && (
              <button className="btn primary" onClick={close}>
                Listo
              </button>
            )}
          </>
        }
      >
        <div className="done-box">
          <CheckCircle2 size={34} color="var(--ok)" />
          <h3>{isDraft ? 'Tus cambios están a salvo en GitHub' : 'Tus cambios ya están en GitHub'}</h3>
          <p>
            {done.files} archivo{done.files === 1 ? '' : 's'} en <b className="mono">{done.branch}</b>
            {done.sha && (
              <>
                {' · '}
                {demo ? (
                  <span className="mono">{done.sha.slice(0, 7)}</span>
                ) : (
                  <a className="mono" href={`${project.repo.htmlUrl}/commit/${done.sha}`} target="_blank" rel="noreferrer">
                    {done.sha.slice(0, 7)} <ArrowUpRight size={11} />
                  </a>
                )}
              </>
            )}
          </p>
          {isDraft ? (
            <p className="muted">
              Vercel prepara una vista previa de esta rama aparte. Tu sitio en vivo <b>no cambió</b> todavía. Cuando estés listo, publícalo.
            </p>
          ) : (
            <p className="muted">
              Vercel está construyendo tu sitio; normalmente tarda menos de un minuto. Verás el avance arriba, junto al botón de publicar.
              {live && !demo && (
                <>
                  {' '}
                  <a href={live} target="_blank" rel="noreferrer">
                    Abrir el sitio <ArrowUpRight size={11} />
                  </a>
                </>
              )}
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
      </Modal>
    )
  }

  const nothing = changes !== null && changes.length === 0
  const shown = (changes ?? []).slice(0, 10)
  const status = (c: CommitChange) => (c.delete ? 'del' : project.tree.has(c.path) ? 'mod' : 'new')

  return (
    <Modal
      title={isDefault ? 'Publicar cambios' : 'Guardar cambios'}
      onClose={close}
      footer={
        <>
          <button className="btn ghost" onClick={close} disabled={!!busy}>
            Cancelar
          </button>
          {!isDefault && (
            <button className="btn" disabled={!!busy || nothing || changes === null || !canPush} onClick={() => run('branch-publish')}>
              {busy === 'branch-publish' ? <Loader2 size={14} className="spin" /> : <Rocket size={14} />} Guardar y publicar
            </button>
          )}
          <button
            className="btn primary"
            disabled={!!busy || nothing || changes === null || !canPush}
            onClick={() => run(isDefault ? (mode === 'publish' ? 'publish' : 'draft') : 'branch')}
          >
            {busy && busy !== 'merge' && busy !== 'pr' && busy !== 'branch-publish' ? <Loader2 size={14} className="spin" /> : <Rocket size={14} />}
            {isDefault ? (mode === 'publish' ? 'Publicar en el sitio' : 'Guardar borrador') : `Guardar en ${project.branch}`}
          </button>
        </>
      }
    >
      {!canPush && (
        <p className="form-error">
          <TriangleAlert size={14} /> Tu cuenta no tiene permiso para escribir en este repositorio. Pide acceso de escritura o usa un token con permiso “Contents: write”.
        </p>
      )}
      <div className="changes">
        <h4>
          {changes === null ? 'Revisando cambios…' : nothing ? 'No hay cambios por publicar' : `${changes.length} archivo${changes.length === 1 ? '' : 's'} con cambios`}
        </h4>
        {changes === null && <Loader2 className="spin" size={16} />}
        {nothing && <p className="muted">Edita algo en la página y vuelve a intentarlo.</p>}
        <ul>
          {shown.map((c) => (
            <li key={c.path}>
              <span className={'st ' + status(c)}>{STATUS[status(c)]}</span>
              <span className="mono">{c.path}</span>
            </li>
          ))}
          {changes && changes.length > shown.length && <li className="muted">y {changes.length - shown.length} más…</li>}
        </ul>
      </div>

      <div className="field-block">
        <label className="field-label" htmlFor="commit-msg">
          Descripción del cambio
        </label>
        <input
          id="commit-msg"
          className="input"
          value={message}
          placeholder={changes ? describeChanges(changes) : 'Qué cambiaste'}
          onChange={(e) => {
            setMessage(e.target.value)
            setTouched(true)
          }}
          onKeyDown={(e) => e.key === 'Enter' && !busy && !nothing && changes && canPush && run(isDefault ? (mode === 'publish' ? 'publish' : 'draft') : 'branch')}
        />
        <p className="hint">Se guarda en el historial de GitHub para que puedas volver a esta versión.</p>
      </div>

      {isDefault && (
        <div className="field-block">
          <label className="field-label">¿Dónde guardar?</label>
          <div className="choice-list">
            <label className={'choice' + (mode === 'publish' ? ' on' : '')}>
              <input type="radio" name="mode" checked={mode === 'publish'} onChange={() => setMode('publish')} />
              <span>
                <b>Publicar en el sitio</b>
                <small>Se guarda en <span className="mono">{project.branch}</span> y Vercel actualiza tu sitio en vivo.</small>
              </span>
            </label>
            <label className={'choice' + (mode === 'draft' ? ' on' : '')}>
              <input type="radio" name="mode" checked={mode === 'draft'} onChange={() => setMode('draft')} />
              <span>
                <b>Guardar como borrador</b>
                <small>Crea una rama aparte. Vercel genera una vista previa y tu sitio en vivo no cambia.</small>
              </span>
            </label>
          </div>
          {mode === 'draft' && (
            <div className="draft-name">
              <GitBranch size={13} />
              <input className="input mono" value={draftName} onChange={(e) => setDraftName(e.target.value)} aria-label="Nombre de la rama" spellCheck={false} />
            </div>
          )}
          {project.protectedBranch && mode === 'publish' && (
            <p className="hint warn">
              <TriangleAlert size={12} /> La rama <span className="mono">{project.branch}</span> está protegida; si GitHub rechaza el cambio, guárdalo como borrador.
            </p>
          )}
        </div>
      )}
      {!isDefault && (
        <p className="hint">
          Estás trabajando en la rama <span className="mono">{project.branch}</span>. “Guardar y publicar” también la une con <span className="mono">{project.repo.defaultBranch}</span>.
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
