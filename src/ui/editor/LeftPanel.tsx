import { FileText, FolderOpen, Image as ImageIcon, Keyboard, Layers, Plus, Settings } from 'lucide-react'
import { useUI, type LeftTab } from '../../store/ui'
import { AddPanel } from './panels/AddPanel'
import { FilesPanel } from './panels/FilesPanel'
import { LayersPanel } from './panels/LayersPanel'
import { MediaPanel } from './panels/MediaPanel'
import { PagesPanel } from './panels/PagesPanel'
import { SitePanel } from './panels/SitePanel'

const TABS: Array<{ id: LeftTab; label: string; icon: typeof Plus }> = [
  { id: 'add', label: 'Añadir', icon: Plus },
  { id: 'layers', label: 'Capas', icon: Layers },
  { id: 'pages', label: 'Páginas', icon: FileText },
  { id: 'media', label: 'Medios', icon: ImageIcon },
  { id: 'site', label: 'Sitio', icon: Settings },
  { id: 'files', label: 'Archivos', icon: FolderOpen },
]

export function LeftPanel() {
  const { leftTab, setLeftTab } = useUI()
  return (
    <>
      <nav className="rail" aria-label="Herramientas">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'rail-btn' + (leftTab === t.id ? ' active' : '')}
            onClick={() => setLeftTab(leftTab === t.id ? null : t.id)}
            aria-pressed={leftTab === t.id}
          >
            <t.icon size={19} />
            <span>{t.label}</span>
          </button>
        ))}
        <button className="rail-btn help" onClick={() => useUI.getState().openDialog('shortcuts')} title="Atajos de teclado (?)">
          <Keyboard size={19} />
          <span>Atajos</span>
        </button>
      </nav>
      {leftTab && (
        <aside className="left-panel" aria-label={TABS.find((t) => t.id === leftTab)?.label}>
          {leftTab === 'add' && <AddPanel />}
          {leftTab === 'layers' && <LayersPanel />}
          {leftTab === 'pages' && <PagesPanel />}
          {leftTab === 'media' && <MediaPanel />}
          {leftTab === 'site' && <SitePanel />}
          {leftTab === 'files' && <FilesPanel />}
        </aside>
      )}
    </>
  )
}
