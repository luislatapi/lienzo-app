import { ConflictError, GitError, NotFoundError } from './errors'
import { gitBlobSha, sha1Hex, toBytes, utf8Decode } from './bytes'
import { DEMO_REPO_FILES } from './demo-site'
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

interface Commit {
  sha: string
  tree: Map<string, { sha: string; mode: string }>
  parents: string[]
  message: string
  time: number
}

interface DemoRepo {
  summary: RepoSummary
  blobs: Map<string, Uint8Array>
  commits: Map<string, Commit>
  branches: Map<string, string>
  deploys: Map<string, { at: number; branch: string }>
}

const TREE_PREFIX = 'tree-'

/**
 * Proveedor en memoria que imita a GitHub: sirve para probar el editor sin conectar una cuenta.
 * Nada se guarda fuera del navegador y se reinicia al recargar la página.
 */
export class DemoProvider implements GitProvider {
  readonly kind = 'demo' as const
  private repos = new Map<string, DemoRepo>()
  /** milisegundos que tarda el despliegue simulado */
  deployDelayMs = 3500

  static async create(): Promise<DemoProvider> {
    const p = new DemoProvider()
    await p.seed('demo', 'casa-nopal', 'Sitio de ejemplo: panadería de barrio en la Roma Norte', DEMO_REPO_FILES)
    return p
  }

  private async seed(owner: string, name: string, description: string, files: Record<string, string>) {
    const blobs = new Map<string, Uint8Array>()
    const tree = new Map<string, { sha: string; mode: string }>()
    for (const [path, content] of Object.entries(files)) {
      const bytes = toBytes(content)
      const sha = await gitBlobSha(bytes)
      blobs.set(sha, bytes)
      tree.set(path, { sha, mode: '100644' })
    }
    const commitSha = await sha1Hex(`seed:${owner}/${name}`)
    const commit: Commit = { sha: commitSha, tree, parents: [], message: 'Primer commit', time: Date.now() }
    this.repos.set(`${owner}/${name}`, {
      summary: {
        owner,
        name,
        fullName: `${owner}/${name}`,
        private: false,
        defaultBranch: 'main',
        description,
        pushedAt: new Date().toISOString(),
        homepage: null,
        htmlUrl: `https://github.com/${owner}/${name}`,
        canPush: true,
      },
      blobs,
      commits: new Map([[commitSha, commit]]),
      branches: new Map([['main', commitSha]]),
      deploys: new Map(),
    })
  }

  private repo(owner: string, name: string): DemoRepo {
    const r = this.repos.get(`${owner}/${name}`)
    if (!r) throw new NotFoundError()
    return r
  }

  async getUser(): Promise<UserInfo> {
    return { login: 'demo', name: 'Modo demo', avatarUrl: '' }
  }

  async listRepos(): Promise<RepoSummary[]> {
    return [...this.repos.values()].map((r) => r.summary)
  }

  async getRepo(owner: string, name: string): Promise<RepoSummary> {
    return this.repo(owner, name).summary
  }

  async listBranches(owner: string, name: string): Promise<string[]> {
    return [...this.repo(owner, name).branches.keys()]
  }

  async getBranch(owner: string, name: string, branch: string): Promise<BranchInfo | null> {
    const r = this.repo(owner, name)
    const sha = r.branches.get(branch)
    if (!sha) return null
    return { name: branch, sha, treeSha: TREE_PREFIX + sha, protected: false }
  }

