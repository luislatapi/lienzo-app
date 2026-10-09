import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOutside, active])
}

/** Menú desplegable anclado a un botón. */
export function Popover({
  trigger,
  children,
  align = 'left',
  width,
  className = '',
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])
  return (
    <div className={'popover-anchor ' + className} ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={'popover ' + align} style={{ width }} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal ' + size} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | ''
  options: Array<{ value: T; label?: ReactNode; title?: string }>
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label ?? o.value}
        </button>
      ))}
    </div>
  )
}

export function Section({
  title,
  defaultOpen = true,
  children,
  actions,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  actions?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={'sec' + (open ? ' open' : '')}>
      <header className="sec-head">
        <button type="button" className="sec-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown size={14} style={{ transform: open ? undefined : 'rotate(-90deg)' }} />
          {title}
        </button>
        {actions}
      </header>
      {open && <div className="sec-body">{children}</div>}
    </section>
  )
}

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="row">
      <label className="row-label" title={hint}>
        {label}
      </label>
      <div className="row-field">{children}</div>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}
