/**
 * GitHub de mentira para pruebas: implementa la parte de la API REST que usa Lienzo
 * (usuario, repos, ramas, Git Data API, merges, pull requests, estados de Vercel).
 * Guarda todo en memoria y calcula SHA reales de blobs, así que se comporta como el verdadero.
 */
import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

type Files = Map<string, { mode: string; sha: string }>
interface Commit {
  sha: string
  tree: string
  parents: string[]
  message: string
}

export interface MockOptions {
  /** archivos iniciales de la rama main (ruta → contenido) */
  files: Record<string, string>
  owner?: string
  repo?: string
  token?: string
  /** cuánto tarda Vercel en "terminar" el despliegue (ms) */
  deployMs?: number
}

const sha1 = (data: string | Buffer) => createHash('sha1').update(data).digest('hex')
const blobSha = (data: Buffer) => sha1(Buffer.concat([Buffer.from(`blob ${data.length}\0`), data]))

export interface MockGitHub {
  url: string
  port: number
  token: string
  close(): Promise<void>
  /** simula que otra persona sube cambios a una rama */
  push(branch: string, files: Record<string, string | null>, message?: string): string
  readFile(branch: string, path: string): string | null
  branches(): string[]
  messages(branch: string): string[]
  setRateLimited(on: boolean): void
  requests: Array<{ method: string; path: string }>
}

