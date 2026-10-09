import { useEffect, useState } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { EditorController } from '../../lib/editor/controller'
import { EditorEngine } from '../../lib/editor/engine'
import { errorMessage } from '../../lib/git/errors'
import { Project } from '../../lib/project'
import { useSession } from '../../store/session'
import { useUI } from '../../store/ui'
import { navigate } from '../route'
import { Canvas } from './Canvas'
import { ContextMenu } from './ContextMenu'
import { EditorContext, type EditorCtx } from './context'
import { Dialogs } from './Dialogs'
import { Inspector } from './Inspector'
import { LeftPanel } from './LeftPanel'
import { Toasts } from './Toasts'
import { TopBar } from './TopBar'
import { useDeployWatcher } from './deploy'
import { useEditorEffects } from './effects'

interface Props {
  owner: string
  repo: string
  branch?: string
  page?: string
}

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; ctx: EditorCtx }

export function EditorScreen(props: Props) {
  const provider = useSession((s) => s.provider)!
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let engine: EditorEngine | null = null
    setState({ status: 'loading' })
    ;(async () => {
      try {
        const info = await provider.getRepo(props.owner, props.repo)
        const project = await Project.open(provider, info, props.branch)
        engine = new EditorEngine()
        const controller = new EditorController(project, engine)
        if (cancelled) {
          engine.dispose()
          return
        }
        setState({ status: 'ready', ctx: { project, engine, controller } })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: errorMessage(e) })
      }
    })()
    return () => {
      cancelled = true
      engine?.dispose()
    }
  }, [provider, props.owner, props.repo, props.branch])

  if (state.status === 'loading') {
    return (
      <div className="opening">
        <div className="opening-box">
          <Loader2 className="spin" size={26} />
          <p>
            Abriendo <b className="mono">{props.owner}/{props.repo}</b>…
          </p>
        </div>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="opening">
        <div className="opening-box">
          <TriangleAlert size={26} color="var(--bad)" />
          <p>{state.message}</p>
          <button className="btn" onClick={() => navigate('#/')}>
            Volver a mis sitios
          </button>
        </div>
      </div>
    )
  }
  return (
    <EditorContext.Provider value={state.ctx}>
      <Workspace page={props.page} />
    </EditorContext.Provider>
  )
}

function Workspace({ page }: { page?: string }) {
  const { leftTab } = useUI()
  useEditorEffects(page)
  useDeployWatcher()
  return (
    <div className={'editor' + (leftTab ? '' : ' no-left')}>
      <TopBar />
      <div className="editor-body">
        <LeftPanel />
        <main className="canvas-col">
          <Canvas />
        </main>
        <Inspector />
      </div>
      <ContextMenu />
      <Dialogs />
      <Toasts />
    </div>
  )
}
