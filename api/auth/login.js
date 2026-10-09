// Paso 1 del inicio de sesión con GitHub: guarda un código anti-falsificación y manda a la persona a GitHub.
import { randomBytes } from 'node:crypto'

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
    res.status(503).setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.send('El inicio de sesión con GitHub no está configurado en este sitio.')
  }
  const state = randomBytes(16).toString('hex')
  const secure = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() === 'https'
  res.setHeader(
    'Set-Cookie',
    `lienzo_oauth_state=${state}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600${secure ? '; Secure' : ''}`,
  )
  res.setHeader('Cache-Control', 'no-store')
  const params = new URLSearchParams({
    client_id: clientId,
    scope: process.env.GITHUB_SCOPE || 'repo',
    state,
    allow_signup: 'false',
  })
  res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?${params}` })
  res.end()
}