export async function startMockGitHub(opts: MockOptions, port = 0): Promise<MockGitHub> {
  const owner = opts.owner ?? 'luis'
  const repoName = opts.repo ?? 'casa-nopal'
  const token = opts.token ?? 'ghp_testtoken'
  const deployMs = opts.deployMs ?? 2500

  const blobs = new Map<string, Buffer>()
  const trees = new Map<string, Files>()
  const commits = new Map<string, Commit>()
  const refs = new Map<string, string>()
  const pushedAt = new Map<string, number>()
  const requests: Array<{ method: string; path: string }> = []
  let rateLimited = false
  let seq = 0
  let prSeq = 0

  const putBlob = (data: Buffer) => {
    const s = blobSha(data)
    blobs.set(s, data)
    return s
  }
  const putTree = (files: Files) => {
    const s = sha1([...files].sort(([a], [b]) => a.localeCompare(b)).map(([p, f]) => `${f.mode} ${p} ${f.sha}`).join('\n') || 'empty')
    trees.set(s, new Map(files))
    return s
  }
  const putCommit = (tree: string, parents: string[], message: string) => {
    const s = sha1(`${tree}|${parents.join(',')}|${message}|${++seq}`)
    commits.set(s, { sha: s, tree, parents, message })
    return s
  }
  const ancestors = (sha: string): Set<string> => {
    const seen = new Set<string>()
    const stack = [sha]
    while (stack.length) {
      const c = stack.pop()!
      if (seen.has(c)) continue
      seen.add(c)
      for (const p of commits.get(c)?.parents ?? []) stack.push(p)
    }
    return seen
  }

  // contenido inicial
  const initial: Files = new Map()
  for (const [path, text] of Object.entries(opts.files)) initial.set(path, { mode: '100644', sha: putBlob(Buffer.from(text, 'utf8')) })
  const firstCommit = putCommit(putTree(initial), [], 'Primer commit')
  refs.set('main', firstCommit)
  pushedAt.set(firstCommit, Date.now() - 60_000)

  const headTree = (branch: string): Files => trees.get(commits.get(refs.get(branch)!)!.tree)!

  const repoJson = () => ({
    name: repoName,
    full_name: `${owner}/${repoName}`,
    private: false,
    default_branch: 'main',
    description: 'Sitio de prueba',
    pushed_at: new Date().toISOString(),
    homepage: null,
    html_url: `https://github.com/${owner}/${repoName}`,
    owner: { login: owner },
    permissions: { push: true, admin: true },
  })

  function applyFiles(branch: string, changes: Record<string, string | null>, message: string): string {
    const files: Files = new Map(headTree(branch))
    for (const [path, content] of Object.entries(changes)) {
      if (content === null) files.delete(path)
      else files.set(path, { mode: '100644', sha: putBlob(Buffer.from(content, 'utf8')) })
    }
    const c = putCommit(putTree(files), [refs.get(branch)!], message)
    refs.set(branch, c)
    pushedAt.set(c, Date.now())
    return c
  }

  function deployState(sha: string): 'pending' | 'success' {
    return Date.now() - (pushedAt.get(sha) ?? 0) >= deployMs ? 'success' : 'pending'
  }
  const branchOf = (sha: string) => [...refs].find(([, s]) => s === sha)?.[0] ?? 'main'
  const prodUrl = `https://${repoName}.vercel.app`

  async function readBody(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const text = Buffer.concat(chunks).toString('utf8')
    return text ? JSON.parse(text) : undefined
  }

  const json = (res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', 'http://x')
    const path = decodeURIComponent(url.pathname)
    const method = req.method || 'GET'
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, accept')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Expose-Headers', 'x-ratelimit-remaining')
    if (method === 'OPTIONS') {
      res.writeHead(204)
      return res.end()
    }
    if (!path.startsWith('/__test')) requests.push({ method, path })

    // ── ganchos de prueba (sin autenticación) ───────────────────────────
    if (path.startsWith('/__test')) {
      if (path === '/__test/push' && method === 'POST') {
        const b = await readBody(req)
        return json(res, 200, { sha: applyFiles(b.branch || 'main', b.files, b.message || 'Cambio externo') })
      }
      if (path === '/__test/file') {
        const f = headTree(url.searchParams.get('branch') || 'main').get(url.searchParams.get('path') || '')
        if (!f) return json(res, 404, { message: 'Not Found' })
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end(blobs.get(f.sha))
      }
      if (path === '/__test/branches') return json(res, 200, [...refs.keys()])
      return json(res, 404, { message: 'Not Found' })
    }

    if (rateLimited) return json(res, 403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' })
    if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { message: 'Bad credentials' })

    const base = `/repos/${owner}/${repoName}`
    let m: RegExpMatchArray | null

    if (path === '/user') return json(res, 200, { login: owner, name: 'Luis Prueba', avatar_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' })
    if (path === '/user/repos') return json(res, 200, url.searchParams.get('page') === '1' || !url.searchParams.get('page') ? [repoJson()] : [])
    if (path === base) return json(res, 200, repoJson())
    if (path === `${base}/branches`) return json(res, 200, [...refs.keys()].map((name) => ({ name })))

    if ((m = path.match(new RegExp(`^${base}/branches/(.+)$`)))) {
      const sha = refs.get(m[1]!)
      if (!sha) return json(res, 404, { message: 'Branch not found' })
      return json(res, 200, { name: m[1], protected: false, commit: { sha, commit: { tree: { sha: commits.get(sha)!.tree } } } })
    }

    if ((m = path.match(new RegExp(`^${base}/git/trees/([0-9a-f]+)$`))) && method === 'GET') {
      const files = trees.get(m[1]!)
      if (!files) return json(res, 404, { message: 'Not Found' })
      const dirs = new Set<string>()
      for (const p of files.keys()) {
        const parts = p.split('/')
        for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
      }
      const tree = [
        ...[...dirs].map((d) => ({ path: d, mode: '040000', type: 'tree', sha: sha1('dir:' + d) })),
        ...[...files].map(([p, f]) => ({ path: p, mode: f.mode, type: 'blob', sha: f.sha, size: blobs.get(f.sha)!.length })),
      ]
      return json(res, 200, { sha: m[1], truncated: false, tree })
    }

    if ((m = path.match(new RegExp(`^${base}/git/blobs/([0-9a-f]+)$`))) && method === 'GET') {
      const b = blobs.get(m[1]!)
      if (!b) return json(res, 404, { message: 'Not Found' })
      return json(res, 200, { sha: m[1], encoding: 'base64', content: b.toString('base64') })
    }
    if (path === `${base}/git/blobs` && method === 'POST') {
      const b = await readBody(req)
      const data = b.encoding === 'base64' ? Buffer.from(b.content, 'base64') : Buffer.from(b.content, 'utf8')
      return json(res, 201, { sha: putBlob(data) })
    }
    if (path === `${base}/git/trees` && method === 'POST') {
      const b = await readBody(req)
      const files: Files = new Map(trees.get(b.base_tree) ?? [])
      for (const e of b.tree as Array<{ path: string; mode: string; sha: string | null }>) {
        if (e.sha === null) files.delete(e.path)
        else files.set(e.path, { mode: e.mode, sha: e.sha })
      }
      return json(res, 201, { sha: putTree(files) })
    }
    if (path === `${base}/git/commits` && method === 'POST') {
      const b = await readBody(req)
      if (!trees.has(b.tree)) return json(res, 422, { message: 'Tree does not exist' })
      return json(res, 201, { sha: putCommit(b.tree, b.parents, b.message) })
    }
    if (path === `${base}/git/refs` && method === 'POST') {
      const b = await readBody(req)
      const name = String(b.ref).replace(/^refs\/heads\//, '')
      if (refs.has(name)) return json(res, 422, { message: 'Reference already exists' })
      if (!commits.has(b.sha)) return json(res, 422, { message: 'Object does not exist' })
      refs.set(name, b.sha)
      pushedAt.set(b.sha, Date.now())
      return json(res, 201, { ref: b.ref, object: { sha: b.sha } })
    }
    if ((m = path.match(new RegExp(`^${base}/git/refs/heads/(.+)$`)))) {
      const name = m[1]!
      if (method === 'PATCH') {
        const b = await readBody(req)
        const current = refs.get(name)
        if (!current) return json(res, 404, { message: 'Reference does not exist' })
        if (!commits.has(b.sha)) return json(res, 422, { message: 'Object does not exist' })
        if (!b.force && !ancestors(b.sha).has(current)) return json(res, 422, { message: 'Update is not a fast forward' })
        refs.set(name, b.sha)
        pushedAt.set(b.sha, Date.now())
        return json(res, 200, { ref: `refs/heads/${name}`, object: { sha: b.sha } })
      }
      if (method === 'DELETE') {
        refs.delete(name)
        return json(res, 204)
      }
    }

    if (path === `${base}/merges` && method === 'POST') {
      const b = await readBody(req)
      const baseSha = refs.get(b.base)
      const headSha = refs.get(b.head)
      if (!baseSha || !headSha) return json(res, 404, { message: 'Not Found' })
      if (ancestors(baseSha).has(headSha)) return json(res, 204)
      if (!ancestors(headSha).has(baseSha)) return json(res, 409, { message: 'Merge conflict' })
      const merged = putCommit(commits.get(headSha)!.tree, [baseSha, headSha], b.commit_message || 'Merge')
      refs.set(b.base, merged)
      pushedAt.set(merged, Date.now())
      return json(res, 201, { sha: merged })
    }
    if (path === `${base}/pulls` && method === 'POST') {
      const b = await readBody(req)
      const n = ++prSeq
      return json(res, 201, { number: n, html_url: `https://github.com/${owner}/${repoName}/pull/${n}`, title: b.title })
    }

    if ((m = path.match(new RegExp(`^${base}/commits/([0-9a-f]+)/status$`)))) {
      const sha = m[1]!
      if (!commits.has(sha)) return json(res, 404, { message: 'Not Found' })
      const state = deployState(sha)
      return json(res, 200, {
        state,
        statuses: [
          {
            context: 'Vercel',
            state,
            description: state === 'success' ? 'Deployment has completed' : 'Building',
            target_url: `https://vercel.com/${owner}/${repoName}/${sha.slice(0, 7)}`,
          },
        ],
      })
    }
    if (path === `${base}/deployments` && method === 'GET') {
      const sha = url.searchParams.get('sha')
      const env = url.searchParams.get('environment')
      const wanted = sha ? [sha] : [...refs.values()]
      const out = wanted
        .filter((s) => commits.has(s) && Date.now() - (pushedAt.get(s) ?? 0) > 400)
        .map((s) => ({ id: parseInt(s.slice(0, 8), 16), environment: branchOf(s) === 'main' ? 'Production' : 'Preview', sha: s }))
        .filter((d) => !env || d.environment === env)
      return json(res, 200, out)
    }
    if ((m = path.match(new RegExp(`^${base}/deployments/(\\d+)/statuses$`)))) {
      const id = Number(m[1])
      const sha = [...commits.keys()].find((s) => parseInt(s.slice(0, 8), 16) === id)
      if (!sha) return json(res, 404, { message: 'Not Found' })
      const state = deployState(sha)
      const isMain = branchOf(sha) === 'main'
      return json(res, 200, [
        {
          state,
          environment_url: state === 'success' ? (isMain ? prodUrl : `https://${repoName}-git-${sha.slice(0, 7)}.vercel.app`) : undefined,
          target_url: `https://vercel.com/${owner}/${repoName}/${sha.slice(0, 7)}`,
          description: state === 'success' ? 'Deployment has completed' : 'Building',
        },
      ])
    }
    return json(res, 404, { message: 'Not Found' })
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((e) => json(res, 500, { message: String(e?.message ?? e) }))
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  const actualPort = (server.address() as AddressInfo).port

  return {
    url: `http://127.0.0.1:${actualPort}`,
    port: actualPort,
    token,
    close: () => new Promise((resolve) => server.close(() => resolve())),
    push: (branch, files, message = 'Cambio externo') => applyFiles(branch, files, message),
    readFile: (branch, path) => {
      const f = refs.has(branch) ? headTree(branch).get(path) : undefined
      return f ? blobs.get(f.sha)!.toString('utf8') : null
    },
    branches: () => [...refs.keys()],
    messages: (branch) => {
      const out: string[] = []
      let cur: string | undefined = refs.get(branch)
      while (cur) {
        const c: Commit | undefined = commits.get(cur)
        if (!c) break
        out.push(c.message)
        cur = c.parents[0]
      }
      return out
    },
    setRateLimited: (on) => {
      rateLimited = on
    },
    requests,
  }
}
