import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { errorMessage } from '../../../lib/git/errors'
import { blankPage, copyOfPage, countLinksTo, pagePathFromName, relinkPage, starterPage } from '../../../lib/site/pages'
import { basename, joinPath, uniquePath } from '../../../lib/site/paths'
import { useUI } from '../../../store/ui'
import { Modal } from '../../kit'
import { useEditor } from '../context'

type Mode = 'new' | 'copy' | 'rename' | 'delete'

function titleFromPath(p: string): string {
  const name = basename(p).replace(/\.html?$/i, '')
  const base = name === 'index' ? 'Inicio' : name.replace(/[-_]+/g, ' ')
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/** Crear, duplicar, renombrar o eliminar páginas. */
export function NewPageDialog() {
  const { engine, project, controller } = useEditor()
  const ui = useUI()
  const data = useUI((s) => s.dialogData) as { mode?: Exclude<Mode, 'new'>; from?: string } | null
  const mode: Mode = data?.mode ?? 'new'
  const from = data?.from ?? engine.pagePath
  const [name, setName] = useState(mode === 'rename' ? titleFromPath(from) : mode === 'copy' ? `${titleFromPath(from)} copia` : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [links, setLinks] = useState<number | null>(null)

  const siteRoot = project.site.siteRoot
  const basePath = from || joinPath(siteRoot, 'index.html')
  const target = pagePathFromName(name || 'pagina', basePath)
  const finalPath = mode === 'rename' && target === from ? target : uniquePath(target, (p) => project.has(p))

  // cuántos enlaces apuntan a la página (para avisar al renombrar o eliminar)
  useEffect(() => {
    if (mode !== 'rename' && mode !== 'delete') return
    let alive = true
    ;(async () => {
      await controller.commitCurrentPage()
      let n = 0
      for (const p of project.site.pages) {
        if (p === from) continue
        const html = await project.tryReadText(p)
        if (html) n += countLinksTo(html, p, from, siteRoot)
      }
      if (alive) setLinks(n)
    })().catch(() => alive && setLinks(0))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await controller.commitCurrentPage()
      if (mode === 'delete') {
        project.remove(from)
        if (engine.pagePath === from) {
          const next = project.site.pages.find((p) => p !== from)
          if (next) await controller.openPage(next)
        }
        ui.toast('ok', `${basename(from)} se eliminará cuando publiques.`)
        return ui.closeDialog()
      }
      const title = name.trim()
      if (!title) throw new Error('Escribe un nombre para la página.')
      if (mode === 'rename') {
        if (finalPath === from) return ui.closeDialog()
        const html = await project.readText(from)
        if (html === null) throw new Error(`No se encontró ${from}.`)
        project.writeText(finalPath, html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</title>`))
        project.remove(from)
        const skipped: string[] = []
        for (const p of project.site.pages) {
          if (p === from || p === finalPath) continue
          const other = await project.tryReadText(p)
          if (other === null) {
            skipped.push(p)
            continue
          }
          const next = relinkPage(other, p, from, finalPath, siteRoot)
          if (next !== other) project.writeText(p, next)
        }
        if (skipped.length) ui.toast('info', `No se actualizaron los enlaces de ${skipped.join(', ')}: ${skipped.length === 1 ? 'no está' : 'no están'} en UTF-8.`)
        await controller.openPage(engine.pagePath === from ? finalPath : engine.pagePath)
        ui.toast('ok', `La página ahora es ${basename(finalPath)}.`)
        return ui.closeDialog()
      }
      const source = from ? await project.readText(from) : null
      const html =
        mode === 'copy' && source !== null
          ? copyOfPage(source, from, finalPath, siteRoot, title)
          : source !== null
            ? blankPage(source, from, finalPath, siteRoot, title)
            : starterPage(title)
      project.writeText(finalPath, html)
      await controller.openPage(finalPath)
      ui.toast('ok', `Página “${title}” creada. Aún no está publicada.`)
      ui.closeDialog()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const heading = { new: 'Nueva página', copy: 'Duplicar página', rename: 'Cambiar nombre de la página', delete: 'Eliminar página' }[mode]
  const action = { new: 'Crear página', copy: 'Duplicar', rename: 'Cambiar nombre', delete: 'Eliminar página' }[mode]

  return (
    <Modal
      title={heading}
      size="sm"
      onClose={() => !busy && ui.closeDialog()}
      footer={
        <>
          <button className="btn ghost" onClick={ui.closeDialog} disabled={busy}>
            Cancelar
          </button>
          <button className={'btn ' + (mode === 'delete' ? 'danger' : 'primary')} onClick={run} disabled={busy || (mode !== 'delete' && !name.trim())}>
            {busy && <Loader2 size={14} className="spin" />}
            {action}
          </button>
        </>
      }
    >
      {mode === 'delete' ? (
        <>
          <p>
            ¿Eliminar <b className="mono">{from}</b>? El archivo se borrará del repositorio cuando publiques. Siempre podrás recuperarlo desde el historial de GitHub.
          </p>
          {links !== null && links > 0 && (
            <p className="hint warn">
              Hay {links} enlace{links === 1 ? '' : 's'} en otras páginas que apuntan a esta; quedarán rotos.
            </p>
          )}
        </>
      ) : (
        <div className="field-block">
          <label className="field-label" htmlFor="page-name">
            {mode === 'rename' ? 'Nuevo nombre' : 'Nombre de la página'}
          </label>
          <input
            id="page-name"
            className="input"
            autoFocus
            value={name}
            placeholder="Ej. Contacto"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && !busy && run()}
          />
          <p className="hint">
            Archivo: <span className="mono">{finalPath}</span>
          </p>
          {mode === 'new' && <p className="hint">Usará el mismo diseño, encabezado y pie que la página actual.</p>}
          {mode === 'rename' && links !== null && links > 0 && <p className="hint">Actualizaré {links} enlace{links === 1 ? '' : 's'} en tus otras páginas.</p>}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
