import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link2, Unlink, X } from 'lucide-react'
import type { El } from '../../../lib/editor/dom-utils'
import { toHex } from '../../../lib/site/theme'
import { useEditor, useEngineState } from '../context'

/** Elemento seleccionado y utilidades para leer y cambiar sus estilos en la pantalla actual. */
export function useSel() {
  const { engine } = useEditor()
  useEngineState()
  const el = engine.selected as El
  return {
    engine,
    el,
    ops: engine.ops,
    own: (prop: string) => engine.ops.getOwnStyle(el, prop),
    computed: (prop: string) => engine.getComputed(el)?.getPropertyValue(prop).trim() ?? '',
    set: (props: Record<string, string>) => engine.ops.setStyle(el, props),
  }
}

/** Fila con etiqueta y, si el valor fue cambiado por ti, un punto para restablecerlo. */
export function Field({ label, props, children, full }: { label: string; props: string[]; children: ReactNode; full?: boolean }) {
  const { ops, el, set } = useSel()
  const changed = props.some((p) => ops.hasOwnStyle(el, p))
  return (
    <div className={'fld' + (full ? ' full' : '')}>
      <span className="fld-label">
        {label}
        {changed && (
          <button
            type="button"
            className="fld-reset"
            title="Quitar este cambio"
            aria-label={`Quitar el cambio de ${label.toLowerCase()}`}
            onClick={() => set(Object.fromEntries(props.map((p) => [p, ''])))}
          />
        )}
      </span>
      <div className="fld-body">{children}</div>
    </div>
  )
}

// ── medidas ─────────────────────────────────────────────────────────────────
const KEYWORDS = ['auto', 'none', 'fit-content', 'max-content', 'min-content', 'inherit', 'initial', 'normal']

export function parseLen(v: string): { num: string; unit: string } | null {
  const t = v.trim()
  const m = /^(-?\d*\.?\d+)(px|%|rem|em|vw|vh|ch|pt)?$/.exec(t)
  if (m) return { num: String(Math.round(parseFloat(m[1]) * 100) / 100), unit: m[2] ?? 'px' }
  if (KEYWORDS.includes(t)) return { num: '', unit: t }
  return null
}

/** Número + unidad (px, %, rem…). Escribe un número y se agrega la unidad. */
export function LengthInput({
  prop,
  units = ['px', '%', 'rem', 'em'],
  keywords = [],
  min,
  label,
  className = '',
  also,
}: {
  prop: string
  units?: string[]
  keywords?: string[]
  min?: number
  label: string
  className?: string
  /** estilos que se cambian junto con este (por ejemplo, el borde necesita estilo y grosor) */
  also?: () => Record<string, string>
}) {
  const { own, computed, set } = useSel()
  const ownV = own(prop)
  const shown = ownV || computed(prop)
  const parsed = parseLen(shown)
  const unit = parsed?.unit ?? 'raw'
  const num = parsed ? parsed.num : shown
  const [text, setText] = useState(num)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(num)
  }, [num])

  const commit = (n: string, u: string) => {
    const extra = also?.() ?? {}
    if (u !== 'raw' && keywords.includes(u)) return set({ [prop]: u, ...extra })
    if (u === 'raw') return set({ [prop]: n.trim(), ...extra })
    const f = parseFloat(n)
    if (n.trim() === '' || Number.isNaN(f)) return
    set({ [prop]: `${min !== undefined ? Math.max(min, f) : f}${u}`, ...extra })
  }
  const step = (dir: 1 | -1, big: boolean) => {
    const f = parseFloat(text)
    const base = Number.isNaN(f) ? 0 : f
    const inc = unit === 'rem' || unit === 'em' ? 0.1 : 1
    const next = Math.round((base + dir * inc * (big ? 10 : 1)) * 100) / 100
    setText(String(next))
    commit(String(next), unit === 'raw' ? 'px' : keywords.includes(unit) ? 'px' : unit)
  }
  const isKeyword = keywords.includes(unit)
  return (
    <div className={'len ' + className + (ownV ? ' own' : '')}>
      <input
        className="input num"
        value={isKeyword ? '' : text}
        placeholder={isKeyword ? unit : ''}
        disabled={isKeyword}
        inputMode="decimal"
        aria-label={label}
        onFocus={() => (focus.current = true)}
        onBlur={() => {
          focus.current = false
          if (text.trim() === '' && ownV) set({ [prop]: '' })
          else if (text.trim() !== '') commit(text, unit === 'raw' ? 'raw' : unit)
          setText(num)
        }}
        onChange={(e) => {
          setText(e.target.value)
          if (unit !== 'raw') commit(e.target.value, unit)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey)
          } else if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
        }}
      />
      {unit !== 'raw' && (
        <select
          className="select unit"
          value={unit}
          aria-label={`Unidad de ${label.toLowerCase()}`}
          onChange={(e) => {
            const u = e.target.value
            if (keywords.includes(u)) commit('', u)
            else commit(isKeyword || text === '' ? '0' : text, u)
          }}
        >
          {[...units, ...keywords].map((u) => (
            <option key={u} value={u}>
              {u === 'auto' ? 'auto' : u}
            </option>
          ))}
          {![...units, ...keywords].includes(unit) && <option value={unit}>{unit}</option>}
        </select>
      )}
    </div>
  )
}

