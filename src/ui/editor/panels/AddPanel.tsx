import { useMemo, useState } from 'react'
import {
  CircleHelp,
  CodeXml,
  Columns2,
  Columns3,
  CreditCard,
  Heading2,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  List,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Minus,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  Pilcrow,
  Quote,
  Search,
  Video,
} from 'lucide-react'
import { BLOCKS, BLOCK_CATEGORIES, type BlockDef } from '../../../lib/editor/blocks'
import { useEditor } from '../context'
import { insertBlock } from '../actions'
import { startDrag } from '../dnd'

const ICONS: Record<string, typeof Heading2> = {
  Heading2, Pilcrow, MousePointerClick, MessageCircle, Image: ImageIcon, Video, MapPin, Minus, MoveVertical, List, Quote, CodeXml,
  LayoutTemplate, Columns3, Columns2, MessageSquare, CreditCard, CircleHelp, Megaphone, LayoutGrid, Mail, PanelBottom,
}

export function AddPanel() {
  const ctx = useEditor()
  const { engine } = ctx
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    return BLOCK_CATEGORIES.map((c) => ({
      ...c,
      blocks: BLOCKS.filter((b) => b.category === c.id && (!term || (b.name + ' ' + b.hint).toLowerCase().includes(term))),
    })).filter((g) => g.blocks.length)
  }, [q])

  const onDown = (e: React.PointerEvent, block: BlockDef) => {
    if (!engine.loaded) return
    startDrag(e, {
      engine,
      label: block.name,
      onClick: () => insertBlock(ctx, block),
      onDrop: (drop) => insertBlock(ctx, block, { ref: drop.ref, position: drop.position === 'append' ? 'append' : drop.position }),
    })
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <h3>Añadir</h3>
        <p>Haz clic o arrastra un bloque hasta la página.</p>
      </header>
      <label className="panel-search">
        <Search size={14} />
        <input placeholder="Buscar bloque…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar bloque" />
      </label>
      <div className="panel-scroll">
        {groups.map((g) => (
          <section key={g.id} className="block-group">
            <h4>{g.label}</h4>
            <div className="block-grid">
              {g.blocks.map((b) => {
                const Icon = ICONS[b.icon] ?? Heading2
                return (
                  <button
                    key={b.id}
                    className="block-item"
                    onPointerDown={(e) => onDown(e, b)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), insertBlock(ctx, b))}
                    title={b.hint}
                    data-testid={`block-${b.id}`}
                  >
                    <Icon size={20} />
                    <span>{b.name}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="panel-empty">No hay bloques con ese nombre.</p>}
      </div>
    </div>
  )
}
