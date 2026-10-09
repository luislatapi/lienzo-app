import { useEffect, useRef, useState } from 'react'
import { ExternalLink, ImagePlus, ListPlus, Pencil, Plus, Code2 } from 'lucide-react'
import { isButtonLike, isTextEditable, type El } from '../../../lib/editor/dom-utils'
import { basename, relativeRef, resolveRef } from '../../../lib/site/paths'
import { useUI } from '../../../store/ui'
import { Section } from '../../kit'
import { useEditor } from '../context'
import { Toggle, useSel } from './controls'

/** Campo de texto ligado a un atributo del elemento (alt, placeholder, href…). */
export function AttrInput({
  name,
  label,
  placeholder,
  multiline,
  mono,
  hint,
}: {
  name: string
  label: string
  placeholder?: string
  multiline?: boolean
  mono?: boolean
  hint?: string
}) {
  const { engine, el, ops } = useSel()
  const raw = el.getAttribute(name) ?? ''
  const value = engine.hub ? engine.hub.restoreValue(raw) : raw
  const [text, setText] = useState(value)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(value)
  }, [value, el])
  const change = (v: string) => {
    setText(v)
    ops.setAttr(el, name, v === '' ? null : v)
  }
  const props = {
    value: text,
    placeholder,
    'aria-label': label,
    spellCheck: !mono,
    onFocus: () => (focus.current = true),
    onBlur: () => {
      focus.current = false
      setText(value)
    },
  }
  return (
    <div className="field-block">
      <label className="field-label">{label}</label>
      {multiline ? (
        <textarea className="textarea" rows={3} {...props} onChange={(e) => change(e.target.value)} />
      ) : (
        <input className={'input' + (mono ? ' mono' : '')} {...props} onChange={(e) => change(e.target.value)} />
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

function plainText(el: Element): string {
  let out = ''
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) out += (n.textContent || '').replace(/\s+/g, ' ')
    else if ((n as Element).tagName === 'BR') out += '\n'
  })
  return out.replace(/ ?\n ?/g, '\n').trim()
}

const TEXT_TYPES = [
  { tag: 'h1', label: 'Título principal (H1)' },
  { tag: 'h2', label: 'Título (H2)' },
  { tag: 'h3', label: 'Subtítulo (H3)' },
  { tag: 'h4', label: 'Subtítulo pequeño (H4)' },
  { tag: 'p', label: 'Párrafo' },
  { tag: 'div', label: 'Contenedor de texto' },
  { tag: 'span', label: 'Texto en línea' },
  { tag: 'blockquote', label: 'Cita' },
]

