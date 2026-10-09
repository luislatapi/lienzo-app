import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { El } from '../../../lib/editor/dom-utils'
import { errorMessage } from '../../../lib/git/errors'
import { basename, isCssPath } from '../../../lib/site/paths'
import { useUI } from '../../../store/ui'
import { Modal } from '../../kit'
import { useEditor } from '../context'

type Target = { mode: 'page' } | { mode: 'element'; el: El } | { mode: 'file'; path: string }

/** Editor de código: la página completa, un elemento o cualquier archivo de texto del repositorio. */
export function CodeDialog() {
  const { engine, project, controller } = useEditor()
  const ui = useUI()
  const data = useUI((s) => s.dialogData) as { path?: string; element?: boolean } | null
  const [target] = useState<Target>(() => {
    if (data?.element && engine.selected && engine.selected !== engine.body) return { mode: 'element', el: engine.selected }
    if (data?.path && data.path !== engine.pagePath) return { mode: 'file', path: data.path }
    return { mode: 'page' }
  })
  const [value, setValue] = useState<string | null>(null)
  const [initial, setInitial] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        let text: string
        if (target.mode === 'page') {
          // el archivo tal como quedaría guardado (con el formato original de tu código y tus cambios pendientes)
          engine.endTextEdit()
          await controller.commitCurrentPage()
          text = (await project.readText(engine.pagePath)) ?? engine.serialize()
        } else if (target.mode === 'element') text = engine.ops.cleanHtmlOf(target.el)
        else {
          const t = await project.readText(target.path)
          if (t === null) throw new Error(`No se encontró ${target.path}.`)
          text = t
        }
        if (alive) {
          setValue(text)
          setInitial(text)
        }
      } catch (e) {
        if (alive) setError(errorMessage(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [engine, project, controller, target])

  const title =
    target.mode === 'page' ? `Código de ${basename(engine.pagePath)}` : target.mode === 'element' ? 'Código del elemento' : basename(target.path)
  const changed = value !== null && value !== initial

  const save = async () => {
    if (value === null) return
    setBusy(true)
    setError('')
    try {
      if (target.mode === 'page') {
        await controller.reloadCurrent({ html: value, dirty: true })
        ui.toast('ok', 'Código aplicado a la página.')
      } else if (target.mode === 'element') {
        if (!target.el.isConnected) throw new Error('El elemento ya no está en la página.')
        engine.ops.replaceOuterHtml(target.el, value)
      } else {
        if (/\.json$/i.test(target.path)) {
          try {
            JSON.parse(value)
          } catch (e) {
            throw new Error(`El JSON no es válido: ${errorMessage(e)}`)
          }
        }
        project.writeText(target.path, value)
        if (isCssPath(target.path) && engine.hub && engine.doc) {
          for (const link of Array.from(engine.doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'))) {
            if (engine.hub.cssLinks.get(link.getAttribute('href') || '') === target.path) await engine.hub.replaceStylesheet(link, target.path, value)
          }
        }
        ui.toast('ok', `${basename(target.path)} guardado. Se publicará con el resto de tus cambios.`)
      }
      ui.closeDialog()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      size="xl"
      onClose={() => !busy && ui.closeDialog()}
      footer={
        <>
          <span className="foot-note">
            {target.mode === 'page' && 'Al aplicar se reinicia el historial de deshacer.'}
            {target.mode === 'file' && <span className="mono">{target.path}</span>}
          </span>
          <button className="btn ghost" onClick={ui.closeDialog} disabled={busy}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save} disabled={busy || !changed}>
            {busy && <Loader2 size={14} className="spin" />}
            {target.mode === 'file' ? 'Guardar archivo' : 'Aplicar'}
          </button>
        </>
      }
    >
      {value === null && !error && (
        <div className="code-loading">
          <Loader2 className="spin" size={18} /> Cargando…
        </div>
      )}
      {value !== null && (
        <textarea
          ref={ref}
          className="code-area mono"
          value={value}
          spellCheck={false}
          wrap="off"
          autoFocus
          aria-label="Código"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const t = e.currentTarget
              const { selectionStart: s, selectionEnd: en } = t
              t.setRangeText('  ', s, en, 'end')
              setValue(t.value)
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void save()
            }
          }}
        />
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}
