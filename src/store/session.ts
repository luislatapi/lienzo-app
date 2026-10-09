import { create } from 'zustand'
import { DemoProvider } from '../lib/git/demo'
import { errorMessage } from '../lib/git/errors'
import { GitHubProvider } from '../lib/git/github'
import type { GitProvider, UserInfo } from '../lib/git/types'

const TOKEN_KEY = 'lienzo.token'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* almacenamiento bloqueado: la sesión dura mientras la pestaña esté abierta */
  }
}

/** Dirección de la API de GitHub. Se puede cambiar con ?api=… (solo para pruebas). */
export function apiBase(): string {
  try {
    const q = new URLSearchParams(location.search).get('api')
    if (q) {
      safeSet('lienzo.apiBase', q)
      return q
    }
  } catch {
    /* sin location */
  }
  return safeGet('lienzo.apiBase') || 'https://api.github.com'
}

interface SessionState {
  provider: GitProvider | null
  user: UserInfo | null
  mode: 'github' | 'demo' | null
  status: 'starting' | 'anonymous' | 'connecting' | 'ready'
  error: string | null
  restore(): Promise<void>
  connectToken(token: string, remember?: boolean): Promise<boolean>
  connectDemo(): Promise<void>
  logout(): void
}

export const useSession = create<SessionState>((set, get) => ({
  provider: null,
  user: null,
  mode: null,
  status: 'starting',
  error: null,

  async restore() {
    if (get().status !== 'starting') return
    const token = safeGet(TOKEN_KEY)
    if (token) {
      const ok = await get().connectToken(token, true)
      if (ok) return
    }
    set({ status: 'anonymous' })
  },

  async connectToken(token, remember = true) {
    const clean = token.trim()
    if (!clean) {
      set({ error: 'Pega tu token de GitHub para continuar.' })
      return false
    }
    set({ status: 'connecting', error: null })
    try {
      const provider = new GitHubProvider(clean, apiBase())
      const user = await provider.getUser()
      if (remember) safeSet(TOKEN_KEY, clean)
      set({ provider, user, mode: 'github', status: 'ready', error: null })
      return true
    } catch (e) {
      safeSet(TOKEN_KEY, null)
      set({ status: 'anonymous', error: errorMessage(e) })
      return false
    }
  },

  async connectDemo() {
    set({ status: 'connecting', error: null })
    const provider = await DemoProvider.create()
    const user = await provider.getUser()
    set({ provider, user, mode: 'demo', status: 'ready', error: null })
  },

  logout() {
    safeSet(TOKEN_KEY, null)
    set({ provider: null, user: null, mode: null, status: 'anonymous', error: null })
  },
}))
