import { useRef } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
  Image as ImageIcon,
  Italic,
  Underline,
  WrapText,
} from 'lucide-react'
import { isTextEditable } from '../../../lib/editor/dom-utils'
import { FONTS, FONT_KIND_LABEL, findFont, stackFor, type FontKind } from '../../../lib/site/fonts'
import { primaryFamily } from '../../../lib/site/theme'
import { useUI } from '../../../store/ui'
import { Section } from '../../kit'
import { ensureGoogleFont } from '../actions'
import { useEditor } from '../context'
import { ColorInput, Field, LengthInput, NumberInput, SegInput, SelectInput, SpacingBox, Toggle, useSel } from './controls'

const KINDS: FontKind[] = ['sans', 'serif', 'display', 'script', 'mono']

const WEIGHTS = [
  { value: '300', label: 'Fina' },
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Media' },
  { value: '600', label: 'Seminegrita' },
  { value: '700', label: 'Negrita' },
  { value: '800', label: 'Extranegrita' },
  { value: '900', label: 'Negra' },
]

const SHADOWS = [
  { value: 'none', label: 'Sin sombra' },
  { value: '0 2px 8px rgba(0,0,0,.12)', label: 'Suave' },
  { value: '0 8px 24px rgba(0,0,0,.18)', label: 'Media' },
  { value: '0 16px 40px rgba(0,0,0,.28)', label: 'Fuerte' },
]

function FontFamilyInput() {
  const ctx = useEditor()
  const { own, computed, set } = useSel()
  const ownV = own('font-family')
  const cur = ownV || computed('font-family')
  const primary = primaryFamily(cur)
  const known = findFont(primary)
  return (
    <select
      className={'select' + (ownV ? ' own' : '')}
      value={known ? known.name : '__cur'}
      aria-label="Tipografía"
      onChange={(e) => {
        const f = findFont(e.target.value)
        if (!f) return
        ensureGoogleFont(ctx, f)
        set({ 'font-family': stackFor(f) })
      }}
    >
      {!known && <option value="__cur">{primary || 'Heredada'}</option>}
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
  )
}

function WeightInput() {
  const { own, computed, set } = useSel()
  const ownV = own('font-weight')
  const raw = ownV || computed('font-weight')
  const cur = raw === 'normal' ? '400' : raw === 'bold' ? '700' : raw
  return (
    <select className={'select' + (ownV ? ' own' : '')} value={cur} aria-label="Grosor del texto" onChange={(e) => set({ 'font-weight': e.target.value })}>
      {!WEIGHTS.some((w) => w.value === cur) && <option value={cur}>{cur}</option>}
      {WEIGHTS.map((w) => (
        <option key={w.value} value={w.value}>
          {w.label}
        </option>
      ))}
    </select>
  )
}

function ToggleStyle({ prop, on, off, label, icon }: { prop: string; on: string; off: string; label: string; icon: React.ReactNode }) {
  const { own, computed, set } = useSel()
  const raw = own(prop) || computed(prop)
  const active = prop === 'text-decoration' ? raw.includes(on) : raw === on
  return (
    <button
      type="button"
      className={'tool-btn' + (active ? ' on' : '')}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={() => set({ [prop]: active ? off : on })}
    >
      {icon}
    </button>
  )
}

