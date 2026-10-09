import { useEffect, useState } from 'react'
import { ChevronRight, Eye, EyeOff, GripVertical } from 'lucide-react'
import type { El } from '../../../lib/editor/dom-utils'
import { VOID_TAGS } from '../../../lib/editor/dom-utils'
import type { LayerNode } from '../../../lib/editor/engine'
import { useEditor, useEngineState } from '../context'

type Mark = { idx: number; pos: 'before' | 'after' | 'append' }

export function LayersPanel() {
  const { engine } = useEditor()
  useEngineState()
  const [open, setOpen] = useState<Map<El, boolean>>(new Map())
  const [mark, setMark] = useState<Mark | null>(null)
  const nodes = engine.loaded ? engine.layerTree() : []
  const sel = engine.selected

  // al seleccionar algo en el lienzo, se abren sus contenedores en el árbol
  useEffect(() => {
    if (!sel) return
    setOpen((prev) => {
      const next = new Map(prev)
      let changed = false
      for (let p = sel.parentElement; p && p !== engine.doc?.documentElement; p = p.parentElement) {
        if (next.get(p as El) !== true) {
          next.set(p as El, true)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [sel, engine])

  const isOpen = (n: LayerNode) => open.get(n.el) ?? n.depth < 2
  const visible: LayerNode[] = []
  let skipDepth = Infinity
  for (const n of nodes) {
    if (n.depth > skipDepth) continue
    skipDepth = Infinity
    visible.push(n)
    if (n.hasChildren && !isOpen(n)) skipDepth = n.depth
  }

  const startDrag = (e: React.PointerEvent, node: LayerNode) => {
    if (e.button !== 0 || node.el === engine.body) return
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    let current: Mark | null = null
    let canvasDrop: ReturnType<typeof engine.computeDrop> = null

    const move = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
        dragging = true
        document.body.classList.add('is-dragging')
      }
      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const row = under?.closest('[data-layer]') as HTMLElement | null
      current = null
      canvasDrop = null
      if (row) {
        const idx = Number(row.dataset.layer)
        const target = visible[idx]
        if (target && target.el !== node.el && !node.el.contains(target.el)) {
          const r = row.getBoundingClientRect()
          const f = (ev.clientY - r.top) / r.height
          const canNest = !VOID_TAGS.has(target.el.tagName) && target.el !== engine.body
          const pos: Mark['pos'] = f < 0.28 ? 'before' : f > 0.72 ? 'after' : canNest || target.el === engine.body ? 'append' : f < 0.5 ? 'before' : 'after'
          if (target.el === engine.body && pos !== 'append') current = null
          else current = { idx, pos }
        }
        engine.dropIndicator = null
      } else {
        canvasDrop = engine.computeDrop(ev.clientX, ev.clientY, node.el)
        engine.dropIndicator = canvasDrop?.indicator ?? null
      }
      setMark(current)
      engine.bumpLayout()
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.body.classList.remove('is-dragging')
      engine.dropIndicator = null
      setMark(null)
      if (!dragging) return
      if (current) {
        const target = visible[current.idx]
        engine.ops.move(node.el, target.el, current.pos === 'append' ? 'append' : current.pos)
      } else if (canvasDrop) {
        engine.ops.move(node.el, canvasDrop.ref, canvasDrop.position)
      }
      engine.bumpLayout()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <h3>Capas</h3>
        <p>La estructura de la página. Arrastra para reordenar.</p>
      </header>
      <div className="panel-scroll layers" onMouseLeave={() => engine.setHover(null)}>
        {!engine.loaded && <p className="panel-empty">Abre una página para ver sus capas.</p>}
        {visible.map((n, idx) => {
          const isSel = n.el === sel
          const hiddenHere = engine.ops.isHiddenOn(n.el, engine.device === 'desktop' ? 'desktop' : engine.device)
          return (
            <div
              key={idx}
              data-layer={idx}
              className={
                'layer' + (isSel ? ' sel' : '') + (n.hidden ? ' hid' : '') + (mark?.idx === idx ? ` drop-${mark.pos}` : '')
              }
              style={{ paddingLeft: 6 + n.depth * 14 }}
              onClick={() => {
                engine.select(n.el)
                engine.revealIfNeeded(n.el)
              }}
              onMouseEnter={() => engine.setHover(n.el)}
              onPointerDown={(e) => startDrag(e, n)}
            >
              {n.hasChildren ? (
                <button
                  className="layer-chev"
                  aria-label={isOpen(n) ? 'Contraer' : 'Expandir'}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen((m) => new Map(m).set(n.el, !isOpen(n)))
                  }}
                >
                  <ChevronRight size={13} style={{ transform: isOpen(n) ? 'rotate(90deg)' : undefined }} />
                </button>
              ) : (
                <span className="layer-chev" />
              )}
              <span className="layer-name">{n.name}</span>
              <span className="layer-sub">{n.text || n.label}</span>
              <GripVertical size={13} className="layer-grip" />
              {n.el !== engine.body && (
                <button
                  className="layer-eye"
                  title={n.hidden ? 'Mostrar en esta pantalla' : 'Ocultar en esta pantalla'}
                  aria-label={n.hidden ? 'Mostrar' : 'Ocultar'}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    engine.ops.setHiddenOn(n.el, engine.device, !hiddenHere)
                  }}
                >
                  {n.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