/** Número sin unidad (interlineado, opacidad, z-index…). */
export function NumberInput({
  prop,
  label,
  min,
  max,
  step = 1,
  fromComputed,
}: {
  prop: string
  label: string
  min?: number
  max?: number
  step?: number
  /** cómo mostrar el valor cuando todavía no hay uno propio */
  fromComputed?: (cs: CSSStyleDeclaration | null, raw: string) => string
}) {
  const { engine, el, own, computed, set } = useSel()
  const ownV = own(prop)
  let shown = ownV || computed(prop)
  if (!ownV && fromComputed) shown = fromComputed(engine.getComputed(el), shown)
  const [text, setText] = useState(shown)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(shown)
  }, [shown])
  const apply = (t: string) => {
    const f = parseFloat(t)
    if (Number.isNaN(f)) return
    set({ [prop]: String(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, f))) })
  }
  return (
    <input
      className={'input num single' + (ownV ? ' own' : '')}
      value={text}
      inputMode="decimal"
      aria-label={label}
      onFocus={() => (focus.current = true)}
      onBlur={() => {
        focus.current = false
        if (text.trim() === '' && ownV) set({ [prop]: '' })
        setText(shown)
      }}
      onChange={(e) => {
        setText(e.target.value)
        apply(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const f = parseFloat(text)
          const next = Math.round(((Number.isNaN(f) ? 0 : f) + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)) * 100) / 100
          setText(String(next))
          apply(String(next))
        } else if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
      }}
    />
  )
}

// ── color ───────────────────────────────────────────────────────────────────
export function isClear(v: string): boolean {
  const t = v.replace(/\s+/g, '').toLowerCase()
  return t === '' || t === 'transparent' || /^rgba\(\d+,\d+,\d+,0(\.0+)?\)$/.test(t)
}

