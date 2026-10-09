import type { DropTarget, EditorEngine } from '../../lib/editor/engine'
import type { El } from '../../lib/editor/dom-utils'

interface DragOptions {
  engine: EditorEngine
  label: string
  /** elemento de la página que se está moviendo (nulo si es un bloque nuevo) */
  dragged?: El | null
  onDrop(drop: DropTarget): void
  /** se llama si el puntero casi no se movió (clic simple) */
  onClick?(): void
}

const THRESHOLD = 5

/** Arrastre con puntero desde cualquier panel hacia el lienzo, mostrando dónde caería el elemento. */
export function startDrag(ev: React.PointerEvent | PointerEvent, opts: DragOptions) {
  if ('button' in ev && ev.button !== 0) return
  const { engine } = opts
  const startX = ev.clientX
  const startY = ev.clientY
  let ghost: HTMLDivElement | null = null
  let dragging = false
  let drop: DropTarget | null = null
  let raf = 0
  let lastY = 0

  const autoScroll = () => {
    raf = 0
    if (!dragging || !engine.iframe || !engine.win) return
    const r = engine.iframe.getBoundingClientRect()
    const edge = 56
    let dy = 0
    if (lastY > r.top && lastY < r.top + edge) dy = -14
    else if (lastY < r.bottom && lastY > r.bottom - edge) dy = 14
    if (dy) {
      engine.win.scrollBy(0, dy)
      raf = requestAnimationFrame(autoScroll)
    }
  }

  const move = (e: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < THRESHOLD) return
      dragging = true
      engine.endTextEdit()
      ghost = document.createElement('div')
      ghost.className = 'drag-ghost'
      ghost.textContent = opts.label
      document.body.appendChild(ghost)
      document.body.classList.add('is-dragging')
    }
    lastY = e.clientY
    if (ghost) {
      ghost.style.left = e.clientX + 14 + 'px'
      ghost.style.top = e.clientY + 10 + 'px'
    }
    drop = engine.computeDrop(e.clientX, e.clientY, opts.dragged ?? null)
    engine.dropIndicator = drop?.indicator ?? null
    engine.bumpLayout()
    if (!raf) raf = requestAnimationFrame(autoScroll)
  }

  const end = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    ghost?.remove()
    document.body.classList.remove('is-dragging')
    engine.dropIndicator = null
    engine.bumpLayout()
    if (raf) cancelAnimationFrame(raf)
    if (!dragging) {
      opts.onClick?.()
      return
    }
    if (e.type !== 'pointercancel' && drop) opts.onDrop(drop)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}