function ShadowInput() {
  const { own, computed, set } = useSel()
  const ownV = own('box-shadow').replace(/\s+/g, ' ')
  const cur = ownV || (computed('box-shadow') === 'none' ? 'none' : '__custom')
  const preset = SHADOWS.find((s) => s.value.replace(/\s+/g, ' ') === ownV)
  return (
    <select
      className={'select' + (ownV ? ' own' : '')}
      aria-label="Sombra"
      value={preset ? preset.value : cur === 'none' ? 'none' : '__custom'}
      onChange={(e) => e.target.value !== '__custom' && set({ 'box-shadow': e.target.value })}
    >
      {!preset && cur !== 'none' && <option value="__custom">Personalizada</option>}
      {SHADOWS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  )
}

function OpacityInput() {
  const { own, computed, set } = useSel()
  const ownV = own('opacity')
  const v = Math.round(parseFloat(ownV || computed('opacity') || '1') * 100)
  return (
    <div className={'range-row' + (ownV ? ' own' : '')}>
      <input type="range" min={0} max={100} value={Number.isNaN(v) ? 100 : v} aria-label="Opacidad" onChange={(e) => set({ opacity: String(Number(e.target.value) / 100) })} />
      <output>{Number.isNaN(v) ? 100 : v}%</output>
    </div>
  )
}

function BackgroundImage() {
  const { own, computed, set } = useSel()
  const ui = useUI()
  const cur = own('background-image') || computed('background-image')
  const has = !!cur && cur !== 'none'
  const isGradient = /gradient\(/i.test(cur)
  return (
    <div className="bg-image">
      <div className="bg-image-state">
        <ImageIcon size={14} />
        <span>{!has ? 'Sin imagen de fondo' : isGradient ? 'Degradado' : 'Imagen de fondo'}</span>
      </div>
      <div className="row-actions">
        <button className="btn small" onClick={() => ui.openDialog('image-picker', { target: 'background' })}>
          {has && !isGradient ? 'Cambiar' : 'Elegir imagen'}
        </button>
        {has && (
          <button className="btn small ghost" onClick={() => set({ 'background-image': own('background-image') ? '' : 'none' })}>
            Quitar
          </button>
        )}
      </div>
      {has && !isGradient && (
        <>
          <Field label="Ajuste" props={['background-size']}>
            <SegInput
              prop="background-size"
              label="Ajuste del fondo"
              options={[
                { value: 'cover', label: 'Cubrir', title: 'Cubre todo el espacio' },
                { value: 'contain', label: 'Caber' },
                { value: 'auto', label: 'Original' },
              ]}
            />
          </Field>
          <Field label="Posición" props={['background-position']}>
            <SelectInput
              prop="background-position"
              label="Posición del fondo"
              options={[
                { value: '50% 50%', label: 'Centro' },
                { value: '50% 0%', label: 'Arriba' },
                { value: '50% 100%', label: 'Abajo' },
                { value: '0% 50%', label: 'Izquierda' },
                { value: '100% 50%', label: 'Derecha' },
              ]}
            />
          </Field>
          <Field label="Repetir" props={['background-repeat']}>
            <SegInput
              prop="background-repeat"
              label="Repetir fondo"
              options={[
                { value: 'no-repeat', label: 'No' },
                { value: 'repeat', label: 'Sí' },
              ]}
            />
          </Field>
        </>
      )}
    </div>
  )
}

function GridColumns() {
  const { own, computed, set } = useSel()
  const ownV = own('grid-template-columns')
  const raw = ownV || computed('grid-template-columns')
  const n = raw && raw !== 'none' ? raw.split(/\s+(?![^(]*\))/).filter(Boolean).length : 1
  return (
    <NumberStepper
      value={n}
      min={1}
      max={12}
      label="Columnas"
      own={!!ownV}
      onChange={(v) => set({ 'grid-template-columns': `repeat(${v}, minmax(0, 1fr))` })}
    />
  )
}

function NumberStepper({ value, min, max, onChange, label, own }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; own?: boolean }) {
  return (
    <div className={'stepper' + (own ? ' own' : '')}>
      <button type="button" aria-label={`Menos ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-label={label}>{value}</output>
      <button type="button" aria-label={`Más ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

export function StyleTab() {
  const { engine, el, ops, computed, own } = useSel()
  const isBody = el === engine.body
  const hasAny = engine.device === 'desktop' ? el.style.length > 0 : Object.keys(engine.responsive?.get(el, engine.device) ?? {}).length > 0
  const display = own('display') || computed('display')
  const isFlex = display.includes('flex')
  const isGrid = display.includes('grid')
  const hasText = (el.textContent || '').trim().length > 0
  const textFirst = el instanceof (engine.win as Window & typeof globalThis).HTMLElement && isTextEditable(el)
  const borderStyleOwn = useRef('')
  borderStyleOwn.current = own('border-style') || computed('border-style')

  return (
    <div className="tab-scroll">
      {!isBody && (
        <Section title="Visible en">
          <div className="vis-row">
            {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
              <Toggle
                key={d}
                label={d === 'desktop' ? 'Escritorio' : d === 'tablet' ? 'Tablet' : 'Móvil'}
                checked={!ops.isHiddenOn(el, d)}
                onChange={(v) => ops.setHiddenOn(el, d, !v)}
              />
            ))}
          </div>
        </Section>
      )}

      {hasText && (
        <Section title="Texto" defaultOpen={textFirst || !isBody}>
          <Field label="Tipografía" props={['font-family']} full>
            <FontFamilyInput />
          </Field>
          <div className="fld-pair">
            <Field label="Tamaño" props={['font-size']}>
              <LengthInput prop="font-size" label="Tamaño del texto" units={['px', 'rem', 'em', '%']} min={1} />
            </Field>
            <Field label="Grosor" props={['font-weight']}>
              <WeightInput />
            </Field>
          </div>
          <Field label="Color" props={['color']}>
            <ColorInput prop="color" label="Color del texto" />
          </Field>
          <Field label="Alineación" props={['text-align']}>
            <SegInput
              prop="text-align"
              label="Alineación del texto"
              options={[
                { value: 'left', label: <AlignLeft size={14} />, title: 'Izquierda' },
                { value: 'center', label: <AlignCenter size={14} />, title: 'Centro' },
                { value: 'right', label: <AlignRight size={14} />, title: 'Derecha' },
                { value: 'justify', label: <AlignJustify size={14} />, title: 'Justificado' },
              ]}
            />
          </Field>
          <div className="fld-pair">
            <Field label="Interlineado" props={['line-height']}>
              <NumberInput
                prop="line-height"
                label="Interlineado"
                step={0.1}
                min={0.5}
                max={4}
                fromComputed={(cs, raw) => {
                  const lh = parseFloat(raw)
                  const fs = parseFloat(cs?.fontSize ?? '')
                  return Number.isNaN(lh) || Number.isNaN(fs) || !fs ? '' : String(Math.round((lh / fs) * 100) / 100)
                }}
              />
            </Field>
            <Field label="Espaciado" props={['letter-spacing']}>
              <LengthInput prop="letter-spacing" label="Espacio entre letras" units={['px', 'em']} keywords={['normal']} />
            </Field>
          </div>
          <Field label="Estilo" props={['font-style', 'text-decoration', 'text-transform']}>
            <div className="tool-row">
              <ToggleStyle prop="font-style" on="italic" off="normal" label="Cursiva" icon={<Italic size={14} />} />
              <ToggleStyle prop="text-decoration" on="underline" off="none" label="Subrayado" icon={<Underline size={14} />} />
              <SegInput
                prop="text-transform"
                label="Mayúsculas"
                alias={false}
                options={[
                  { value: 'none', label: 'Aa', title: 'Normal' },
                  { value: 'uppercase', label: 'AA', title: 'MAYÚSCULAS' },
                  { value: 'lowercase', label: 'aa', title: 'minúsculas' },
                  { value: 'capitalize', label: 'Ab', title: 'Cada Palabra' },
                ]}
              />
            </div>
          </Field>
        </Section>
      )}

      <Section title="Fondo">
        <Field label="Color" props={['background-color']}>
          <ColorInput prop="background-color" label="Color de fondo" />
        </Field>
        <BackgroundImage />
      </Section>

      {!isBody && (
        <Section title="Tamaño" defaultOpen={false}>
          <div className="fld-pair">
            <Field label="Ancho" props={['width']}>
              <LengthInput prop="width" label="Ancho" keywords={['auto']} units={['px', '%', 'rem', 'vw']} min={0} />
            </Field>
            <Field label="Alto" props={['height']}>
              <LengthInput prop="height" label="Alto" keywords={['auto']} units={['px', '%', 'rem', 'vh']} min={0} />
            </Field>
          </div>
          <div className="fld-pair">
            <Field label="Ancho máx." props={['max-width']}>
              <LengthInput prop="max-width" label="Ancho máximo" keywords={['none']} units={['px', '%', 'rem', 'vw']} min={0} />
            </Field>
            <Field label="Alto mín." props={['min-height']}>
              <LengthInput prop="min-height" label="Alto mínimo" units={['px', '%', 'rem', 'vh']} min={0} />
            </Field>
          </div>
          {el.tagName === 'IMG' && (
            <Field label="Ajuste" props={['object-fit']}>
              <SegInput
                prop="object-fit"
                label="Ajuste de la imagen"
                alias={false}
                options={[
                  { value: 'cover', label: 'Cubrir' },
                  { value: 'contain', label: 'Caber' },
                  { value: 'fill', label: 'Estirar' },
                ]}
              />
            </Field>
          )}
        </Section>
      )}

      <Section title="Espaciado" defaultOpen={false}>
        <SpacingBox />
      </Section>

      {!isBody && (
        <Section title="Disposición" defaultOpen={false}>
          <Field label="Tipo" props={['display']}>
            <SegInput
              prop="display"
              label="Tipo de disposición"
              alias={false}
              options={[
                { value: 'block', label: 'Bloque' },
                { value: 'flex', label: 'Flex', title: 'Elementos en fila o columna' },
                { value: 'grid', label: 'Cuadrícula' },
              ]}
            />
          </Field>
          {isFlex && (
            <>
              <Field label="Dirección" props={['flex-direction']}>
                <SegInput
                  prop="flex-direction"
                  label="Dirección"
                  alias={false}
                  options={[
                    { value: 'row', label: <ArrowRight size={14} />, title: 'En fila' },
                    { value: 'column', label: <ArrowDown size={14} />, title: 'En columna' },
                  ]}
                />
              </Field>
              <Field label="Envolver" props={['flex-wrap']}>
                <SegInput
                  prop="flex-wrap"
                  label="Pasar a otra línea"
                  alias={false}
                  options={[
                    { value: 'nowrap', label: 'No' },
                    { value: 'wrap', label: <WrapText size={14} />, title: 'Pasa a la siguiente línea' },
                  ]}
                />
              </Field>
              <Field label="Alinear" props={['justify-content']}>
                <SelectInput
                  prop="justify-content"
                  label="Alineación principal"
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'flex-start', label: 'Al inicio' },
                    { value: 'center', label: 'Centrado' },
                    { value: 'flex-end', label: 'Al final' },
                    { value: 'space-between', label: 'Espacio entre' },
                    { value: 'space-around', label: 'Espacio alrededor' },
                  ]}
                />
              </Field>
              <Field label="Cruzada" props={['align-items']}>
                <SelectInput
                  prop="align-items"
                  label="Alineación cruzada"
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'flex-start', label: 'Al inicio' },
                    { value: 'center', label: 'Centrado' },
                    { value: 'flex-end', label: 'Al final' },
                    { value: 'stretch', label: 'Estirar' },
                  ]}
                />
              </Field>
            </>
          )}
          {isGrid && (
            <Field label="Columnas" props={['grid-template-columns']}>
              <GridColumns />
            </Field>
          )}
          {(isFlex || isGrid) && (
            <Field label="Separación" props={['gap']}>
              <LengthInput prop="gap" label="Separación entre elementos" units={['px', 'rem', 'em']} min={0} />
            </Field>
          )}
        </Section>
      )}

      {!isBody && (
        <Section title="Borde y sombra" defaultOpen={false}>
          <Field label="Esquinas" props={['border-radius']}>
            <LengthInput prop="border-radius" label="Esquinas redondeadas" units={['px', '%', 'rem']} min={0} />
          </Field>
          <div className="fld-pair">
            <Field label="Borde" props={['border-width']}>
              <LengthInput
                prop="border-width"
                label="Grosor del borde"
                units={['px']}
                min={0}
                also={(): Record<string, string> => (borderStyleOwn.current === 'none' || borderStyleOwn.current === '' ? { 'border-style': 'solid' } : {})}
              />
            </Field>
            <Field label="Estilo" props={['border-style']}>
              <SelectInput
                prop="border-style"
                label="Estilo del borde"
                options={[
                  { value: 'none', label: 'Ninguno' },
                  { value: 'solid', label: 'Sólido' },
                  { value: 'dashed', label: 'Rayas' },
                  { value: 'dotted', label: 'Puntos' },
                ]}
              />
            </Field>
          </div>
          <Field label="Color" props={['border-color']}>
            <ColorInput prop="border-color" label="Color del borde" />
          </Field>
          <Field label="Sombra" props={['box-shadow']}>
            <ShadowInput />
          </Field>
        </Section>
      )}

      <Section title="Apariencia" defaultOpen={false}>
        <Field label="Opacidad" props={['opacity']}>
          <OpacityInput />
        </Field>
        {!isBody && (
          <Field label="Cursor" props={['cursor']}>
            <SelectInput
              prop="cursor"
              label="Cursor"
              options={[
                { value: 'auto', label: 'Automático' },
                { value: 'pointer', label: 'Mano (clic)' },
                { value: 'default', label: 'Flecha' },
              ]}
            />
          </Field>
        )}
      </Section>
      {hasAny && (
        <div className="tab-end">
          <button className="btn small ghost danger" onClick={() => ops.clearStyles(el)}>
            Quitar todos mis cambios de estilo
          </button>
        </div>
      )}
    </div>
  )
}
