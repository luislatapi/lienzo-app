import { bytesEqual, gitBlobSha, toBytes, utf8Decode, utf8DecodeStrict, utf8Encode } from './git/bytes'
import { ConflictError, EncodingError, GitError, NotFoundError } from './git/errors'
import type { BranchInfo, CommitChange, GitProvider, RepoSummary, TreeEntry } from './git/types'
import { analyzeTree, type SiteInfo } from './site/site-info'
import { normalizePath } from './site/paths'

export type WorkingFile = { deleted: true } | { deleted?: false; content: string | Uint8Array }

const blobCache = new Map<string, Promise<Uint8Array>>()

/**
 * Copia de trabajo de un repositorio: árbol confirmado + cambios sin guardar.
 * Todo lo que el editor lee o escribe pasa por aquí.
 */
export class Project {
  readonly provider: GitProvider
  readonly repo: RepoSummary
  branch: string
  headSha = ''
  treeSha = ''
  protectedBranch = false
  tree = new Map<string, TreeEntry>()
  working = new Map<string, WorkingFile>()
  site: SiteInfo = { siteRoot: '', pages: [], images: [], cleanUrls: false, framework: null }
  truncated = false

  private listeners = new Set<() => void>()
  private _version = 0

  private constructor(provider: GitProvider, repo: RepoSummary, branch: string) {
    this.provider = provider
    this.repo = repo
    this.branch = branch
  }

  static async open(provider: GitProvider, repo: RepoSummary, branch?: string): Promise<Project> {
    const p = new Project(provider, repo, branch || repo.defaultBranch)
    await p.loadBranch(p.branch)
    return p
  }

  // ── suscripción para React ────────────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  getVersion = () => this._version
  emit() {
    this._version++
    this.listeners.forEach((fn) => fn())
  }

  // ── carga ────────────────────────────────────────────────────────────────
  private async loadBranch(branch: string) {
    const info = await this.provider.getBranch(this.repo.owner, this.repo.name, branch)
    if (!info) throw new NotFoundError(`No existe la rama "${branch}" en ${this.repo.fullName}.`)
    await this.applyBranchInfo(info)
  }

  private async applyBranchInfo(info: BranchInfo) {
    const { entries, truncated } = await this.provider.getTree(this.repo.owner, this.repo.name, info.treeSha)
    this.branch = info.name
    this.headSha = info.sha
    this.treeSha = info.treeSha
    this.protectedBranch = info.protected
    this.truncated = truncated
    this.tree = new Map(entries.filter((e) => e.type === 'blob').map((e) => [e.path, e]))
    let vercel: unknown
    let pkg: unknown
    try {
      if (this.tree.has('vercel.json')) vercel = JSON.parse((await this.readCommittedText('vercel.json')) ?? '{}')
    } catch {
      /* vercel.json inválido: se ignora */
    }
    try {
      if (this.tree.has('package.json')) pkg = JSON.parse((await this.readCommittedText('package.json')) ?? '{}')
    } catch {
      /* package.json inválido */
    }
    this.site = analyzeTree(entries, vercel, pkg)
    this.basePages = this.site.pages.slice()
    // las páginas nuevas sin guardar también cuentan
    this.refreshPages()
  }

  /** Páginas que hay en el repositorio (sin contar los cambios pendientes). */
  private basePages: string[] = []

