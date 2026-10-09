import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import config from '../../api/config.js'
import login from '../../api/auth/login.js'
import callback from '../../api/auth/callback.js'

/** Respuesta mínima que imita la de Vercel. */
function fakeRes() {
  const r = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '' as string,
    status(c: number) {
      r.statusCode = c
      return r
    },
    setHeader(k: string, v: string) {
      r.headers[k.toLowerCase()] = v
      return r
    },
    writeHead(c: number, h: Record<string, string> = {}) {
      r.statusCode = c
      for (const [k, v] of Object.entries(h)) r.headers[k.toLowerCase()] = v
      return r
    },
    json(o: unknown) {
      r.headers['content-type'] = 'application/json'
      r.body = JSON.stringify(o)
      return r
    },
    send(b: string) {
      r.body = b
      return r
    },
    end(b = '') {
      r.body = b
      return r
    },
  }
  return r
}

const ENV = { ...process.env }
beforeEach(() => {
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
  delete process.env.GITHUB_SCOPE
})
afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

describe('API de inicio de sesión con GitHub', () => {
  it('config indica si OAuth está configurado', () => {
    let res = fakeRes()
    config({}, res)
    expect(JSON.parse(res.body)).toEqual({ oauth: false })
    process.env.GITHUB_CLIENT_ID = 'abc'
    process.env.GITHUB_CLIENT_SECRET = 'xyz'
    res = fakeRes()
    config({}, res)
    expect(JSON.parse(res.body)).toEqual({ oauth: true })
  })

  it('login responde 503 si falta la configuración', () => {
    const res = fakeRes()
    login({ headers: {} }, res)
    expect(res.statusCode).toBe(503)
  })

  it('login manda a GitHub con un código anti-falsificación en una cookie', () => {
    process.env.GITHUB_CLIENT_ID = 'abc'
    process.env.GITHUB_CLIENT_SECRET = 'xyz'
    const res = fakeRes()
    login({ headers: { 'x-forwarded-proto': 'https' } }, res)
    expect(res.statusCode).toBe(302)
    const loc = new URL(res.headers['location']!)
    expect(loc.origin + loc.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(loc.searchParams.get('client_id')).toBe('abc')
    expect(loc.searchParams.get('scope')).toBe('repo')
    const state = loc.searchParams.get('state')!
    expect(state).toMatch(/^[0-9a-f]{32}$/)
    expect(res.headers['set-cookie']).toContain(`lienzo_oauth_state=${state}`)
    expect(res.headers['set-cookie']).toMatch(/HttpOnly/)
    expect(res.headers['set-cookie']).toMatch(/Secure/)
  })

  it('callback rechaza un código sin verificación válida', async () => {
    process.env.GITHUB_CLIENT_ID = 'abc'
    process.env.GITHUB_CLIENT_SECRET = 'xyz'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = fakeRes()
    await callback({ query: { code: 'c', state: 'otro' }, headers: { cookie: 'lienzo_oauth_state=distinto' } }, res)
    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('verificación de seguridad')
    expect(fetchSpy).not.toHaveBeenCalled() // nunca se llega a pedir el token
    const res2 = fakeRes()
    await callback({ query: { code: 'c', state: '' }, headers: { cookie: '' } }, res2)
    expect(res2.statusCode).toBe(400)
  })

  it('callback cambia el código por un token y lo entrega al navegador', async () => {
    process.env.GITHUB_CLIENT_ID = 'abc'
    process.env.GITHUB_CLIENT_SECRET = 'xyz'
    const fetchSpy = vi.fn(async () => ({ json: async () => ({ access_token: 'gho_tok</script>en' }) }))
    vi.stubGlobal('fetch', fetchSpy)
    const res = fakeRes()
    await callback({ query: { code: 'micodigo', state: 's1' }, headers: { cookie: 'x=1; lienzo_oauth_state=s1' } }, res)
    expect(res.statusCode).toBe(200)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, { body: string }]
    expect(url).toBe('https://github.com/login/oauth/access_token')
    expect(JSON.parse(init.body)).toEqual({ client_id: 'abc', client_secret: 'xyz', code: 'micodigo' })
    expect(res.body).toContain("localStorage.setItem('lienzo.token'")
    // el token nunca puede cerrar la etiqueta <script>
    expect(res.body).not.toContain('</script>en')
    expect(res.body).toContain('gho_tok\\u003c/script\\u003een')
    expect(res.headers['set-cookie']).toContain('Max-Age=0') // la cookie se borra
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('callback explica los errores de GitHub sin mostrar secretos', async () => {
    process.env.GITHUB_CLIENT_ID = 'abc'
    process.env.GITHUB_CLIENT_SECRET = 'xyz'
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ error: 'bad_verification_code', error_description: 'El código <b>venció</b>' }) }))
    const res = fakeRes()
    await callback({ query: { code: 'c', state: 's' }, headers: { cookie: 'lienzo_oauth_state=s' } }, res)
    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('El código &lt;b&gt;venció&lt;/b&gt;')
    expect(res.body).not.toContain('xyz')
    const res2 = fakeRes()
    await callback({ query: { error: 'access_denied', error_description: 'cancelado' }, headers: {} }, res2)
    expect(res2.body).toContain('cancelado')
  })
})