  async getTree(owner: string, name: string, treeSha: string): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
    const r = this.repo(owner, name)
    const commit = r.commits.get(treeSha.replace(TREE_PREFIX, ''))
    if (!commit) throw new NotFoundError()
    const entries: TreeEntry[] = [...commit.tree.entries()].map(([path, e]) => ({
      path,
      sha: e.sha,
      mode: e.mode,
      type: 'blob' as const,
      size: r.blobs.get(e.sha)?.length ?? 0,
    }))
    return { entries, truncated: false }
  }

  async getBlob(owner: string, name: string, sha: string): Promise<Uint8Array> {
    const b = this.repo(owner, name).blobs.get(sha)
    if (!b) throw new NotFoundError()
    return b
  }

  async createBranch(owner: string, name: string, branch: string, fromSha: string): Promise<void> {
    const r = this.repo(owner, name)
    if (r.branches.has(branch)) throw new GitError('Reference already exists', 422)
    if (!r.commits.has(fromSha)) throw new NotFoundError()
    r.branches.set(branch, fromSha)
  }

  async deleteBranch(owner: string, name: string, branch: string): Promise<void> {
    this.repo(owner, name).branches.delete(branch)
  }

  async commit(owner: string, name: string, p: CommitParams): Promise<{ sha: string; treeSha: string }> {
    const r = this.repo(owner, name)
    const current = r.branches.get(p.branch)
    if (!current) throw new NotFoundError()
    const base = r.commits.get(p.baseTreeSha.replace(TREE_PREFIX, ''))
    if (!base) throw new NotFoundError()
    const tree = new Map(base.tree)
    for (const c of p.changes) {
      if (c.delete) {
        tree.delete(c.path)
        continue
      }
      const bytes = toBytes(c.content ?? '')
      const sha = await gitBlobSha(bytes)
      r.blobs.set(sha, bytes)
      tree.set(c.path, { sha, mode: c.mode || '100644' })
    }
    if (current !== p.parentSha) throw new ConflictError('Update is not a fast forward')
    const time = Date.now()
    const sha = await sha1Hex(JSON.stringify([...tree.entries()]) + p.message + time + Math.random())
    r.commits.set(sha, { sha, tree, parents: [p.parentSha], message: p.message, time })
    r.branches.set(p.branch, sha)
    r.deploys.set(sha, { at: time, branch: p.branch })
    r.summary.pushedAt = new Date(time).toISOString()
    return { sha, treeSha: TREE_PREFIX + sha }
  }

  private ancestors(r: DemoRepo, sha: string): Set<string> {
    const seen = new Set<string>()
    const stack = [sha]
    while (stack.length) {
      const s = stack.pop()!
      if (seen.has(s)) continue
      seen.add(s)
      const c = r.commits.get(s)
      if (c) stack.push(...c.parents)
    }
    return seen
  }

  async mergeBranch(owner: string, name: string, base: string, head: string, message: string): Promise<MergeResult> {
    const r = this.repo(owner, name)
    const baseSha = r.branches.get(base)
    const headSha = r.branches.get(head)
    if (!baseSha || !headSha) throw new NotFoundError()
    if (this.ancestors(r, baseSha).has(headSha)) return { merged: false }
    if (this.ancestors(r, headSha).has(baseSha)) {
      r.branches.set(base, headSha)
      r.deploys.set(headSha, { at: Date.now(), branch: base })
      return { merged: true, sha: headSha }
    }
    // Fusión a tres bandas sencilla
    const baseAnc = this.ancestors(r, baseSha)
    const mergeBaseSha = [...this.ancestors(r, headSha)].find((s) => baseAnc.has(s))
    const mergeBase = mergeBaseSha ? r.commits.get(mergeBaseSha)! : { tree: new Map() as Commit['tree'] }
    const baseTree = r.commits.get(baseSha)!.tree
    const headTree = r.commits.get(headSha)!.tree
    const tree = new Map(baseTree)
    const conflicts: string[] = []
    for (const path of new Set([...headTree.keys(), ...mergeBase.tree.keys()])) {
      const mb = mergeBase.tree.get(path)?.sha
      const h = headTree.get(path)?.sha
      const b = baseTree.get(path)?.sha
      if (h === mb) continue
      if (b !== mb && b !== h) {
        conflicts.push(path)
        continue
      }
      if (h) tree.set(path, headTree.get(path)!)
      else tree.delete(path)
    }
    if (conflicts.length) throw new ConflictError('Hay conflictos al fusionar.', conflicts)
    const time = Date.now()
    const sha = await sha1Hex(`merge${baseSha}${headSha}${time}`)
    r.commits.set(sha, { sha, tree, parents: [baseSha, headSha], message, time })
    r.branches.set(base, sha)
    r.deploys.set(sha, { at: time, branch: base })
    return { merged: true, sha }
  }

  async createPullRequest(): Promise<{ url: string; number: number }> {
    return { url: 'https://github.com', number: 1 }
  }

  async deploymentStatus(owner: string, name: string, sha: string): Promise<DeploymentInfo> {
    const r = this.repo(owner, name)
    const d = r.deploys.get(sha)
    if (!d) return { state: 'none' }
    const production = d.branch === r.summary.defaultBranch
    const elapsed = Date.now() - d.at
    if (elapsed < this.deployDelayMs) {
      return { state: 'pending', environment: production ? 'Production' : 'Preview', description: 'Construyendo…' }
    }
    return {
      state: 'success',
      environment: production ? 'Production' : 'Preview',
      url: production ? `https://${name}-demo.vercel.app` : `https://${name}-git-${d.branch}-demo.vercel.app`,
      description: 'Despliegue simulado',
    }
  }

  async latestProductionUrl(owner: string, name: string): Promise<string | null> {
    this.repo(owner, name)
    return null
  }

  /** Solo para pruebas: lee un archivo de texto del último commit de una rama. */
  async debugReadText(owner: string, name: string, branch: string, path: string): Promise<string | null> {
    const r = this.repo(owner, name)
    const sha = r.branches.get(branch)
    if (!sha) return null
    const e = r.commits.get(sha)?.tree.get(path)
    if (!e) return null
    return utf8Decode(r.blobs.get(e.sha)!)
  }

  /** Solo para pruebas: simula que alguien más hizo un commit en la rama. */
  async debugExternalCommit(owner: string, name: string, branch: string, path: string, content: string): Promise<string> {
    const b = await this.getBranch(owner, name, branch)
    if (!b) throw new NotFoundError()
    const r = await this.commit(owner, name, {
      branch,
      parentSha: b.sha,
      baseTreeSha: b.treeSha,
      message: 'Cambio externo',
      changes: [{ path, content }],
    })
    return r.sha
  }
}
