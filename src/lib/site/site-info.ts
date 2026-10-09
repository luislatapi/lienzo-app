import type { TreeEntry } from '../git/types'
import { basename, isHtmlPath, isImagePath } from './paths'

export interface SiteInfo {
  /** carpeta que Vercel publica como raíz del sitio ("" = raíz del repo) */
  siteRoot: string
  pages: string[]
  images: string[]
  cleanUrls: boolean
  /** nombre del framework si el repo parece una app (Next.js, Vite, etc.) */
  framework: string | null
}

const IGNORED = ['node_modules/', '.git/', '.next/', '.vercel/', 'dist/', 'build/', 'vendor/', '.github/', '.nuxt/', '.svelte-kit/', 'coverage/']

export function isIgnoredPath(path: string): boolean {
  return IGNORED.some((d) => path.startsWith(d) || path.includes('/' + d))
}

const ROOT_CANDIDATES = ['public', 'docs', 'www', 'site', 'static', 'web', 'src', 'app']

export function detectFramework(pkg: unknown): string | null {
  if (!pkg || typeof pkg !== 'object') return null
  const p = pkg as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  const deps = { ...(p.dependencies || {}), ...(p.devDependencies || {}) }
  const table: Array<[string, string]> = [
    ['next', 'Next.js'],
    ['nuxt', 'Nuxt'],
    ['astro', 'Astro'],
    ['@sveltejs/kit', 'SvelteKit'],
    ['gatsby', 'Gatsby'],
    ['@remix-run/react', 'Remix'],
    ['vue', 'Vue'],
    ['react', 'React'],
    ['svelte', 'Svelte'],
    ['vite', 'Vite'],
  ]
  for (const [dep, label] of table) if (deps[dep]) return label
  return null
}

export function analyzeTree(entries: TreeEntry[], vercelJson?: unknown, pkgJson?: unknown): SiteInfo {
  const files = entries.filter((e) => e.type === 'blob').map((e) => e.path)
  const live = files.filter((p) => !isIgnoredPath(p))
  const pages = live.filter(isHtmlPath)
  const images = live.filter(isImagePath)

  const vj = (vercelJson && typeof vercelJson === 'object' ? vercelJson : {}) as {
    cleanUrls?: boolean
    outputDirectory?: string
  }

  let siteRoot = ''
  const hasRootIndex = files.includes('index.html')
  if (typeof vj.outputDirectory === 'string' && vj.outputDirectory.trim()) {
    siteRoot = vj.outputDirectory.replace(/^\.?\/+|\/+$/g, '')
  } else if (!hasRootIndex) {
    for (const dir of ROOT_CANDIDATES) {
      if (files.includes(`${dir}/index.html`)) {
        siteRoot = dir
        break
      }
    }
  }

  const sorted = [...pages].sort((a, b) => {
    const rank = (p: string) => (p === 'index.html' ? 0 : basename(p) === 'index.html' ? 1 : 2)
    return rank(a) - rank(b) || a.localeCompare(b)
  })

  return {
    siteRoot,
    pages: sorted,
    images,
    cleanUrls: !!vj.cleanUrls,
    framework: detectFramework(pkgJson),
  }
}
