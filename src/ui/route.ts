import { useSyncExternalStore } from 'react'

export type Route = { name: 'home' } | { name: 'editor'; owner: string; repo: string; branch?: string; page?: string }

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '')
  const [path, query = ''] = raw.split('?')
  const m = path.match(/^\/p\/([^/]+)\/([^/]+)\/?$/)
  if (m) {
    const q = new URLSearchParams(query)
    return {
      name: 'editor',
      owner: decodeURIComponent(m[1]),
      repo: decodeURIComponent(m[2]),
      branch: q.get('rama') || undefined,
      page: q.get('pagina') || undefined,
    }
  }
  return { name: 'home' }
}

export function editorHref(owner: string, repo: string): string {
  return `#/p/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

export function navigate(hash: string) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else location.hash = hash
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parseRoute(hash)
}