  private refreshPages() {
    const pages = new Set(this.basePages)
    for (const [path, w] of this.working) {
      if (/\.html?$/i.test(path)) {
        if (w.deleted) pages.delete(path)
        else pages.add(path)
      }
    }
    const rank = (p: string) => (p === 'index.html' ? 0 : p.endsWith('/index.html') ? 1 : 2)
    this.site = { ...this.site, pages: [...pages].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)) }
  }

  async switchBranch(branch: string) {
    await this.loadBranch(branch)
    this.working.clear()
    this.emit()
  }

  /** Vuelve a leer la rama actual. Con keepChanges=true conserva los cambios sin guardar. */
  async reload(keepChanges = false) {
    const keep = keepChanges ? new Map(this.working) : null
    await this.loadBranch(this.branch)
    this.working = keep ?? new Map()
    this.refreshPages()
    this.emit()
  }

  // ── lectura ──────────────────────────────────────────────────────────────
  has(path: string): boolean {
    const w = this.working.get(path)
    if (w) return !w.deleted
    return this.tree.has(path)
  }

  isModified(path: string): boolean {
    return this.working.has(path)
  }

  isNew(path: string): boolean {
    return this.working.has(path) && !this.tree.has(path)
  }

  private async blob(sha: string): Promise<Uint8Array> {
    const key = `${this.repo.fullName}@${sha}`
    let p = blobCache.get(key)
    if (!p) {
      p = this.provider.getBlob(this.repo.owner, this.repo.name, sha)
      p.catch(() => blobCache.delete(key))
      blobCache.set(key, p)
    }
    return p
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const w = this.working.get(path)
    if (w) return w.deleted ? null : toBytes(w.content)
    const e = this.tree.get(path)
    if (!e) return null
    return this.blob(e.sha)
  }

  /** Archivos de texto que empezaban con la marca BOM de UTF-8: se les vuelve a poner al guardar, para no cambiar sus bytes. */
  private boms = new Set<string>()

  /** Texto UTF-8 de un archivo. Si no es UTF-8 válido se avisa en vez de guardarlo con los acentos dañados. */
  private decode(path: string, bytes: Uint8Array): string {
    const text = utf8DecodeStrict(bytes)
    if (text === null) throw new EncodingError(path)
    if (text.charCodeAt(0) === 0xfeff) {
      this.boms.add(path)
      return text.slice(1)
    }
    this.boms.delete(path)
    return text
  }

  async readText(path: string): Promise<string | null> {
    const b = await this.readBytes(path)
    return b ? this.decode(path, b) : null
  }

  /** Como readText, pero devuelve null si el archivo no está en UTF-8 (para recorrer muchos archivos sin que uno lo detenga todo). */
  async tryReadText(path: string): Promise<string | null> {
    try {
      return await this.readText(path)
    } catch (e) {
      if (e instanceof EncodingError) return null
      throw e
    }
  }

  /** Versión confirmada (la que está en GitHub), ignorando cambios sin guardar. */
  async readCommittedText(path: string): Promise<string | null> {
    const e = this.tree.get(path)
    if (!e) return null
    return this.decode(path, await this.blob(e.sha))
  }

  // ── escritura (solo en memoria hasta guardar) ───────────────────────────
  writeText(path: string, text: string) {
    const p = normalizePath(path)
    this.working.set(p, { content: this.boms.has(p) ? '\uFEFF' + text : text })
    this.refreshPages()
    this.emit()
  }

  writeBytes(path: string, bytes: Uint8Array) {
    this.working.set(normalizePath(path), { content: bytes })
    this.emit()
  }

  remove(path: string) {
    if (this.tree.has(path)) this.working.set(path, { deleted: true })
    else this.working.delete(path)
    this.refreshPages()
    this.emit()
  }

  discard(path: string) {
    this.working.delete(path)
    this.refreshPages()
    this.emit()
  }

  discardAll() {
    this.working.clear()
    this.refreshPages()
    this.emit()
  }

  /** Cambios reales: ignora archivos cuyo contenido es idéntico al confirmado. */
  async collectChanges(): Promise<CommitChange[]> {
    const out: CommitChange[] = []
    for (const [path, w] of this.working) {
      const committed = this.tree.get(path)
      if (w.deleted) {
        if (committed) out.push({ path, delete: true })
        continue
      }
      if (committed) {
        const sha = await gitBlobSha(w.content)
        if (sha === committed.sha) continue
        out.push({ path, content: w.content, mode: committed.mode })
      } else {
        out.push({ path, content: w.content })
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }

  async changedPaths(): Promise<string[]> {
    return (await this.collectChanges()).map((c) => c.path)
  }

  get hasPendingEdits(): boolean {
    return this.working.size > 0
  }

  // ── guardar ──────────────────────────────────────────────────────────────
  /**
   * Crea un commit con todos los cambios en la rama actual.
   * Si alguien más tocó los mismos archivos en GitHub lanza ConflictError (a menos que overwrite=true).
   */
  async save(message: string, opts: { overwrite?: boolean; targetBranch?: string } = {}): Promise<{ sha: string; branch: string; files: number }> {
    const changes = await this.collectChanges()
    if (changes.length === 0) throw new GitError('No hay cambios para guardar.')
    const { owner, name } = this.repo
    const branch = opts.targetBranch || this.branch
    let info = await this.provider.getBranch(owner, name, branch)
    if (!info) throw new NotFoundError(`La rama "${branch}" ya no existe en GitHub.`)

    if (branch === this.branch && info.sha !== this.headSha && !opts.overwrite) {
      // La rama avanzó: solo seguimos si nadie tocó nuestros archivos.
      const { entries } = await this.provider.getTree(owner, name, info.treeSha)
      const latest = new Map(entries.map((e) => [e.path, e.sha]))
      const clashes = changes
        .filter((c) => (latest.get(c.path) ?? null) !== (this.tree.get(c.path)?.sha ?? null))
        .map((c) => c.path)
      if (clashes.length) throw new ConflictError('Estos archivos cambiaron en GitHub mientras los editabas.', clashes)
    }

    const result = await this.provider.commit(owner, name, {
      branch,
      parentSha: info.sha,
      baseTreeSha: info.treeSha,
      message,
      changes,
    })
    info = { ...info, sha: result.sha, treeSha: result.treeSha }
    if (branch === this.branch) {
      const saved = new Set(changes.map((c) => c.path))
      for (const p of saved) this.working.delete(p)
      await this.applyBranchInfo(info)
      this.emit()
    }
    return { sha: result.sha, branch, files: changes.length }
  }

  /** Crea una rama nueva desde la actual y se queda trabajando en ella (los cambios sin guardar se conservan). */
  async startBranch(name: string): Promise<void> {
    const existing = await this.provider.getBranch(this.repo.owner, this.repo.name, name)
    if (!existing) await this.provider.createBranch(this.repo.owner, this.repo.name, name, this.headSha)
    const keep = new Map(this.working)
    await this.loadBranch(name)
    this.working = keep
    this.refreshPages()
    this.emit()
  }
}

export function textOf(content: string | Uint8Array): string {
  return typeof content === 'string' ? content : utf8Decode(content)
}

export { bytesEqual, utf8Encode }
