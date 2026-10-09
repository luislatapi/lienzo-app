import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, KeyRound, Loader2, MousePointer2, ShieldCheck, Sparkles } from 'lucide-react'
import { useSession } from '../store/session'
import { GithubMark, LogoMark } from './icons'

const CLASSIC_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Lienzo%20(editor%20visual)'
const FINE_TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new?name=Lienzo&description=Editor%20visual%20de%20sitios&expires_in=90&contents=write&pull_requests=write&metadata=read&deployments=read&statuses=read'

export function Login() {
  const { connectToken, connectDemo, status, error } = useSession()
  const [token, setToken] = useState('')
  const [help, setHelp] = useState(false)
  const [oauth, setOauth] = useState(false)
  const busy = status === 'connecting'

  useEffect(() => {
    let alive = true
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j?.oauth && setOauth(true))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="login">
      <section className="login-main">
        <div className="brand">
          <LogoMark size={30} />
          <span>Lienzo</span>
        </div>

        <h1 className="login-title">Tu sitio de GitHub y Vercel, editable con clics.</h1>
        <p className="login-lead">
          Cambia textos, fotos, colores y secciones directo sobre la página. Al publicar, Lienzo guarda el cambio en
          GitHub y Vercel actualiza tu sitio solo.
        </p>

        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault()
            void connectToken(token)
          }}
        >
          <label htmlFor="token" className="login-label">
            Token de acceso de GitHub
          </label>
          <div className="login-row">
            <div className="login-input">
              <KeyRound size={15} />
              <input
                id="token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="ghp_… o github_pat_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <button className="btn primary big" type="submit" disabled={busy || !token.trim()}>
              {busy ? <Loader2 size={16} className="spin" /> : <GithubMark size={16} />}
              Conectar
            </button>
          </div>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
        </form>

        <button className="login-help-toggle" onClick={() => setHelp(!help)} aria-expanded={help}>
          <ChevronDown size={15} style={{ transform: help ? 'rotate(180deg)' : undefined }} />
          ¿Cómo obtengo mi token?
        </button>
        {help && (
          <ol className="login-steps">
            <li>
              Abre{' '}
              <a href={CLASSIC_TOKEN_URL} target="_blank" rel="noreferrer">
                esta página de GitHub
              </a>{' '}
              (inicia sesión si te lo pide).
            </li>
            <li>
              Elige cuánto tiempo dura, deja marcada la casilla <b>repo</b> y presiona <b>Generate token</b> al final.
            </li>
            <li>Copia el código que empieza con ghp_ y pégalo arriba. Solo se muestra una vez.</li>
            <li className="muted">
              ¿Prefieres darle acceso solo a algunos repositorios?{' '}
              <a href={FINE_TOKEN_URL} target="_blank" rel="noreferrer">
                Crea un token limitado
              </a>{' '}
              y en “Repository access” elige tus repos.
            </li>
          </ol>
        )}

        {oauth && (
          <a className="btn big login-oauth" href="/api/auth/login">
            <GithubMark size={16} /> Iniciar sesión con GitHub
          </a>
        )}

        <div className="login-or">
          <span>o</span>
        </div>
        <button className="btn big login-demo" onClick={() => void connectDemo()} disabled={busy}>
          <Sparkles size={16} />
          Probar con un sitio de ejemplo
          <ArrowRight size={16} />
        </button>

        <p className="login-privacy">
          <ShieldCheck size={15} />
          <span>
            Tu token se guarda solo en este navegador. Lienzo habla directo con GitHub y no tiene una base de datos con
            tus datos.
          </span>
        </p>
      </section>

      <section className="login-art" aria-hidden="true">
        <div className="art-page">
          <div className="art-bar">
            <i />
            <span>casa-nopal.vercel.app</span>
          </div>
          <div className="art-body">
            <span className="art-pill">Horneamos desde las 4 a. m.</span>
            <div className="art-title-wrap">
              <div className="art-hover" />
              <h2 className="art-title">El pan de la esquina, recién salido del horno</h2>
              <div className="art-sel">
                <span className="art-tag">h1 · Título</span>
                <i className="mk tl" />
                <i className="mk tr" />
                <i className="mk bl" />
                <i className="mk br" />
              </div>
              <div className="art-toolbar">
                <b>B</b>
                <i>I</i>
                <u>U</u>
                <span className="sep" />
                <span className="swatch" />
              </div>
              <MousePointer2 className="art-cursor" size={22} fill="#1b1a2e" color="#fff" strokeWidth={1.5} />
            </div>
            <p className="art-text">Conchas, cuernos y bolillo de masa madre en la Roma Norte.</p>
            <span className="art-btn">Hacer mi pedido</span>
          </div>
        </div>
        <div className="art-publish">
          <span className="dot" /> Publicado en Vercel hace 12 s
        </div>
      </section>
    </div>
  )
}
