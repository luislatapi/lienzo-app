import { useMemo, useState } from 'react'
import { ChevronRight, File as FileIcon, FileCode2, FileText, Folder, Image as ImageIcon, RotateCcw, Search, Trash2 } from 'lucide-react'
import { basename, extname, isImagePath, isTextPath } from '../../../lib/site/paths'
import { isIgnoredPath } from '../../../lib/site/site-info'
import { useUI } from '../../../store/ui'
import { useEditor, useEngineState, useProjectState } from '../context'

interface TreeNode {
  name: string
  path: string
  dir: boolean
  kids: Map<string, TreeNode>
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', dir: true, kids: new Map() }
  for (const p of paths) {
    let cur = root
    const segs = p.split('/')
    segs.forEach((seg, i) => {
      const path = segs.slice(0, i + 1).join('/')
      let next = cur.kids.get(seg)
      if (!next) {
        next = { name: seg, path, dir: i < segs.length - 1, kids: new Map() }
        cur.kids.set(seg, next)
      }
      cur = next
    })
  }
  return root
}

const sorted = (n: TreeNode) =>
  [...n.kids.values()].sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))

function iconFor(path: string) {
  if (isImagePath(path)) return ImageIcon
  const e = extname(path)
  if (['.html', '.htm', '.css', '.js', '.mjs', '.json', '.ts', '.tsx', '.jsx'].includes(e)) return FileCode2
  if (isTextPath(path)) return FileText
  return FileIcon
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Todos los archivos del repositorio. Los de texto se pueden abrir y editar como código. */
export function FilesPanel() {
  const { project, engine } = useEditor()
  useEngineState()
  useProjectState()
  const ui = useUI()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set([project.site.siteRoot].filter(Boolean)))

  const version = project.getVersion()
  const files = useMemo(() => {
    const set = new Set<string>()
    for (const p of project.tree.keys()) if (!isIgnoredPath(p)) set.add(p)
    for (const [p, w] of project.working) if (!w.deleted) set.add(p)
    return [...set]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, version])

  const q = query.trim().toLowerCase()
  const tree = useMemo(() => buildTree(q ? files.filter((p) => p.toLowerCase().includes(q)) : files), [files, q])

  const toggle = (path: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(path)) n.delete(path)
      else n.add(path)
      return n
    })

  const rows: Array<{ node: TreeNode; depth: number }> = []
  const walk = (n: TreeNode, depth: number) => {
    for (const k of sorted(n)) {
      rows.push({ node: k, depth })
      if (k.dir && (q || open.has(k.path))) walk(k, depth + 1)
    }
  }
  walk(tree, 0)

  const deleted = [...project.working].filter(([, w]) => w.deleted).map(([p]) => p)

  return (
    <div className="panel">
      <header className="panel-head">
        <h3>Archivos</h3>
        <p>Todo lo que hay en tu repositorio. Los archivos de texto se abren como código.</p>
      </header>
      <div className="panel-actions">
        <label className="search">
          <Search size={14} />
          <input placeholder="Buscar archivo…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar archivo" />
        </label>
      </div>
      <div className="panel-scroll files">
        {project.truncated && <p className="hint pad">El repositorio es muy grande: GitHub entregó solo una parte de los archivos.</p>}
        {rows.length === 0 && <p className="panel-empty">{q ? 'Ningún archivo coincide.' : 'Este repositorio está vacío.'}</p>}
        {rows.map(({ node, depth }) => {
          const Icon = node.dir ? Folder : iconFor(node.path)
          const isOpen = q || open.has(node.path)
          const text = !node.dir && isTextPath(node.path)
          const size = !node.dir ? (project.working.get(node.path) as { content?: string | Uint8Array } | undefined)?.content?.length ?? project.tree.get(node.path)?.size : undefined
          return (
            <div
              key={node.path}
              className={'tree-row' + (node.path === engine.pagePath ? ' active' : '')}
              style={{ paddingLeft: 6 + depth * 14 }}
            >
              <button
                className="tree-main"
                onClick={() => {
                  if (node.dir) toggle(node.path)
                  else if (text) ui.openDialog('code', { path: node.path })
                }}
                title={node.path}
                disabled={!node.dir && !text}
              >
                {node.dir ? <ChevronRight size={13} style={{ transform: isOpen ? 'rotate(90deg)' : undefined }} /> : <span className="tree-gap" />}
                <Icon size={14} />
                <span className="tree-name">{node.name}</span>
                {size !== undefined && <small>{formatSize(size)}</small>}
                {!node.dir && project.isModified(node.path) && <i className="dot-mod" title={project.isNew(node.path) ? 'Archivo nuevo' : 'Con cambios sin publicar'} />}
              </button>
              {!node.dir && (
                <button
                  className="icon-btn tree-del"
                  title={project.isNew(node.path) ? 'Quitar (aún no está publicado)' : 'Eliminar al publicar'}
                  aria-label={`Eliminar ${basename(node.path)}`}
                  onClick={() => (project.isNew(node.path) ? project.discard(node.path) : project.remove(node.path))}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )
        })}
        {deleted.length > 0 && (
          <div className="tree-deleted">
            <h4>Se eliminarán al publicar</h4>
            {deleted.map((p) => (
              <div key={p} className="tree-row">
                <span className="tree-main static">
                  <span className="tree-gap" />
                  <span className="tree-name gone">{p}</span>
                </span>
                <button className="btn small" onClick={() => project.discard(p)}>
                  <RotateCcw size={12} /> Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
