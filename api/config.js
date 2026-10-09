// Le dice al editor si este despliegue tiene configurado el inicio de sesión con GitHub (OAuth).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ oauth: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) })
}
