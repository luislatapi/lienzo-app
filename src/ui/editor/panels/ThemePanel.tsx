import { useEffect, useMemo, useRef, useState } from 'react'
import { FONTS, FONT_KIND_LABEL, findFont, stackFor, type FontDef, type FontKind } from '../../../lib/site/fonts'
import {
  findFontStacks,
  findHexColors,
  normalizeHex,
  parseRootVars,
  primaryFamily,
  replaceFontStack,
  replaceHexColor,
  setRootVar,
  toHex,
  varKind,
  withAlphaOf,
  type VarKind,
} from '../../../lib/site/theme'
import { Section } from '../../kit'
import { ensureGoogleFont } from '../actions'
import { useEditor, useEngineState, useProjectState, type EditorCtx } from '../context'

interface Source {
  key: string
  css: string
  el?: Element
  link?: HTMLLinkElement
  path?: string
}

const XHTML = 'http://www.w3.org/1999/xhtml'
const isUserStyle = (n: Element) =>
  n.namespaceURI === XHTML && !n.hasAttribute('data-lz-editor') && n.id !== 'lienzo-responsive' && n.id !== 'lienzo-blocks'

/** Hojas de estilo de la página abierta: las escritas dentro de la página y las que vienen de archivos .css. */
async function readSources({ engine, project }: EditorCtx): Promise<Source[]> {
  const doc = engine.doc
  const hub = engine.hub
  if (!doc || !hub) return []
  const out: Source[] = []
  const seen = new Set<string>()
  let n = 0
  for (const node of Array.from(doc.querySelectorAll('style, link[rel~="stylesheet"]'))) {
    if (node.localName === 'style') {
      if (isUserStyle(node)) out.push({ key: `inline:${n++}`, css: node.textContent || '', el: node })
      continue
    }
    const path = hub.cssLinks.get(node.getAttribute('href') || '')
    if (!path || seen.has(path)) continue
    seen.add(path)
    const css = await project.tryReadText(path)
    if (css !== null) out.push({ key: `file:${path}`, css, link: node as HTMLLinkElement, path })
  }
  return out
}

