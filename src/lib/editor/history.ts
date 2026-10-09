export interface Command {
  label: string
  undo(): void
  redo(): void
  /** Comandos consecutivos con la misma clave y muy cercanos en el tiempo se funden en uno. */
  key?: string
  at?: number
}

export class History {
  private stack: Command[] = []
  private index = 0
  private savedIndex = 0
  private forcedDirty = false
  private readonly max = 300

  push(cmd: Command) {
    const now = Date.now()
    const top = this.stack[this.index - 1]
    if (cmd.key && top && top.key === cmd.key && top.at !== undefined && now - top.at < 900 && this.index === this.stack.length) {
      top.redo = cmd.redo
      top.at = now
      return
    }
    this.stack.length = this.index
    this.stack.push({ ...cmd, at: now })
    if (this.stack.length > this.max) {
      this.stack.shift()
      this.savedIndex--
    } else {
      this.index++
    }
    this.index = this.stack.length
  }

  undo(): Command | null {
    if (this.index === 0) return null
    const cmd = this.stack[--this.index]
    cmd.undo()
    cmd.at = undefined
    return cmd
  }

  redo(): Command | null {
    if (this.index >= this.stack.length) return null
    const cmd = this.stack[this.index++]
    cmd.redo()
    cmd.at = undefined
    return cmd
  }

  get canUndo() {
    return this.index > 0
  }

  get canRedo() {
    return this.index < this.stack.length
  }

  get undoLabel() {
    return this.stack[this.index - 1]?.label
  }

  get redoLabel() {
    return this.stack[this.index]?.label
  }

  get dirty() {
    return this.forcedDirty || this.index !== this.savedIndex
  }

  markDirty() {
    this.forcedDirty = true
  }

  markSaved() {
    this.savedIndex = this.index
    this.forcedDirty = false
    const top = this.stack[this.index - 1]
    if (top) top.at = undefined
  }

  clear() {
    this.stack = []
    this.index = 0
    this.savedIndex = 0
    this.forcedDirty = false
  }
}
