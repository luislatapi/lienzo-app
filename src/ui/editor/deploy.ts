import { useEffect } from 'react'
import { create } from 'zustand'
import type { DeploymentInfo } from '../../lib/git/types'
import { useEditor } from './context'

interface Watch {
  sha: string
  branch: string
  startedAt: number
}

interface DeployStore {
  watch: Watch | null
  info: DeploymentInfo | null
  /** última dirección pública conocida del sitio en producción */
  liveUrl: string | null
  begin(sha: string, branch: string): void
  setInfo(i: DeploymentInfo | null): void
  setLive(u: string | null): void
  reset(): void
}

export const useDeploy = create<DeployStore>((set) => ({
  watch: null,
  info: null,
  liveUrl: null,
  begin: (sha, branch) => set({ watch: { sha, branch, startedAt: Date.now() }, info: { state: 'pending', description: 'Esperando a Vercel…' } }),
  setInfo: (info) => set({ info }),
  setLive: (liveUrl) => set({ liveUrl }),
  reset: () => set({ watch: null, info: null, liveUrl: null }),
}))

const GIVE_UP_NONE_MS = 50_000
const GIVE_UP_ALL_MS = 8 * 60_000

/** Consulta a GitHub cómo va el despliegue de Vercel después de publicar, y la URL del sitio en vivo. */
export function useDeployWatcher() {
  const { project } = useEditor()
  const watch = useDeploy((s) => s.watch)

  // URL de producción conocida al abrir el proyecto
  useEffect(() => {
    useDeploy.getState().reset()
    let alive = true
    project.provider
      .latestProductionUrl(project.repo.owner, project.repo.name)
      .then((u) => alive && useDeploy.getState().setLive(u || (project.repo.homepage ?? null)))
      .catch(() => undefined)
    return () => {
      alive = false
      useDeploy.getState().reset()
    }
  }, [project])

  useEffect(() => {
    if (!watch) return
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const info = await project.provider.deploymentStatus(project.repo.owner, project.repo.name, watch.sha)
        if (stop) return
        const elapsed = Date.now() - watch.startedAt
        if (info.state === 'none') {
          if (elapsed > GIVE_UP_NONE_MS) {
            useDeploy.getState().setInfo({ ...info, description: 'No detectamos un despliegue de Vercel para este cambio.' })
            return
          }
          useDeploy.getState().setInfo({ state: 'pending', description: 'Esperando a Vercel…' })
        } else {
          useDeploy.getState().setInfo(info)
          if (info.state === 'success') {
            if (info.environment?.toLowerCase() === 'production' && info.url) useDeploy.getState().setLive(info.url)
            return
          }
          if (info.state === 'failure') return
        }
        if (elapsed > GIVE_UP_ALL_MS) return
      } catch {
        /* se reintenta */
      }
      timer = setTimeout(tick, Date.now() - watch.startedAt < 30_000 ? 2500 : 5000)
    }
    timer = setTimeout(tick, 1200)
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [watch, project])
}
