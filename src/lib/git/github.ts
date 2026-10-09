import { AuthError, ConflictError, GitError, NetworkError, NotFoundError, PermissionError, RateLimitError } from './errors'
import { base64ToBytes, bytesToBase64, toBytes } from './bytes'
import type {
  BranchInfo,
  CommitParams,
  DeploymentInfo,
  GitProvider,
  MergeResult,
  RepoSummary,
  TreeEntry,
  UserInfo,
} from './types'

interface RawRepo {
  name: string
  full_name: string
  private: boolean
  default_branch: string
  description: string | null
  pushed_at: string | null
  homepage: string | null
  html_url: string
  owner: { login: string }
  permissions?: { push?: boolean; admin?: boolean }
}

function mapRepo(r: RawRepo): RepoSummary {
  return {
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    description: r.description,
    pushedAt: r.pushed_at,
    homepage: r.homepage || null,
    htmlUrl: r.html_url,
    canPush: !!(r.permissions?.push || r.permissions?.admin),
  }
}

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

/** Ejecuta tareas con un límite de concurrencia. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

export class GitHubProvider implements GitProvider {
  readonly kind = 'github' as const
  private repoListCache: RepoSummary[] | null = null

  constructor(
    private token: string,
    private apiBase = 'https://api.github.com',
  ) {}

  private async request<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.apiBase + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      })
    } catch {
      throw new NetworkError()
    }
    if (res.ok || okStatuses.includes(res.status)) {
      if (res.status === 204) return undefined as T
      const text = await res.text()
      return (text ? JSON.parse(text) : undefined) as T
    }
    let message = ''
    try {
      const j = await res.json()
      message = j.message || ''
      if (res.status === 422 && Array.isArray(j.errors) && j.errors.length) {
        message += ' ' + j.errors.map((e: { message?: string }) => e.message || '').join(' ')
      }
    } catch {
      /* sin cuerpo */
    }
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (res.status === 401) throw new AuthError()
    if (res.status === 403 && (remaining === '0' || /rate limit/i.test(message))) throw new RateLimitError()
    if (res.status === 403) throw new PermissionError(message ? `GitHub respondió: ${message}` : undefined)
    if (res.status === 404) throw new NotFoundError()
    if (res.status === 409 || (res.status === 422 && /fast forward|not a fast/i.test(message))) {
      throw new ConflictError(message || undefined)
    }
    throw new GitError(`GitHub respondió ${res.status}${message ? `: ${message}` : ''}`, res.status)
  }

  async getUser(): Promise<UserInfo> {
    const u = await this.request<{ login: string; name: string | null; avatar_url: string }>('GET', '/user')
    return { login: u.login, name: u.name, avatarUrl: u.avatar_url }
  }

  async listRepos(): Promise<RepoSummary[]> {
    if (this.repoListCache) return this.repoListCache
    const all: RepoSummary[] = []
    for (let page = 1; page <= 10; page++) {
      const batch = await this.request<RawRepo[]>(
        'GET',
        `/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`,
      )
      all.push(...batch.map(mapRepo))
      if (batch.length < 100) break
    }
    this.repoListCache = all
    return all
  }

  async getRepo(owner: string, name: string): Promise<RepoSummary> {
    return mapRepo(await this.request<RawRepo>('GET', `/repos/${owner}/${name}`))
  }

  async listBranches(owner: string, name: string): Promise<string[]> {
    const out: string[] = []
    for (let page = 1; page <= 5; page++) {
      const batch = await this.request<Array<{ name: string }>>('GET', `/repos/${owner}/${name}/branches?per_page=100&page=${page}`)
      out.push(...batch.map((b) => b.name))
      if (batch.length < 100) break
    }
    return out
  }

  async getBranch(owner: string, name: string, branch: string): Promise<BranchInfo | null> {
    try {
      const b = await this.request<{
        name: string
        protected: boolean
        commit: { sha: string; commit: { tree: { sha: string } } }
      }>('GET', `/repos/${owner}/${name}/branches/${encodePath(branch)}`)
      return { name: b.name, sha: b.commit.sha, treeSha: b.commit.commit.tree.sha, protected: b.protected }
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  }

  async getTree(owner: string, name: string, treeSha: string): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
    const t = await this.request<{
      truncated: boolean
      tree: Array<{ path: string; mode: string; type: 'blob' | 'tree' | 'commit'; sha: string; size?: number }>
    }>('GET', `/repos/${owner}/${name}/git/trees/${treeSha}?recursive=1`)
    return {
      truncated: !!t.truncated,
      entries: t.tree.map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha, size: e.size ?? 0 })),
    }
  }

  async getBlob(owner: string, name: string, sha: string): Promise<Uint8Array> {
    const b = await this.request<{ content: string; encoding: string }>('GET', `/repos/${owner}/${name}/git/blobs/${sha}`)
    if (b.encoding === 'base64') return base64ToBytes(b.content)
    return toBytes(b.content)
  }

  async createBranch(owner: string, name: string, branch: string, fromSha: string): Promise<void> {
    await this.request('POST', `/repos/${owner}/${name}/git/refs`, { ref: `refs/heads/${branch}`, sha: fromSha })
  }

  async deleteBranch(owner: string, name: string, branch: string): Promise<void> {
    await this.request('DELETE', `/repos/${owner}/${name}/git/refs/heads/${encodePath(branch)}`, undefined, [204])
  }

  async commit(owner: string, name: string, p: CommitParams): Promise<{ sha: string; treeSha: string }> {
    const base = `/repos/${owner}/${name}/git`
    // 1) Sube los archivos nuevos o modificados como blobs
    const entries = await mapLimit(p.changes, 4, async (c) => {
      if (c.delete) return { path: c.path, mode: '100644', type: 'blob' as const, sha: null }
      const bytes = toBytes(c.content ?? '')
      const blob = await this.request<{ sha: string }>('POST', `${base}/blobs`, {
        content: bytesToBase64(bytes),
        encoding: 'base64',
      })
      return { path: c.path, mode: c.mode || '100644', type: 'blob' as const, sha: blob.sha }
    })
    // 2) Árbol nuevo sobre el árbol actual de la rama
    const tree = await this.request<{ sha: string }>('POST', `${base}/trees`, { base_tree: p.baseTreeSha, tree: entries })
    // 3) Commit
    const commit = await this.request<{ sha: string }>('POST', `${base}/commits`, {
      message: p.message,
      tree: tree.sha,
      parents: [p.parentSha],
    })
    // 4) Mueve la rama (sin force: si alguien más la movió, falla y se avisa del conflicto)
    await this.request('PATCH', `${base}/refs/heads/${encodePath(p.branch)}`, { sha: commit.sha, force: false })
    return { sha: commit.sha, treeSha: tree.sha }
  }

  async mergeBranch(owner: string, name: string, base: string, head: string, message: string): Promise<MergeResult> {
    const r = await this.request<{ sha?: string } | undefined>(
      'POST',
      `/repos/${owner}/${name}/merges`,
      { base, head, commit_message: message },
      [204],
    )
    if (!r) return { merged: false }
    return { merged: true, sha: r.sha }
  }

  async createPullRequest(
    owner: string,
    name: string,
    params: { title: string; head: string; base: string; body?: string },
  ): Promise<{ url: string; number: number }> {
    const pr = await this.request<{ html_url: string; number: number }>('POST', `/repos/${owner}/${name}/pulls`, params)
    return { url: pr.html_url, number: pr.number }
  }

  async deploymentStatus(owner: string, name: string, sha: string): Promise<DeploymentInfo> {
    let noAccess = false
    const guard = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn()
      } catch (e) {
        if (e instanceof PermissionError || e instanceof NotFoundError || e instanceof AuthError) noAccess = true
        else if (!(e instanceof GitError)) throw e
        return fallback
      }
    }
    const [combined, deployments] = await Promise.all([
      guard(
        () =>
          this.request<{ statuses: Array<{ context: string; state: string; description: string | null; target_url: string | null }> }>(
            'GET',
            `/repos/${owner}/${name}/commits/${sha}/status`,
          ),
        { statuses: [] },
      ),
      guard(
        () =>
          this.request<Array<{ id: number; environment: string }>>('GET', `/repos/${owner}/${name}/deployments?sha=${sha}&per_page=5`),
        [],
      ),
    ])
    const vercelStatus = combined.statuses.find((s) => /vercel/i.test(s.context))
    let depState: string | undefined
    let url: string | undefined
    let inspector: string | undefined
    let environment: string | undefined
    let description: string | undefined
    if (deployments.length) {
      const d = deployments[0]
      environment = d.environment
      const statuses = await guard(
        () =>
          this.request<Array<{ state: string; environment_url?: string; target_url?: string; description?: string }>>(
            'GET',
            `/repos/${owner}/${name}/deployments/${d.id}/statuses?per_page=5`,
          ),
        [],
      )
      if (statuses.length) {
        depState = statuses[0].state
        url = statuses.find((s) => s.environment_url)?.environment_url
        inspector = statuses[0].target_url
        description = statuses[0].description
      }
    }
    const state = normalizeState(depState ?? vercelStatus?.state)
    if (vercelStatus && !inspector) inspector = vercelStatus.target_url ?? undefined
    if (vercelStatus && !description) description = vercelStatus.description ?? undefined
    return { state, url, inspectorUrl: inspector, environment, description, noAccess: noAccess && state === 'none' }
  }

  async latestProductionUrl(owner: string, name: string): Promise<string | null> {
    try {
      const deployments = await this.request<Array<{ id: number }>>(
        'GET',
        `/repos/${owner}/${name}/deployments?environment=Production&per_page=5`,
      )
      for (const d of deployments) {
        const statuses = await this.request<Array<{ state: string; environment_url?: string }>>(
          'GET',
          `/repos/${owner}/${name}/deployments/${d.id}/statuses?per_page=5`,
        )
        const ok = statuses.find((s) => s.state === 'success' && s.environment_url)
        if (ok?.environment_url) return ok.environment_url
      }
    } catch (e) {
      if (!(e instanceof GitError)) throw e
    }
    return null
  }
}

function normalizeState(s: string | undefined): DeploymentInfo['state'] {
  switch (s) {
    case 'success':
      return 'success'
    case 'failure':
    case 'error':
      return 'failure'
    case 'pending':
    case 'queued':
    case 'in_progress':
      return 'pending'
    default:
      return 'none'
  }
}
