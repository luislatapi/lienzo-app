// Paso 2: GitHub regresa aquí con un código. Se cambia por un token (el secreto nunca sale del servidor)
// y se entrega al navegador, que lo guarda como si la persona lo hubiera pegado.
import { timingSafeEqual } from 'node:crypto'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// dentro de un <script>: JSON seguro (sin cerrar la etiqueta ni saltos de línea raros)
const js = (s) => JSON.stringify(String(s)).replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return ''
}

function same(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

function page(res, status, body) {
  res.status(status)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lienzo</title>
<style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#1b1a2e;background:#faf8ff}main{max-width:420px;padding:24px;text-align:center}a{color:#e5007d;font-weight:600}</style></head><body><main>${body}</main></body></html>`)
}

function fail(res, status, text) {
  page(res, status, `<h1>No se pudo iniciar sesión</h1><p>${esc(text)}</p><p><a href="/">Volver a Lienzo</a></p>`)
}

export default async function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID
  const secret = process.env.GITHUB_CLIENT_SECRET
  // la cookie de verificación se usa una sola vez
  res.setHeader('Set-Cookie', 'lienzo_oauth_state=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0')
  if (!clientId || !secret) return fail(res, 503, 'El inicio de sesión con GitHub no está configurado en este sitio.')

  const { code, state, error, error_description: detail } = req.query || {}
  if (error) return fail(res, 400, `GitHub canceló el inicio de sesión${detail ? `: ${detail}` : '.'}`)
  if (!code || !same(state, readCookie(req.headers.cookie, 'lienzo_oauth_state'))) {
    return fail(res, 400, 'La verificación de seguridad no coincide. Vuelve a intentarlo desde Lienzo.')
  }

  let data
  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: secret, code }),
    })
    data = await r.json()
  } catch {
    return fail(res, 502, 'No se pudo hablar con GitHub. Intenta de nuevo en un momento.')
  }
  if (!data || !data.access_token) {
    return fail(res, 400, data?.error_description || 'GitHub no entregó el acceso. Vuelve a intentarlo.')
  }

  page(
    res,
    200,
    `<h1>Listo, conectado con GitHub</h1><p>Abriendo tus sitios…</p>
<script>try{localStorage.setItem('lienzo.token',${js(data.access_token)})}catch(e){}location.replace('/')</script>
<noscript><p>Activa JavaScript para terminar. <a href="/">Continuar</a></p></noscript>`,
  )
}
