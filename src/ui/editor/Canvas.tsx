import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEVICE_WIDTH } from '../../lib/editor/engine'
import { useUI } from '../../store/ui'
import { useEditor, useEngineState } from './context'
import { Overlay } from './Overlay'
import { PreviewPane } from './PreviewPane'

const PAD = 28

/** Lienzo: la página dentro de un iframe, escalada para caber en el espacio disponible. */
export function Canvas() {
  const { engine } = useEditor()
  useEngineState()
  const zoom = useUI((s) => s.zoom)
  const preview = useUI((s) => s.preview)
  const previewPath = useUI((s) => s.previewPath)
  const stageRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    if (iframeRef.current) engine.attach(iframeRef.current)
  }, [engine])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setStage({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const frameW = DEVICE_WIDTH[engine.device]
  const availW = Math.max(200, stage.w - PAD * 2)
  const availH = Math.max(200, stage.h - PAD * 2)
  const scale = zoom === 'fit' ? Math.min(1, availW / frameW) : zoom
  const frameH = Math.max(300, Math.floor(availH / scale))

  useLayoutEffect(() => {
    engine.setViewport(frameW, frameH, scale)
  }, [engine, frameW, frameH, scale])

  return (
    <div className="stage" ref={stageRef}>
      <div className="frame-wrap" style={{ width: frameW * scale, height: frameH * scale }}>
        {preview && previewPath && <div className="preview-tag">Vista previa · {previewPath}</div>}
        <div className="frame" style={{ width: frameW * scale, height: frameH * scale }}>
          <iframe
            ref={iframeRef}
            title="Página en edición"
            className="page-frame"
            sandbox="allow-same-origin"
            style={{ width: frameW, height: frameH, transform: `scale(${scale})` }}
          />
          {preview ? <PreviewPane frameW={frameW} frameH={frameH} scale={scale} /> : <Overlay />}
        </div>
        {engine.loading && <div className="frame-loading">Cargando página…</div>}
      </div>
    </div>
  )
}
