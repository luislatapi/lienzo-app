import { createContext, useContext, useSyncExternalStore } from 'react'
import type { EditorController } from '../../lib/editor/controller'
import type { EditorEngine } from '../../lib/editor/engine'
import type { Project } from '../../lib/project'

export interface EditorCtx {
  project: Project
  engine: EditorEngine
  controller: EditorController
}

export const EditorContext = createContext<EditorCtx | null>(null)

export function useEditor(): EditorCtx {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor fuera de EditorContext')
  return ctx
}

/** Vuelve a renderizar cuando cambia la selección, el historial o el contenido de la página. */
export function useEngineState(): EditorEngineSnapshot {
  const { engine } = useEditor()
  useSyncExternalStore(engine.subscribe, engine.getVersion)
  return engine
}

export type EditorEngineSnapshot = EditorCtx['engine']

/** Para componentes que dependen de la geometría (zoom, scroll, tamaño). */
export function useLayoutState(): number {
  const { engine } = useEditor()
  return useSyncExternalStore(engine.subscribeLayout, engine.getLayoutVersion)
}

export function useProjectState(): Project {
  const { project } = useEditor()
  useSyncExternalStore(project.subscribe, project.getVersion)
  return project
}
