import { useEffect, useRef, useState } from 'react'
import { Copy, Plus, X } from 'lucide-react'
import { friendlyName } from '../../../lib/editor/dom-utils'
import { useUI } from '../../../store/ui'
import { Section } from '../../kit'
import { Field, LengthInput, NumberInput, SelectInput, useSel } from './controls'

function IdField() {
  const { engine, el, ops } = useSel()
  const ui = useUI()
  const [text, setText] = useState(el.id)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(el.id)
  }, [el.id, el])
  const clean = text.trim()
  const other = clean ? engine.doc?.getElementById(clean) : null
  const dup = !!other && other !== el
  const invalid = clean !== '' && !/^[A-Za-z][\w-]*$/.test(clean)
  return (
    <div className="field-block">
      <label className="field-label">Nombre del ancla (id)</label>
      <div className="input-row">
        <input
          className={'input mono' + (dup || invalid ? ' bad' : '')}
          value={text}
          placeholder="ej. contacto"
          aria-label="Nombre del ancla (id)"
          spellCheck={false}
          onFocus={() => (focus.current = true)}
          onBlur={() => {
            focus.current = false
            setText(el.id)
          }}
          onChange={(e) => {
            const v = e.target.value.replace(/\s+/g, '-')
            setText(v)
            const ok = v === '' || (/^[A-Za-z][\w-]*$/.test(v) && !(engine.doc?.getElementById(v) && engine.doc.getElementById(v) !== el))
            if (ok) ops.setAttr(el, 'id', v === '' ? null : v)
          }}
        />
        {el.id && (
          <button
            className="icon-btn"
            title="Copiar enlace a esta sección"
            aria-label="Copiar enlace a esta sección"
            onClick={() => {
              void navigator.clipboard?.writeText('#' + el.id).then(
                () => ui.toast('ok', `Copiado: #${el.id}`),
                () => ui.toast('info', `El enlace es #${el.id}`),
              )
            }}
          >
            <Copy size={14} />
          </button>
        )}
      </div>
      {dup && <p className="hint bad">Ya existe otro elemento con ese nombre en la página.</p>}
      {invalid && <p className="hint bad">Usa letras, números y guiones, y empieza con una letra.</p>}
      {!dup && !invalid && <p className="hint">Sirve para crear enlaces a esta parte de la página (#{el.id || 'nombre'}).</p>}
    </div>
  )
}

function ClassList() {
  const { el, ops } = useSel()
  const [draft, setDraft] = useState('')
  const classes = Array.from(el.classList).filter((c) => !/^lz-[a-z0-9]{5}$/.test(c))
  const add = () => {
    const names = draft.split(/\s+/).filter((c) => /^-?[_a-zA-Z][\w-]*$/.test(c) && !classes.includes(c))
    if (names.length) ops.setClasses(el, [...classes, ...names])
    setDraft('')
  }
  return (
    <div className="field-block">
      <label className="field-label">Clases CSS</label>
      <div className="chips">
        {classes.map((c) => (
          <span key={c} className="tag">
            {c}
            <button aria-label={`Quitar la clase ${c}`} onClick={() => ops.setClasses(el, classes.filter((x) => x !== c))}>
              <X size={11} />
            </button>
          </span>
        ))}
        {classes.length === 0 && <span className="muted">Sin clases</span>}
      </div>
      <div className="input-row">
        <input
          className="input mono"
          value={draft}
          placeholder="agregar clase"
          aria-label="Agregar clase"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="icon-btn" onClick={add} aria-label="Agregar clase" disabled={!draft.trim()}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

const HIDDEN_ATTRS = new Set(['class', 'style', 'id', 'contenteditable', 'srcset', 'sizes'])

function AttributeList() {
  const { engine, el, ops } = useSel()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const attrs = Array.from(el.attributes).filter((a) => !HIDDEN_ATTRS.has(a.name) && !a.name.startsWith('data-lz-'))
  const add = () => {
    const n = name.trim().toLowerCase()
    if (!/^[a-z_][\w:.-]*$/.test(n) || n.startsWith('on')) return
    ops.setAttr(el, n, value)
    setName('')
    setValue('')
  }
  return (
    <div className="field-block">
      <label className="field-label">Atributos</label>
      <div className="attr-list">
        {attrs.map((a) => (
          <div className="attr-row" key={a.name}>
            <span className="mono attr-name" title={a.name}>
              {a.name}
            </span>
            <input
              className="input mono"
              defaultValue={engine.hub ? engine.hub.restoreValue(a.value) : a.value}
              key={el.localName + a.name + a.value}
              aria-label={`Valor de ${a.name}`}
              spellCheck={false}
              onBlur={(e) => {
                const v = e.target.value
                if (v !== (engine.hub ? engine.hub.restoreValue(a.value) : a.value)) ops.setAttr(el, a.name, v)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            />
            <button className="icon-btn tiny" aria-label={`Quitar ${a.name}`} onClick={() => ops.setAttr(el, a.name, null)}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="attr-row add">
        <input className="input mono" placeholder="nombre" aria-label="Nombre del atributo" value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} />
        <input
          className="input mono"
          placeholder="valor"
          aria-label="Valor del atributo"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          spellCheck={false}
        />
        <button className="icon-btn tiny" onClick={add} aria-label="Agregar atributo" disabled={!name.trim()}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

function parseDeclarations(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of css.matchAll(/([a-zA-Z-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)) out[m[1].toLowerCase()] = m[2].trim()
  return out
}

/** Editor del CSS propio del elemento para la pantalla actual. */
function CssBox() {
  const { engine, el, ops } = useSel()
  const device = engine.device
  const own: Record<string, string> =
    device === 'desktop' ? parseDeclarations(el.getAttribute('style') || '') : engine.responsive?.get(el, device) ?? {}
  const editable = Object.entries(own).filter(([, v]) => !/url\(/i.test(v))
  const value = editable.map(([k, v]) => `${k}: ${v.replace(/\s*!important\s*$/i, '')};`).join('\n')
  const [text, setText] = useState(value)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(value)
  }, [value, el])
  const apply = () => {
    const next = parseDeclarations(text)
    const props: Record<string, string> = {}
    for (const [k] of editable) if (!(k in next)) props[k] = ''
    for (const [k, v] of Object.entries(next)) if (own[k] !== v && !/url\(/i.test(v)) props[k] = v
    if (Object.keys(props).length) ops.setStyle(el, props)
  }
  return (
    <div className="field-block">
      <label className="field-label">
        CSS de este elemento {device !== 'desktop' && <small>({device === 'tablet' ? 'tablet' : 'móvil'})</small>}
      </label>
      <textarea
        className="textarea mono code"
        rows={5}
        value={text}
        placeholder={'color: #222;\nmargin-top: 12px;'}
        aria-label="CSS de este elemento"
        spellCheck={false}
        onFocus={() => (focus.current = true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          focus.current = false
          apply()
          setText(value)
        }}
      />
      <p className="hint">Una propiedad por línea. Se aplica al salir del cuadro.</p>
    </div>
  )
}

export function AdvancedTab() {
  const { engine, el, computed, own } = useSel()
  const isBody = el === engine.body
  const position = own('position') || computed('position')
  return (
    <div className="tab-scroll">
      {!isBody && (
        <Section title="Identificación">
          <div className="fld-note">
            {friendlyName(el)} · <span className="mono">&lt;{el.localName}&gt;</span>
          </div>
          <IdField />
          <ClassList />
        </Section>
      )}

      {!isBody && (
        <Section title="Posición" defaultOpen={false}>
          <Field label="Tipo" props={['position']}>
            <SelectInput
              prop="position"
              label="Posición"
              options={[
                { value: 'static', label: 'Normal' },
                { value: 'relative', label: 'Relativa' },
                { value: 'absolute', label: 'Absoluta' },
                { value: 'fixed', label: 'Fija en pantalla' },
                { value: 'sticky', label: 'Pegajosa (sticky)' },
              ]}
            />
          </Field>
          {position !== 'static' && (
            <div className="fld-grid">
              {(['top', 'right', 'bottom', 'left'] as const).map((s) => (
                <Field key={s} label={{ top: 'Arriba', right: 'Derecha', bottom: 'Abajo', left: 'Izquierda' }[s]} props={[s]}>
                  <LengthInput prop={s} label={s} keywords={['auto']} units={['px', '%', 'rem']} />
                </Field>
              ))}
            </div>
          )}
          <div className="fld-pair">
            <Field label="Capa (z-index)" props={['z-index']}>
              <NumberInput prop="z-index" label="Capa" step={1} fromComputed={(_cs, raw) => (raw === 'auto' ? '' : raw)} />
            </Field>
            <Field label="Desborde" props={['overflow']}>
              <SelectInput
                prop="overflow"
                label="Desborde"
                options={[
                  { value: 'visible', label: 'Visible' },
                  { value: 'hidden', label: 'Recortar' },
                  { value: 'auto', label: 'Con scroll' },
                ]}
              />
            </Field>
          </div>
        </Section>
      )}

      {!isBody && (
        <Section title="Atributos" defaultOpen={false}>
          <AttributeList />
        </Section>
      )}

      <Section title="CSS propio" defaultOpen={false}>
        <CssBox />
      </Section>
    </div>
  )
}
