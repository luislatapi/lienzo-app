import { useEffect } from 'react'
import { errorMessage } from '../../lib/git/errors'
import { normalizeHtml, preserveFormat } from '../../lib/site/document'
import { useSession } from '../../store/session'
import { useUI } from '../../store/ui'
import { addImageFile, applyImage } from './actions'
import { useEditor } from './context'

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable
}

/** Efectos globales del editor: abrir la primera página, atajos, avisos al salir e intenciones del lienzo. */
export function useEditorEffects(initialPage?: string) {
  const ctx = useEditor()
  const { engine, controller, project } = ctx
  const ui = useUI

  // primera página
  useEffect(() => {
    const first = initialPage && project.has(initialPage) ? initialPage : project.site.pages[0]
    if (!first) return
    controller.openPage(first).catch((e) => ui.getState().toast('error', errorMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // intenciones que vienen del lienzo (doble clic en imagen, menú contextual, Ctrl+S…)
  useEffect(
    () =>
      engine.onIntent(async (i) => {
        const s = ui.getState()
        if (i.type === 'save') s.openDialog('publish')
        else if (i.type === 'replace-image') s.openDialog('image-picker', { target: 'element' })
        else if (i.type === 'open-content') s.setRightTab('content')
        else if (i.type === 'drop-files') {
          const img = i.files.find((f) => f.type.startsWith('image/'))
          if (!img) return s.toast('info', 'Suelta una imagen (JPG, PNG, WebP o SVG).')
          const placed = await addImageFile(ctx, img)
          if (!placed) return
          const target = i.el ?? engine.selected
          if (target && target !== engine.body) applyImage(ctx, target, placed)
          else s.toast('ok', `Imagen subida: ${placed.path}. Elige dónde usarla.`)
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  )

  // atajos con el foco fuera del lienzo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ui.getState().dialog) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        ui.getState().openDialog('publish')
        return
      }
      if (isTypingTarget(e.target)) return
      if (e.key === '?' && !mod) {
        e.preventDefault()
        ui.getState().openDialog('shortcuts')
        return
      }
      // en la vista previa no se edita nada: así Supr o Ctrl+D no tocan la página por accidente
      if (ui.getState().preview) return
      if (engine.handleKey(e)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine])

  // aviso al cerrar la pestaña con cambios sin publicar
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (controller.hasUnsaved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [controller])

  // utilidades para pruebas y depuración (solo con ?debug=1)
  useEffect(() => {
    if (!/[?&]debug=1/.test(location.search + location.hash)) return
    ;(window as unknown as { __lienzo: unknown }).__lienzo = { ...ctx, provider: useSession.getState().provider, ui: useUI, lib: { normalizeHtml, preserveFormat } }
  }, [ctx])
}
