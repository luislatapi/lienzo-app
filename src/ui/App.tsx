import { useEffect } from 'react'
import { useSession } from '../store/session'
import { EditorScreen } from './editor/EditorScreen'
import { LogoMark } from './icons'
import { Login } from './Login'
import { Projects } from './Projects'
import { useRoute } from './route'

export function App() {
  const route = useRoute()
  const status = useSession((s) => s.status)
  const provider = useSession((s) => s.provider)
  const restore = useSession((s) => s.restore)

  useEffect(() => {
    void restore()
  }, [restore])

  if (status === 'starting') {
    return (
      <div className="opening">
        <div className="opening-box">
          <LogoMark size={44} />
        </div>
      </div>
    )
  }
  if (!provider) return <Login />
  if (route.name === 'editor') {
    return <EditorScreen key={`${route.owner}/${route.repo}/${route.branch ?? ''}`} owner={route.owner} repo={route.repo} branch={route.branch} page={route.page} />
  }
  return <Projects />
}
