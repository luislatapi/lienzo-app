import { useRef } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerLeftUp,
  GripVertical,
  Trash2,
} from 'lucide-react'
import { friendlyName, selectorLabel, type El } from '../../lib/editor/dom-utils'
import type { Rect } from '../../lib/editor/engine'
import { useEditor, useEngineState, useLayoutState } from './context'
import { TextToolbar } from './TextToolbar'

/** Capa encima del iframe: resaltado al pasar el mouse, selección, barra de acciones y destinos de arrastre. */
export function Overlay() {
  const { engine } = useEditor()
  useEngineState()
  useLayoutState()
  const dragRef = useRef<{ el: El } | null>(null)

  const sel = engine.selected
  const hov = engine.hovered
  const selRect = sel ? engine.rectOf(sel) : null
  const hovRect = hov && hov !== sel && !engine.editing ? engine.rectOf(hov) : null
  const isBody = sel === engine.body

  const startMove = (e: React.PointerEvent) => {
    if (!sel || isBody) return
    e.preventDefault()
    const el = sel
    dragRef.current = { el }
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    let last: ReturnType<typeof engine.computeDrop> = null
    const move = (ev: PointerEvent) => {
      last = engine.computeDrop(ev.clientX, ev.clientY, el)
      engine.dropIndicator = last?.indicator ?? null
      engine.bumpLayout()
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      engine.dropIndicator = null
      if (last) engine.ops.move(el, last.ref, last.position)
      else engine.bumpLayout()
      dragRef.current = null
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const labelTop = selRect ? (selRect.top < 28 ? selRect.top + 2 : selRect.top - 22) : 0
  const toolbarBelow = selRect ? selRect.top < 64 : false

  return (
    <div className="overlay">
      {hovRect && <Box r={hovRect} className="ov-hover" />}
      {selRect && sel && (
        <>
          <Box r={selRect} className={'ov-sel' + (engine.editing ? ' editing' : '')}>
            {!engine.editing && (
              <>
                <i className="mk tl" />
                <i className="mk tr" />
                <i className="mk bl" />
                <i className="mk br" />
              </>
            )}
          </Box>
          <div className="ov-tag" style={{ left: selRect.left, top: labelTop }}>
            {friendlyName(sel)} <span>{selectorLabel(sel)}</span>
          </div>
          {!engine.editing && (
            <div
              className="ov-toolbar"
              style={{
                left: Math.max(4, selRect.left + selRect.width),
                top: toolbarBelow ? selRect.top + selRect.height + 8 : selRect.top - 40,
              }}
            >
              {!isBody && (
                <>
                  <button className="tb-btn grip" title="Arrastra para mover" onPointerDown={startMove}>
                    <GripVertical size={15} />
                  </button>
                  <button className="tb-btn" title="Seleccionar el contenedor" onClick={() => engine.selectParent()}>
                    <CornerLeftUp size={15} />
                  </button>
                  <button className="tb-btn" title="Subir (Alt + ↑)" onClick={() => engine.ops.nudge(sel, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button className="tb-btn" title="Bajar (Alt + ↓)" onClick={() => engine.ops.nudge(sel, 1)}>
                    <ArrowDown size={15} />
                  </button>
                  <button className="tb-btn" title="Duplicar (Ctrl + D)" onClick={() => engine.ops.duplicate(sel)}>
                    <Copy size={15} />
                  </button>
                  <button className="tb-btn danger" title="Eliminar (Supr)" onClick={() => engine.ops.remove(sel)}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              {isBody && <span className="tb-note">Página completa</span>}
            </div>
          )}
          {engine.editing && <TextToolbar rect={selRect} />}
        </>
      )}
      {engine.dropIndicator && (
        <div
          className={'ov-drop ' + engine.dropIndicator.kind}
          style={{
            left: engine.dropIndicator.left,
            top: engine.dropIndicator.top,
            width: engine.dropIndicator.width,
            height: engine.dropIndicator.height,
          }}
        />
      )}
    </div>
  )
}

function Box({ r, className, children }: { r: Rect; className: string; children?: React.ReactNode }) {
  return (
    <div className={className} style={{ left: r.left, top: r.top, width: r.width, height: r.height }}>
      {children}
    </div>
  )
}
