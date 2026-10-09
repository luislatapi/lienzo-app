import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Boxes, ClipboardPaste, Copy, CornerLeftUp, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react'
import { isTextEditable, type El } from '../../lib/editor/dom-utils'
import { useUI } from '../../store/ui'
import { useClickOutside } from '../kit'
import { useEditor } from './context'

/** Menú del clic derecho sobre un elemento de la página. */
export function ContextMenu() {
  const { engine } = useEditor()
  const [at, setAt] = useState<{ x: number; y: number; el: El } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setAt(null), !!at)

  useEffect(
    () =>
      engine.onIntent((i) => {
        if (i.type === 'context-menu') setAt({ x: i.x, y: i.y, el: i.el })
      }),
    [engine],
  )
  useEffect(() => {
    if (!at) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setAt(null)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [at])

  if (!at) return null
  const { el } = at
  const isBody = el === engine.body
  const run = (fn: () => void) => () => {
    setAt(null)
    fn()
  }
  return (
    <div ref={ref} className="ctx-menu" style={{ left: Math.min(at.x, window.innerWidth - 230), top: Math.min(at.y, window.innerHeight - 330) }} role="menu">
      {el.tagName === 'IMG' && (
        <button onClick={run(() => useUI.getState().openDialog('image-picker', { target: 'element' }))}>
          <ImageIcon size={14} /> Cambiar imagen
        </button>
      )}
      {el instanceof (engine.win as Window & typeof globalThis).HTMLElement && isTextEditable(el) && (
        <button onClick={run(() => engine.startTextEdit(el as HTMLElement))}>
          <Pencil size={14} /> Editar texto
        </button>
      )}
      {!isBody && (
        <>
          <button onClick={run(() => engine.selectParent())}>
            <CornerLeftUp size={14} /> Seleccionar contenedor
          </button>
          <button onClick={run(() => engine.ops.nudge(el, -1))}>
            <ArrowUp size={14} /> Subir
          </button>
          <button onClick={run(() => engine.ops.nudge(el, 1))}>
            <ArrowDown size={14} /> Bajar
          </button>
          <button onClick={run(() => engine.ops.duplicate(el))}>
            <Copy size={14} /> Duplicar
          </button>
          <button onClick={run(() => engine.ops.wrap(el))}>
            <Boxes size={14} /> Agrupar en un contenedor
          </button>
        </>
      )}
      <button
        disabled={!engine.clipboardHtml}
        onClick={run(() => engine.paste(el))}
      >
        <ClipboardPaste size={14} /> Pegar aquí
      </button>
      {!isBody && (
        <>
          <div className="menu-sep" />
          <button className="danger" onClick={run(() => engine.ops.remove(el))}>
            <Trash2 size={14} /> Eliminar
          </button>
        </>
      )}
    </div>
  )
}