function TextBlock() {
  const { engine, el, ops } = useSel()
  const hasKids = el.children.length > 0 && Array.from(el.children).some((c) => c.tagName !== 'BR')
  const value = plainText(el)
  const [text, setText] = useState(value)
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(value)
  }, [value, el])
  const tag = el.localName
  return (
    <>
      {TEXT_TYPES.some((t) => t.tag === tag) && (
        <div className="field-block">
          <label className="field-label">Tipo de texto</label>
          <select className="select" value={tag} aria-label="Tipo de texto" onChange={(e) => ops.changeTag(el, e.target.value)}>
            {TEXT_TYPES.map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field-block">
        <label className="field-label">Texto</label>
        {hasKids ? (
          <>
            <p className="hint">Este texto tiene partes con formato (negritas, enlaces…). Edítalo directamente en la página para conservarlas.</p>
            <button className="btn small" onClick={() => el instanceof (engine.win as Window & typeof globalThis).HTMLElement && engine.startTextEdit(el)}>
              <Pencil size={13} /> Editar en la página
            </button>
          </>
        ) : (
          <textarea
            className="textarea"
            rows={Math.min(8, Math.max(3, text.split('\n').length + 1))}
            value={text}
            aria-label="Texto"
            onFocus={() => (focus.current = true)}
            onBlur={() => {
              focus.current = false
              setText(value)
            }}
            onChange={(e) => {
              setText(e.target.value)
              ops.setText(el, e.target.value)
            }}
          />
        )}
      </div>
    </>
  )
}

// ── enlaces ─────────────────────────────────────────────────────────────────
type LinkMode = 'none' | 'page' | 'section' | 'url' | 'email' | 'phone' | 'whatsapp'

const MODE_LABEL: Record<LinkMode, string> = {
  none: 'Sin enlace',
  page: 'Otra página del sitio',
  section: 'Una sección de esta página',
  url: 'Dirección web',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
}

function LinkEditor() {
  const { engine, el, ops } = useSel()
  const { project } = useEditor()
  const href = el.getAttribute('href')
  const pages = project.site.pages
  const ids = engine.doc ? Array.from(engine.doc.querySelectorAll<HTMLElement>('[id]')).filter((n) => n.id && !n.hasAttribute('data-lz-editor')) : []

  const mode: LinkMode = (() => {
    if (href === null || href === '') return 'none'
    if (href.startsWith('#')) return 'section'
    if (/^mailto:/i.test(href)) return 'email'
    if (/^tel:/i.test(href)) return 'phone'
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)/i.test(href)) return 'whatsapp'
    if (/^(https?:)?\/\//i.test(href)) return 'url'
    const target = resolveRef(href, engine.pagePath, project.site.siteRoot)
    return target && pages.includes(target) ? 'page' : 'url'
  })()

  const set = (v: string | null) => ops.setAttr(el, 'href', v, 'Cambiar enlace')
  const pageRef = (p: string) => relativeRef(engine.pagePath, p, project.site.siteRoot)
  const current = href ?? ''
  const phoneDigits = current.replace(/^tel:/i, '')
  const waNumber = current.replace(/^https?:\/\/(wa\.me|api\.whatsapp\.com\/send\?phone=)\/?/i, '').split(/[?&]/)[0]

  const changeMode = (m: LinkMode) => {
    if (m === 'none') set(null)
    else if (m === 'page') set(pageRef(pages.find((p) => p !== engine.pagePath) ?? pages[0] ?? engine.pagePath))
    else if (m === 'section') set(ids[0] ? '#' + ids[0].id : '#')
    else if (m === 'url') set('https://')
    else if (m === 'email') set('mailto:')
    else if (m === 'phone') set('tel:')
    else set('https://wa.me/')
  }
  const newTab = el.getAttribute('target') === '_blank'

  return (
    <>
      <div className="field-block">
        <label className="field-label">Al hacer clic, ir a…</label>
        <select className="select" value={mode} aria-label="Tipo de enlace" onChange={(e) => changeMode(e.target.value as LinkMode)}>
          {(Object.keys(MODE_LABEL) as LinkMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      {mode === 'page' && (
        <div className="field-block">
          <label className="field-label">Página</label>
          <select
            className="select"
            aria-label="Página de destino"
            value={pages.find((p) => resolveRef(current, engine.pagePath, project.site.siteRoot) === p) ?? ''}
            onChange={(e) => set(pageRef(e.target.value))}
          >
            {pages.map((p) => (
              <option key={p} value={p}>
                {p === 'index.html' ? 'Inicio (index.html)' : basename(p)}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode === 'section' && (
        <div className="field-block">
          <label className="field-label">Sección</label>
          <select className="select" aria-label="Sección de destino" value={current} onChange={(e) => set(e.target.value)}>
            {!ids.some((n) => '#' + n.id === current) && <option value={current}>{current || 'Elige una sección'}</option>}
            {ids.map((n) => (
              <option key={n.id} value={'#' + n.id}>
                #{n.id}
              </option>
            ))}
          </select>
          {ids.length === 0 && <p className="hint">Esta página aún no tiene secciones con nombre. Ponle un “id” a una sección en la pestaña Avanzado.</p>}
        </div>
      )}
      {mode === 'url' && <AttrInput name="href" label="Dirección" placeholder="https://tusitio.com" mono />}
      {mode === 'email' && (
        <div className="field-block">
          <label className="field-label">Correo</label>
          <input className="input" type="email" aria-label="Correo" placeholder="hola@tusitio.com" value={current.replace(/^mailto:/i, '')} onChange={(e) => set('mailto:' + e.target.value)} />
        </div>
      )}
      {mode === 'phone' && (
        <div className="field-block">
          <label className="field-label">Teléfono</label>
          <input className="input" type="tel" aria-label="Teléfono" placeholder="+52 55 1234 5678" value={phoneDigits} onChange={(e) => set('tel:' + e.target.value.replace(/[^\d+]/g, ''))} />
        </div>
      )}
      {mode === 'whatsapp' && (
        <div className="field-block">
          <label className="field-label">Número con lada</label>
          <input
            className="input"
            aria-label="Número de WhatsApp"
            placeholder="525512345678"
            value={waNumber}
            onChange={(e) => set('https://wa.me/' + e.target.value.replace(/\D/g, ''))}
          />
          <p className="hint">Sin “+” ni espacios. México: 52 + 10 dígitos.</p>
        </div>
      )}
      {mode !== 'none' && mode !== 'section' && (
        <Toggle
          label="Abrir en una pestaña nueva"
          checked={newTab}
          onChange={(v) => ops.setAttrs(el, v ? { target: '_blank', rel: 'noopener noreferrer' } : { target: null, rel: null }, 'Cambiar enlace')}
        />
      )}
    </>
  )
}

// ── imagen ──────────────────────────────────────────────────────────────────
function ImageBlock() {
  const { el, engine } = useSel()
  const ui = useUI()
  const img = el as HTMLImageElement
  const src = img.getAttribute('src') || ''
  const original = engine.hub ? engine.hub.restoreValue(src) : src
  const placeholder = src.startsWith('data:')
  return (
    <>
      <div className="img-preview">
        {src ? <img src={src} alt="" draggable={false} /> : <span>Sin imagen</span>}
      </div>
      <p className="hint mono">{placeholder ? 'Imagen de ejemplo' : original || 'Sin ruta'}</p>
      <div className="row-actions">
        <button className="btn small primary" onClick={() => ui.openDialog('image-picker', { target: 'element' })}>
          <ImagePlus size={13} /> Cambiar imagen
        </button>
      </div>
      <AttrInput name="alt" label="Descripción (texto alternativo)" placeholder="Describe la imagen para buscadores y lectores de pantalla" multiline />
    </>
  )
}

function FormBlock({ tag }: { tag: string }) {
  const { el, ops } = useSel()
  const attrs = (name: string) => el.hasAttribute(name)
  return (
    <>
      {(tag === 'input' || tag === 'textarea') && <AttrInput name="placeholder" label="Texto de ayuda (placeholder)" />}
      {(tag === 'input' || tag === 'textarea' || tag === 'select') && <AttrInput name="name" label="Nombre del campo" mono hint="Así se identifica el dato cuando se envía el formulario." />}
      {tag === 'input' && (
        <div className="field-block">
          <label className="field-label">Tipo de campo</label>
          <select className="select" value={el.getAttribute('type') || 'text'} aria-label="Tipo de campo" onChange={(e) => ops.setAttr(el, 'type', e.target.value)}>
            {['text', 'email', 'tel', 'number', 'password', 'date', 'url', 'search', 'submit', 'checkbox', 'radio'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      {(tag === 'input' || tag === 'textarea' || tag === 'select') && (
        <Toggle label="Campo obligatorio" checked={attrs('required')} onChange={(v) => ops.setAttr(el, 'required', v ? '' : null)} />
      )}
      {tag === 'form' && (
        <>
          <AttrInput name="action" label="A dónde se envía (action)" mono placeholder="https://formspree.io/f/…" hint="Los sitios estáticos necesitan un servicio que reciba el formulario, como Formspree o Getform." />
          <div className="field-block">
            <label className="field-label">Método</label>
            <select className="select" value={(el.getAttribute('method') || 'get').toLowerCase()} aria-label="Método" onChange={(e) => ops.setAttr(el, 'method', e.target.value)}>
              <option value="get">GET</option>
              <option value="post">POST</option>
            </select>
          </div>
        </>
      )}
    </>
  )
}

function MediaBlock({ tag }: { tag: string }) {
  const { el, ops } = useSel()
  return (
    <>
      <AttrInput name="src" label="Dirección del archivo" mono />
      {(['controls', 'autoplay', 'loop', 'muted'] as const).map((a) => (
        <Toggle
          key={a}
          label={{ controls: 'Mostrar controles', autoplay: 'Reproducir solo', loop: 'Repetir', muted: 'Sin sonido' }[a]}
          checked={el.hasAttribute(a)}
          onChange={(v) => ops.setAttr(el, a, v ? '' : null)}
        />
      ))}
      {tag === 'video' && <AttrInput name="poster" label="Imagen de portada (poster)" mono />}
    </>
  )
}

export function ContentTab() {
  const { engine, el, ops } = useSel()
  const ui = useUI()
  const tag = el.localName
  const isBody = el === engine.body
  const winEl = engine.win as Window & typeof globalThis
  const textual = el instanceof winEl.HTMLElement && isTextEditable(el) && !['a', 'button'].includes(tag) && !isButtonLike(el)
  const isLink = tag === 'a'
  const isButton = isButtonLike(el) && !isLink
  const isForm = ['input', 'textarea', 'select', 'form'].includes(tag)

  return (
    <div className="tab-scroll">
      {isBody && (
        <Section title="Página completa">
          <p className="hint">Seleccionaste toda la página. Haz clic en un texto, imagen o sección para editar su contenido.</p>
        </Section>
      )}

      {textual && (
        <Section title="Texto">
          <TextBlock />
        </Section>
      )}

      {(isLink || isButton) && (
        <Section title={isButtonLike(el) ? 'Botón' : 'Enlace'}>
          {tag === 'input' ? <AttrInput name="value" label="Texto del botón" /> : <TextBlock />}
          {isLink && <LinkEditor />}
        </Section>
      )}

      {tag === 'img' && (
        <Section title="Imagen">
          <ImageBlock />
        </Section>
      )}

      {(tag === 'video' || tag === 'audio') && (
        <Section title={tag === 'video' ? 'Video' : 'Audio'}>
          <MediaBlock tag={tag} />
        </Section>
      )}

      {tag === 'iframe' && (
        <Section title="Contenido incrustado">
          <AttrInput name="data-lz-src" label="Dirección (URL)" mono hint="Aparece al publicar o en la vista previa." />
        </Section>
      )}

      {isForm && (
        <Section title="Formulario">
          <FormBlock tag={tag} />
        </Section>
      )}

      {(tag === 'ul' || tag === 'ol') && (
        <Section title="Lista">
          <button
            className="btn small"
            onClick={() => {
              const last = el.lastElementChild
              if (last) ops.insert(ops.cleanHtmlOf(last as El), last as El, 'after', { select: true, label: 'Agregar elemento' })
              else ops.insert('<li>Nuevo elemento</li>', el, 'append', { select: true, label: 'Agregar elemento' })
            }}
          >
            <ListPlus size={13} /> Agregar elemento
          </button>
        </Section>
      )}

      {!isBody && !['img', 'br', 'hr'].includes(tag) && !textual && !isLink && !isButton && !isForm && !['video', 'audio', 'iframe', 'ul', 'ol'].includes(tag) && (
        <Section title="Contenedor">
          <p className="hint">Este elemento agrupa a otros. Selecciona uno de sus textos o imágenes para editarlo, o agrega algo nuevo dentro.</p>
          <div className="row-actions">
            <button className="btn small" onClick={() => ui.setLeftTab('add')}>
              <Plus size={13} /> Agregar dentro
            </button>
            <button className="btn small ghost" onClick={() => ui.setLeftTab('layers')}>
              Ver capas
            </button>
          </div>
        </Section>
      )}

      {!isBody && (
        <Section title="Código de este elemento" defaultOpen={false}>
          <button className="btn small" onClick={() => ui.openDialog('code', { element: true })}>
            <Code2 size={13} /> Editar HTML
          </button>
        </Section>
      )}
      {isLink && el.getAttribute('href')?.startsWith('http') && (
        <div className="tab-end">
          <a className="btn small ghost" href={el.getAttribute('href') || '#'} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> Probar enlace
          </a>
        </div>
      )}
    </div>
  )
}