function niceName(cssVar: string): string {
  const s = cssVar.replace(/^--/, '').replace(/[-_]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ThemePanel() {
  const ctx = useEditor()
  const { engine, project } = ctx
  useEngineState()
  useProjectState()
  const [sources, setSources] = useState<Source[]>([])
  const ref = useRef<Source[]>([])
  ref.current = sources

  const inlineSig =
    engine.loaded && engine.doc
      ? Array.from(engine.doc.querySelectorAll('style')).filter(isUserStyle).map((s) => s.textContent).join('\u0000')
      : ''
  const pv = project.getVersion()
  useEffect(() => {
    let alive = true
    void readSources(ctx).then((s) => alive && setSources(s))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.pagePath, engine.loaded, inlineSig, pv])

  const theme = useMemo(() => {
    const vars = new Map<string, { name: string; value: string; kind: VarKind }>()
    const colors = new Map<string, number>()
    const fonts = new Map<string, number>()
    for (const s of sources) {
      for (const v of parseRootVars(s.css)) vars.set(v.name, { ...v, kind: varKind(v.name, v.value) })
      for (const [k, n] of findHexColors(s.css)) colors.set(k, (colors.get(k) ?? 0) + n)
      for (const [k, n] of findFontStacks(s.css)) fonts.set(k, (fonts.get(k) ?? 0) + n)
    }
    const byUse = (a: [string, number], b: [string, number]) => b[1] - a[1]
    return { vars: [...vars.values()], colors: [...colors].sort(byUse).slice(0, 14), fonts: [...fonts].sort(byUse).slice(0, 6) }
  }, [sources])

  /** Guarda el CSS nuevo de una hoja de estilos y lo muestra de inmediato en el lienzo. */
  const applyCss = (src: Source, next: string, label: string) => {
    const ops = engine.ops
    if (src.el) {
      ops.setStyleText(src.el, next, label)
    } else if (src.path && src.link) {
      const { path, link } = src
      const prev = src.css
      const paint = (css: string) => void engine.hub?.replaceStylesheet(link, path, css)
      ops.custom(
        label,
        () => {
          project.writeText(path, next)
          paint(next)
        },
        () => {
          project.writeText(path, prev)
          paint(prev)
          void project.readCommittedText(path).then((c) => c === prev && project.discard(path))
        },
        `csstheme:${path}`,
      )
    }
    setSources((all) => all.map((s) => (s.key === src.key ? { ...s, css: next } : s)))
  }

  const edit = (transform: (css: string) => string, label: string) => {
    for (const s of ref.current) {
      const next = transform(s.css)
      if (next !== s.css) applyCss(s, next, label)
    }
  }

  const setVar = (name: string, value: string, label: string) => edit((css) => setRootVar(css, name, value), label)

  const useFont = (font: FontDef, change: (stack: string) => void) => {
    ensureGoogleFont(ctx, font)
    change(stackFor(font))
  }

  const colorVars = theme.vars.filter((v) => v.kind === 'color')
  const fontVars = theme.vars.filter((v) => v.kind === 'font')
  const lengthVars = theme.vars.filter((v) => v.kind === 'length')
  const nothing = !colorVars.length && !fontVars.length && !lengthVars.length && !theme.colors.length && !theme.fonts.length

  return (
    <>
      {colorVars.length > 0 && (
        <Section title="Colores del sitio">
          <p className="hint">Cambian en todas las páginas que usan esta hoja de estilos.</p>
          {colorVars.map((v) => (
            <ColorRow
              key={v.name}
              label={niceName(v.name)}
              hint={v.name}
              value={v.value}
              onCommit={(c) => setVar(v.name, c, 'Cambiar color del sitio')}
            />
          ))}
        </Section>
      )}

      {fontVars.length > 0 && (
        <Section title="Tipografías del sitio">
          {fontVars.map((v) => (
            <FontRow
              key={v.name}
              label={niceName(v.name)}
              stack={v.value}
              onPick={(f) => useFont(f, (stack) => setVar(v.name, stack, 'Cambiar tipografía del sitio'))}
            />
          ))}
        </Section>
      )}

      {lengthVars.length > 0 && (
        <Section title="Medidas" defaultOpen={false}>
          {lengthVars.map((v) => (
            <TextVar key={v.name} label={niceName(v.name)} hint={v.name} value={v.value} onCommit={(x) => setVar(v.name, x, 'Cambiar medida del sitio')} />
          ))}
        </Section>
      )}

      {theme.colors.length > 0 && (
        <Section title="Colores usados en el CSS" defaultOpen={colorVars.length === 0}>
          <p className="hint">Si cambias uno, se reemplaza en todas las reglas donde aparece.</p>
          {theme.colors.map(([hex, n]) => (
            <ColorRow
              key={hex}
              label={hex.toUpperCase()}
              hint={`${n} ${n === 1 ? 'uso' : 'usos'}`}
              value={hex}
              hideText
              onCommit={(c) => edit((css) => replaceHexColor(css, hex, c), 'Cambiar color en el CSS')}
            />
          ))}
        </Section>
      )}

      {theme.fonts.length > 0 && fontVars.length === 0 && (
        <Section title="Tipografías usadas" defaultOpen={false}>
          {theme.fonts.map(([stack, n]) => (
            <FontRow
              key={stack}
              label={`${n} ${n === 1 ? 'regla' : 'reglas'}`}
              stack={stack}
              onPick={(f) => useFont(f, (next) => edit((css) => replaceFontStack(css, stack, next), 'Cambiar tipografía'))}
            />
          ))}
        </Section>
      )}

      {nothing && engine.loaded && (
        <Section title="Diseño del sitio">
          <p className="hint">
            No encontramos colores ni tipografías en las hojas de estilo de esta página. Selecciona cualquier elemento para cambiar sus colores y
            su tipografía desde el panel de la derecha.
          </p>
        </Section>
      )}
    </>
  )
}

function ColorRow({
  label,
  hint,
  value,
  hideText,
  onCommit,
}: {
  label: string
  hint?: string
  value: string
  hideText?: boolean
  onCommit: (value: string) => void
}) {
  const hex = toHex(value) ?? '#000000'
  const [text, setText] = useState(value)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => setText(value), [value])

  // el cambio se aplica al cerrar el selector de color (evento "change" nativo), no mientras se arrastra
  useEffect(() => {
    const el = input.current
    if (!el) return
    const h = () => {
      const picked = el.value
      if (picked.toLowerCase() === hex.toLowerCase()) return
      onCommit(normalizeHex(value) ? withAlphaOf(value, picked) : picked)
    }
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  })

  const commitText = () => {
    const v = text.trim()
    if (!v || v === value) return setText(value)
    onCommit(v)
  }
  return (
    <div className="theme-row">
      <label className="swatch" style={{ background: value }} title="Elegir color">
        <input key={hex} ref={input} type="color" defaultValue={hex} aria-label={`Color ${label}`} />
      </label>
      <span className="theme-name">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {!hideText && (
        <input
          className="input mono hex"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), undefined)}
          aria-label={`Valor de ${label}`}
          spellCheck={false}
        />
      )}
    </div>
  )
}

function TextVar({ label, hint, value, onCommit }: { label: string; hint?: string; value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <div className="theme-row">
      <span className="theme-name">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        className="input mono hex"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (text.trim() && text.trim() !== value ? onCommit(text.trim()) : setText(value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), undefined)}
        aria-label={label}
        spellCheck={false}
      />
    </div>
  )
}

const KINDS: FontKind[] = ['sans', 'serif', 'display', 'script', 'mono']

function FontRow({ label, stack, onPick }: { label: string; stack: string; onPick: (f: FontDef) => void }) {
  const current = primaryFamily(stack)
  const known = findFont(current)
  return (
    <div className="theme-row column">
      <span className="theme-name">
        {label}
        <small style={{ fontFamily: stack }}>{current || stack}</small>
      </span>
      <select
        className="select"
        value={known ? known.name : '__current'}
        onChange={(e) => {
          const f = findFont(e.target.value)
          if (f) onPick(f)
        }}
        aria-label={`Tipografía ${label}`}
      >
        {!known && <option value="__current">{current || 'Actual'} (actual)</option>}
        {KINDS.map((k) => (
          <optgroup key={k} label={FONT_KIND_LABEL[k]}>
            {FONTS.filter((f) => f.kind === k).map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
