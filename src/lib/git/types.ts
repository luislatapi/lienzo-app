export interface UserInfo {
  login: string
  name: string | null
  avatarUrl: string
}

export interface RepoSummary {
  owner: string
  name: string
  fullName: string
  private: boolean
  defaultBranch: string
  description: string | null
  pushedAt: string | null
  homepage: string | null
  htmlUrl: string
  canPush: boolean
}

export interface BranchInfo {
  name: string
  sha: string
  treeSha: string
  protected: boolean
}

export interface TreeEntry {
  path: string
  sha: string
  size: number
  mode: string
  type: 'blob' | 'tree' | 'commit'
}

export interface CommitChange {
  path: string
  /** string = texto UTF-8, Uint8Array = binario */
  content?: string | Uint8Array
  delete?: boolean
  mode?: string
}

export interface CommitParams {
  branch: string
  parentSha: string
  baseTreeSha: string
  message: string
  changes: CommitChange[]
}

export type DeployState = 'none' | 'pending' | 'success' | 'failure'

export interface DeploymentInfo {
  state: DeployState
  /** dirección pública del despliegue (si ya existe) */
  url?: string
  /** enlace al panel de Vercel con el detalle */
  inspectorUrl?: string
  environment?: string
  description?: string
  /** true si no se pudo consultar por falta de permisos del token */
  noAccess?: boolean
}

export interface MergeResult {
  merged: boolean
  sha?: string
}

export interface GitProvider {
  readonly kind: 'github' | 'demo'
  getUser(): Promise<UserInfo>
  listRepos(): Promise<RepoSummary[]>
  getRepo(owner: string, name: string): Promise<RepoSummary>
  listBranches(owner: string, name: string): Promise<string[]>
  getBranch(owner: string, name: string, branch: string): Promise<BranchInfo | null>
  getTree(owner: string, name: string, treeSha: string): Promise<{ entries: TreeEntry[]; truncated: boolean }>
  getBlob(owner: string, name: string, sha: string): Promise<Uint8Array>
  createBranch(owner: string, name: string, branch: string, fromSha: string): Promise<void>
  deleteBranch(owner: string, name: string, branch: string): Promise<void>
  commit(owner: string, name: string, params: CommitParams): Promise<{ sha: string; treeSha: string }>
  mergeBranch(owner: string, name: string, base: string, head: string, message: string): Promise<MergeResult>
  createPullRequest(
    owner: string,
    name: string,
    params: { title: string; head: string; base: string; body?: string },
  ): Promise<{ url: string; number: number }>
  deploymentStatus(owner: string, name: string, sha: string): Promise<DeploymentInfo>
  latestProductionUrl(owner: string, name: string): Promise<string | null>
}
