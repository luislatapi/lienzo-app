import { normalizeHtml, preserveFormat } from '../site/document'
import { Project } from '../project'
import { EditorEngine } from './engine'

/**
 * Une el proyecto (archivos del repo + cambios sin guardar) con el motor del editor (página abierta).
 */
export class EditorController {
  currentPath: string | null = null
  private opening: Promise<void> | null = null

  constructor(
    readonly project: Project,
    readonly engine: EditorEngine,
  ) {}

  /** Abre una página en el lienzo. Si había otra con cambios, se guardan antes en la copia de trabajo. */
  async openPage(path: string): Promise<void> {
    if (this.opening) await this.opening.catch(() => undefined)
    this.opening = this.doOpen(path)
    try {
      await this.opening
    } finally {
      this.opening = null
    }
  }

  private async doOpen(path: string) {
    await this.commitCurrentPage()
    const html = await this.project.readText(path)
    if (html === null) throw new Error(`No se encontró ${path} en el repositorio.`)
    await this.engine.loadPage({
      path,
      html,
      reader: this.project,
      siteRoot: this.project.site.siteRoot,
    })
    this.currentPath = path
  }

  /** Pasa los cambios de la página abierta a la copia de trabajo del proyecto (sin crear commit). */
  async commitCurrentPage(): Promise<void> {
    const { engine, project } = this
    const path = this.currentPath
    if (!path || !engine.loaded) return
    engine.endTextEdit()
    if (!engine.dirty) return
    const working = engine.serialize()
    const original = await project.readCommittedText(path)
    let final = working
    if (original !== null) {
      final = preserveFormat(original, normalizeHtml(original), working)
    }
    if (original !== null && final === original) project.discard(path)
    else project.writeText(path, final)
    engine.markSaved(working)
  }

  /** Crea el commit en GitHub con todo lo pendiente. */
  async save(message: string, opts: { overwrite?: boolean } = {}) {
    await this.commitCurrentPage()
    const result = await this.project.save(message, opts)
    this.engine.markSaved()
    return result
  }

  /** Vuelve a cargar la página abierta desde el repo/copia de trabajo (p. ej. después de editar el código). */
  async reloadCurrent(extra?: { dirty?: boolean; html?: string }) {
    const path = this.currentPath
    if (!path) return
    const html = extra?.html ?? (await this.project.readText(path))
    if (html === null) return
    await this.engine.loadPage({
      path,
      html,
      reader: this.project,
      siteRoot: this.project.site.siteRoot,
      dirty: extra?.dirty,
    })
  }

  get hasUnsaved(): boolean {
    return this.project.hasPendingEdits || this.engine.dirty
  }
}
