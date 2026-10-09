import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useUI } from '../../store/ui'

export function Toasts() {
  const { toasts, dismissToast } = useUI()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.kind} role={t.kind === 'error' ? 'alert' : 'status'}>
          {t.kind === 'ok' ? <CircleCheck size={16} /> : t.kind === 'error' ? <CircleAlert size={16} /> : <Info size={16} />}
          <span>{t.text}</span>
          <button className="icon-btn" onClick={() => dismissToast(t.id)} aria-label="Cerrar aviso">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
