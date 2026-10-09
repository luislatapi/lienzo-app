import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Info, Loader2, Lock, LogOut, Search } from 'lucide-react'
import { errorMessage } from '../lib/git/errors'
import type { RepoSummary } from '../lib/git/types'
import { useSession } from '../store/session'
import { LogoMark } from './icons'
import { editorHref } from './route'

function ago(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  const units: Array<[number, string, string]> = [
    [60, 'segundo', 'segundos'],
    [60, 'minuto', 'minutos'],
    [24, 'hora', 'horas'],
    [30, 'día', 'días'],
    [12, 'mes', 'meses'],
    [Infinity, 'año', 'años'],
  ]
  let n = s
  for (const [step, one, many] of units) {
    if (n < step) return `hace ${n} ${n === 1 ? one : many}`
    n = Math.round(n / step)
  }
  return ''
}

export function Projects() {
  const { provider, user, mode, logout } = useSession()
  const [repos, setRepos] = useState<RepoSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    provider
      ?.listRepos()
      .then((r) => alive && setRepos(r))
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [provider])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (repos ?? []).filter((r) => !term || r.fullName.toLowerCase().includes(term) || (r.description ?? '').toLowerCase().includes(term))
  }, [repos, q])

  return (
    <div className="projects">
      <header className="projects-bar">
        <div className="brand">
          <LogoMark size={26} />
          <span>Lienzo</span>
        </div>
        <div className="projects-user">
          <span className="avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user?.login ?? '?').slice(0, 1).toUpperCase()}</span>
          <span>{user?.name || user?.login}</span>
          <button className="btn ghost small" onClick={logout}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <main className="projects-main">
        <div className="projects-head">
          <h1>¿Qué sitio quieres editar?</h1>
          <p>Elige el repositorio donde vive tu página. Lienzo lo abre, tú lo cambias y al publicar se actualiza en Vercel.</p>
        </div>

        {mode === 'demo' && (
          <div className="demo-banner">
            <Info size={16} style={{ flex: 'none', marginTop: 2 }} />
            <span>
              Estás en el modo de prueba. Puedes editar y “publicar” con libertad: no se guarda nada en GitHub y todo se reinicia al
              recargar la página.
            </span>
          </div>
        )}

        <label className="projects-search">
          <Search size={15} />
          <input placeholder="Buscar repositorio…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar repositorio" />
        </label>

        {error && <p className="login-error">{error}</p>}
        {!repos && !error && (
          <div className="empty">
            <Loader2 className="spin" size={20} />
          </div>
        )}
        {repos && list.length === 0 && (
          <div className="empty">
            {repos.length === 0
              ? 'Este token no ve ningún repositorio. Revisa que tenga acceso a los repos de tu sitio.'
              : 'Ningún repositorio coincide con tu búsqueda.'}
          </div>
        )}
        <div className="repo-grid">
          {list.map((r) => (
            <a key={r.fullName} className="repo-card" href={editorHref(r.owner, r.name)}>
              <h3>
                <small>{r.owner}/</small>
                {r.name}
              </h3>
              <p>{r.description || 'Sin descripción'}</p>
              <footer>
                <span>
                  {r.private && <Lock size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />}
                  {ago(r.pushedAt) ? `Actualizado ${ago(r.pushedAt)}` : r.private ? 'Privado' : 'Público'}
                </span>
                <span className="chip rosa">
                  Editar <ArrowRight size={12} />
                </span>
              </footer>
            </a>
          ))}
        </div>
      </main>
    </div>
  )
}
