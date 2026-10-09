import { useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Italic, Link2, Strikethrough, Underline, Unlink } from 'lucide-react'
import type { Rect } from '../../lib/editor/engine'
import { useEditor, useEngineState } from './context'

/** Barra de formato que aparece sobre el texto mientras se edita (doble clic en un texto). */
export function TextToolbar({ rect }: { rect: Rect }) {
  const { engine } = useEditor()
  useEngineState()
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('https://')
  const colorRef = useRef<HTMLInputElement>(null)

  // los botones no deben quitar el foco ni la selección del texto
  const keep = (e: React.MouseEvent) => e.preventDefault()
  const cmd = (name: string, value?: string) => () => engine.exec(name, value)
  const on = (name: string) => engine.queryState(name)

  const left = Math.max(4, rect.left)
  const top = rect.top < 56 ? rect.top + rect.height + 8 : rect.top - 46

  const applyLink = () => {
    engine.exec('createLink', url.trim() || 'https://')
    setLinkOpen(false)
  }

  return (
    <div className="ov-toolbar text" style={{ left, top }} onMouseDown={(e) => !(e.target instanceof HTMLInputElement) && keep(e)}>
      <button className={'tb-btn' + (on('bold') ? ' on' : '')} title="Negrita (Ctrl + B)" onClick={cmd('bold')}>
        <Bold size={15} />
      </button>
      <button className={'tb-btn' + (on('italic') ? ' on' : '')} title="Cursiva (Ctrl + I)" onClick={cmd('italic')}>
        <Italic size={15} />
      </button>
      <button className={'tb-btn' + (on('underline') ? ' on' : '')} title="Subrayado (Ctrl + U)" onClick={cmd('underline')}>
        <Underline size={15} />
      </button>
      <button className={'tb-btn' + (on('strikeThrough') ? ' on' : '')} title="Tachado" onClick={cmd('strikeThrough')}>
        <Strikethrough size={15} />
      </button>
      <span className="tb-sep" />
      <button
        className="tb-btn"
        title="Color del texto"
        onClick={() => {
          engine.saveSelection()
          colorRef.current?.click()
        }}
      >
        <span className="tb-color">A</span>
      </button>
      <input
        ref={colorRef}
        type="color"
        className="tb-color-input"
        defaultValue="#e5007d"
        tabIndex={-1}
        aria-label="Color del texto"
        onChange={(e) => engine.exec('foreColor', e.target.value)}
      />
      <button
        className="tb-btn"
        title="Insertar enlace"
        onClick={() => {
          engine.saveSelection()
          setLinkOpen(!linkOpen)
        }}
      >
        <Link2 size={15} />
      </button>
      <button className="tb-btn" title="Quitar enlace" onClick={cmd('unlink')}>
        <Unlink size={15} />
      </button>
      <span className="tb-sep" />
      <button className="tb-btn" title="Alinear a la izquierda" onClick={cmd('justifyLeft')}>
        <AlignLeft size={15} />
      </button>
      <button className="tb-btn" title="Centrar" onClick={cmd('justifyCenter')}>
        <AlignCenter size={15} />
      </button>
      <button className="tb-btn" title="Alinear a la derecha" onClick={cmd('justifyRight')}>
        <AlignRight size={15} />
      </button>
      <span className="tb-sep" />
      <button className="tb-btn" title="Quitar formato" onClick={cmd('removeFormat')}>
        <Eraser size={15} />
      </button>
      {linkOpen && (
        <form
          className="tb-link"
          onSubmit={(e) => {
            e.preventDefault()
            applyLink()
          }}
        >
          <input
            autoFocus
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… , tel:… o #seccion"
            aria-label="Dirección del enlace"
          />
          <button className="btn small primary" type="submit">
            Aplicar
          </button>
        </form>
      )}
    </div>
  )
}