export function ColorInput({ prop, label }: { prop: string; label: string }) {
  const { own, computed, set } = useSel()
  const ownV = own(prop)
  const shown = ownV || computed(prop)
  const clear = isClear(shown)
  const hex = toHex(shown)
  const display = clear ? '' : hex && !/^rgba/i.test(shown) ? hex : shown
  const [text, setText] = useState(display)
  const [live, setLive] = useState<string | null>(null)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(display)
  }, [display])
  const commitText = () => {
    const t = text.trim()
    if (t === '') set({ [prop]: ownV ? '' : '' })
    else if (t !== display) set({ [prop]: /^[0-9a-f]{3,8}$/i.test(t) ? '#' + t : t })
  }
  return (
    <div className={'color-in' + (ownV ? ' own' : '')}>
      <label className={'swatch' + (clear ? ' none' : '')} style={clear ? undefined : { background: shown }} title="Elegir color">
        <input
          type="color"
          value={live ?? hex ?? '#000000'}
          aria-label={label}
          onChange={(e) => {
            setLive(e.target.value)
            set({ [prop]: e.target.value })
          }}
          onBlur={() => setLive(null)}
        />
      </label>
      <input
        className="input mono"
        value={text}
        placeholder="Sin color"
        aria-label={`${label} (valor)`}
        spellCheck={false}
        onFocus={() => (focus.current = true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          focus.current = false
          commitText()
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      {ownV && (
        <button className="icon-btn tiny" title="Quitar color" aria-label={`Quitar ${label.toLowerCase()}`} onClick={() => set({ [prop]: '' })}>
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ── opciones ────────────────────────────────────────────────────────────────
const ALIAS: Record<string, string> = { start: 'left', end: 'right', '-webkit-center': 'center' }

export function SegInput({
  prop,
  options,
  label,
  alias = true,
}: {
  prop: string
  options: Array<{ value: string; label: ReactNode; title?: string }>
  label: string
  alias?: boolean
}) {
  const { own, computed, set } = useSel()
  const ownV = own(prop)
  const raw = (ownV || computed(prop)).trim()
  const current = alias ? ALIAS[raw] ?? raw : raw
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={current === o.value}
          className={current === o.value ? 'on' + (ownV ? ' own' : '') : ''}
          onClick={() => set({ [prop]: ownV === o.value ? '' : o.value })}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SelectInput({
  prop,
  options,
  label,
  placeholder,
}: {
  prop: string
  options: Array<{ value: string; label: string }>
  label: string
  placeholder?: string
}) {
  const { own, computed, set } = useSel()
  const ownV = own(prop)
  const cur = ownV || computed(prop)
  const known = options.some((o) => o.value === cur)
  return (
    <select className={'select' + (ownV ? ' own' : '')} value={cur} aria-label={label} onChange={(e) => set({ [prop]: e.target.value })}>
      {!known && <option value={cur}>{cur || placeholder || '—'}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Interruptor simple. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={'toggle' + (disabled ? ' disabled' : '')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

// ── márgenes y relleno ──────────────────────────────────────────────────────
const SIDES = ['top', 'right', 'bottom', 'left'] as const

function MiniLen({ prop, allowAuto, onCommit }: { prop: string; allowAuto?: boolean; onCommit: (prop: string, v: string) => void }) {
  const { own, computed } = useSel()
  const ownV = own(prop)
  const shown = ownV || computed(prop)
  const p = parseLen(shown)
  const display = p ? (p.num === '' ? p.unit : p.unit === 'px' ? p.num : p.num + p.unit) : shown
  const [text, setText] = useState(display)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(display)
  }, [display])
  const parse = (t: string): string | null => {
    const v = t.trim()
    if (v === '') return ''
    if (allowAuto && v === 'auto') return 'auto'
    const m = /^(-?\d*\.?\d+)(px|%|rem|em|vw|vh)?$/.exec(v)
    return m ? m[1] + (m[2] ?? 'px') : null
  }
  return (
    <input
      className={'input mini' + (ownV ? ' own' : '')}
      value={text}
      aria-label={prop.replace('-', ' ')}
      inputMode="decimal"
      onFocus={(e) => {
        focus.current = true
        e.currentTarget.select()
      }}
      onBlur={() => {
        focus.current = false
        const v = parse(text)
        if (v !== null && v !== (ownV || '')) onCommit(prop, v)
        setText(display)
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const f = parseFloat(text)
          const next = (Number.isNaN(f) ? 0 : f) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)
          setText(String(next))
          onCommit(prop, `${next}px`)
        }
      }}
    />
  )
}

/** Caja con los cuatro lados de margen (exterior) y relleno (interior). */
export function SpacingBox() {
  const { set } = useSel()
  const [linked, setLinked] = useState(false)
  const commit = (kind: 'margin' | 'padding') => (prop: string, v: string) => {
    if (linked && v !== '') set(Object.fromEntries(SIDES.map((s) => [`${kind}-${s}`, v])))
    else set({ [prop]: v })
  }
  return (
    <div className="spacing">
      <button type="button" className={'spacing-link' + (linked ? ' on' : '')} onClick={() => setLinked(!linked)} aria-pressed={linked} title="Cambiar los cuatro lados a la vez">
        {linked ? <Link2 size={12} /> : <Unlink size={12} />}
      </button>
      <div className="spacing-margin">
        <span className="spacing-tag">margen</span>
        <div className="sp top"><MiniLen prop="margin-top" allowAuto onCommit={commit('margin')} /></div>
        <div className="sp right"><MiniLen prop="margin-right" allowAuto onCommit={commit('margin')} /></div>
        <div className="sp bottom"><MiniLen prop="margin-bottom" allowAuto onCommit={commit('margin')} /></div>
        <div className="sp left"><MiniLen prop="margin-left" allowAuto onCommit={commit('margin')} /></div>
        <div className="spacing-padding">
          <span className="spacing-tag">relleno</span>
          <div className="sp top"><MiniLen prop="padding-top" onCommit={commit('padding')} /></div>
          <div className="sp right"><MiniLen prop="padding-right" onCommit={commit('padding')} /></div>
          <div className="sp bottom"><MiniLen prop="padding-bottom" onCommit={commit('padding')} /></div>
          <div className="sp left"><MiniLen prop="padding-left" onCommit={commit('padding')} /></div>
          <div className="spacing-core" />
        </div>
      </div>
    </div>
  )
}
