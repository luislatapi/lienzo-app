import { useEffect, useRef, useState } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { errorMessage } from '../../lib/git/errors'
import { buildPreview, resolvePreviewLink } from '../../lib/site/preview'
import { useUI } from '../../store/ui'
import { useEditor } from './context'

/** Vista previa con scripts activos de la página (y de las demás páginas del sitio al seguir enlaces). */
export function PreviewPane({ frameW, frameH, scale }: { frameW: number; frameH: number; scale: number }) {
  const { engine, project } = useEditor()
  const toast = useUI((s) => s.toast)
  const setPreviewPath = useUI((s) => s.setPreviewPath)
  const [path, setPath] = useState(engine.pagePath)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setPreviewPath(path)
  }, [path, setPreviewPath])

  // al entrar se cierra cualquier texto en edición y el foco sale del lienzo, para que ninguna tecla lo modifique
  useEffect(() => {
    engine.endTextEdit()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, [engine])

  useEffect(() => {
    let alive = true
    setHtml(null)
    setError(null)
    ;(async () => {
      try {
        const src = path === engine.pagePath ? engine.serialize() : await project.readText(path)
        if (!src) throw new Error(`No se pudo leer ${path}.`)
        const out = await buildPreview({ html: src, pagePath: path, siteRoot: project.site.siteRoot, reader: project })
        if (alive) setHtml(out)
      } catch (e) {
        if (alive) setError(errorMessage(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [path, engine, project])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return
      const href = (e.data as { lienzoNav?: unknown } | null)?.lienzoNav
      if (typeof href !== 'string') return
      const target = resolvePreviewLink(href, path, project.site.siteRoot, project.site.pages)
      if (target) setPath(target)
      else toast('info', 'Ese enlace no lleva a una página de tu sitio.')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [path, project, toast])

  return (
    <div className="preview-pane">
      {html && (
        <iframe
          ref={frameRef}
          title="Vista previa de la página"
          className="preview-frame"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
          srcDoc={html}
          style={{ width: frameW, height: frameH, transform: `scale(${scale})` }}
        />
      )}
      {!html && !error && (
        <div className="preview-state">
          <Loader2 className="spin" size={22} />
          <span>Preparando la vista previa…</span>
        </div>
      )}
      {error && (
        <div className="preview-state">
          <TriangleAlert size={22} color="var(--bad)" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
