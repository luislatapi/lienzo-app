// Catálogo de bloques que se pueden agregar a la página.
// Los bloques usan la tipografía y el color de texto de la página (inherit / currentColor) y un
// color de acento (--lz-accent) que se calcula a partir de los colores que ya usa el sitio.

export type BlockKind = 'element' | 'section'

export interface BlockDef {
  id: string
  name: string
  hint: string
  category: 'basic' | 'section' | 'media'
  kind: BlockKind
  icon: string
  html: string
  /** CSS propio del bloque */
  css?: string
  /** usa los estilos comunes de secciones (.lzb-wrap, .lzb-btn, …) */
  base?: boolean
}

const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#e9e8f0"/><path d="M0 330l150-130 110 90 120-120 260 190v40H0z" fill="#cfcde0"/><circle cx="470" cy="110" r="42" fill="#cfcde0"/></svg>',
  )

export const BASE_CSS = `.lzb-wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.lzb-sec{padding:72px 0;color:inherit;font-family:inherit}
.lzb-sec h2{font-size:clamp(28px,3.4vw,42px);line-height:1.12;margin:0 0 14px;font-weight:700}
.lzb-sec p{margin:0 0 14px;line-height:1.6}
.lzb-lead{font-size:18px;opacity:.75;max-width:40em}
.lzb-btn{display:inline-block;padding:13px 26px;border-radius:999px;background:var(--lz-accent,#e5007d);color:var(--lz-on-accent,#fff);font-weight:700;text-decoration:none;font-family:inherit;line-height:1.2}
.lzb-btn.alt{background:transparent;color:inherit;border:2px solid currentColor}
.lzb-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.lzb-grid{display:grid;gap:24px}
.lzb-grid.c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.lzb-grid.c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.lzb-card{padding:26px;border-radius:16px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);background:color-mix(in srgb,currentColor 4%,transparent)}
.lzb-card h3{margin:0 0 8px;font-size:21px}
.lzb-card p:last-child{margin-bottom:0}
.lzb-sec img{max-width:100%;height:auto;border-radius:16px;display:block}
@media (max-width:820px){.lzb-grid.c2,.lzb-grid.c3{grid-template-columns:1fr}.lzb-sec{padding:48px 0}}
`

export const BLOCKS: BlockDef[] = [
  // ── básicos ────────────────────────────────────────────────────────────
  {
    id: 'titulo',
    name: 'Título',
    hint: 'Encabezado de sección',
    category: 'basic',
    kind: 'element',
    icon: 'Heading2',
    html: '<h2>Escribe aquí tu título</h2>',
  },
  {
    id: 'parrafo',
    name: 'Párrafo',
    hint: 'Texto corrido',
    category: 'basic',
    kind: 'element',
    icon: 'Pilcrow',
    html: '<p>Cuéntale a tus visitantes qué ofreces, por qué es diferente y qué deben hacer después. Haz doble clic para editar este texto.</p>',
  },
  {
    id: 'boton',
    name: 'Botón',
    hint: 'Enlace con aspecto de botón',
    category: 'basic',
    kind: 'element',
    icon: 'MousePointerClick',
    html: '<a class="lzb-btn" href="#">Haz clic aquí</a>',
    css: '.lzb-btn{display:inline-block;padding:13px 26px;border-radius:999px;background:var(--lz-accent,#e5007d);color:var(--lz-on-accent,#fff);font-weight:700;text-decoration:none;font-family:inherit;line-height:1.2}',
  },
  {
    id: 'whatsapp',
    name: 'Botón de WhatsApp',
    hint: 'Abre un chat con tu número',
    category: 'basic',
    kind: 'element',
    icon: 'MessageCircle',
    html: '<a class="lzb-wa" href="https://wa.me/5215512345678?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>',
    css: '.lzb-wa{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;background:#1fa855;color:#fff;font-weight:700;text-decoration:none;font-family:inherit;line-height:1.2}',
  },
  {
    id: 'imagen',
    name: 'Imagen',
    hint: 'Foto o ilustración',
    category: 'media',
    kind: 'element',
    icon: 'Image',
    html: `<img src="${PLACEHOLDER_IMG}" alt="Describe la imagen" style="max-width:100%;height:auto;display:block">`,
  },
  {
    id: 'video',
    name: 'Video de YouTube',
    hint: 'Pega el enlace de tu video',
    category: 'media',
    kind: 'element',
    icon: 'Video',
    html: '<div class="lzb-video"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>',
    css: '.lzb-video{position:relative;aspect-ratio:16/9;width:100%;border-radius:16px;overflow:hidden}.lzb-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}',
  },
  {
    id: 'mapa',
    name: 'Mapa',
    hint: 'Google Maps incrustado',
    category: 'media',
    kind: 'element',
    icon: 'MapPin',
    html: '<div class="lzb-video"><iframe src="https://www.google.com/maps?q=Zócalo%2C%20Ciudad%20de%20México&output=embed" title="Mapa" loading="lazy"></iframe></div>',
    css: '.lzb-video{position:relative;aspect-ratio:16/9;width:100%;border-radius:16px;overflow:hidden}.lzb-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}',
  },
  {
    id: 'separador',
    name: 'Separador',
    hint: 'Línea divisoria',
    category: 'basic',
    kind: 'element',
    icon: 'Minus',
    html: '<hr style="border:0;border-top:1px solid currentColor;opacity:.2;margin:32px 0">',
  },
  {
    id: 'espacio',
    name: 'Espacio',
    hint: 'Aire entre elementos',
    category: 'basic',
    kind: 'element',
    icon: 'MoveVertical',
    html: '<div style="height:64px" aria-hidden="true"></div>',
  },
  {
    id: 'lista',
    name: 'Lista',
    hint: 'Viñetas con ventajas',
    category: 'basic',
    kind: 'element',
    icon: 'List',
    html: '<ul style="padding-left:1.2em;line-height:1.8"><li>Primer beneficio</li><li>Segundo beneficio</li><li>Tercer beneficio</li></ul>',
  },
  {
    id: 'cita',
    name: 'Cita',
    hint: 'Frase destacada',
    category: 'basic',
    kind: 'element',
    icon: 'Quote',
    html: '<blockquote style="margin:24px 0;padding:6px 0 6px 22px;border-left:4px solid var(--lz-accent,#e5007d);font-size:20px;line-height:1.5"><p style="margin:0 0 8px">“Una frase de un cliente que explique por qué eligió tu negocio.”</p><footer style="font-size:15px;opacity:.7">Nombre del cliente</footer></blockquote>',
  },
  {
    id: 'html',
    name: 'Código HTML',
    hint: 'Pixel, widget o embed',
    category: 'media',
    kind: 'element',
    icon: 'CodeXml',
    html: '<div class="lzb-embed"><!-- Pega aquí tu código --></div>',
  },
  // ── secciones ──────────────────────────────────────────────────────────
  {
    id: 'hero',
    name: 'Portada',
    hint: 'Titular, texto, botones e imagen',
    category: 'section',
    kind: 'section',
    icon: 'LayoutTemplate',
    html: `<section class="lzb-sec lzb-hero"><div class="lzb-wrap lzb-grid c2" style="align-items:center"><div><h2 style="font-size:clamp(34px,5vw,58px);line-height:1.05">Un titular claro que explique tu propuesta</h2><p class="lzb-lead">Una frase breve que diga qué haces, para quién y por qué conviene elegirte.</p><div class="lzb-row"><a class="lzb-btn" href="#">Empezar ahora</a><a class="lzb-btn alt" href="#">Saber más</a></div></div><img src="${PLACEHOLDER_IMG}" alt="Imagen de portada"></div></section>`,
    base: true,
  },
  {
    id: 'beneficios',
    name: 'Beneficios',
    hint: 'Tres columnas con título y texto',
    category: 'section',
    kind: 'section',
    icon: 'Columns3',
    html: '<section class="lzb-sec"><div class="lzb-wrap"><h2>Por qué elegirnos</h2><p class="lzb-lead">Tres razones que hacen la diferencia.</p><div class="lzb-grid c3" style="margin-top:28px"><div class="lzb-card"><h3>Primer beneficio</h3><p>Explica en una o dos líneas qué gana tu cliente con esto.</p></div><div class="lzb-card"><h3>Segundo beneficio</h3><p>Explica en una o dos líneas qué gana tu cliente con esto.</p></div><div class="lzb-card"><h3>Tercer beneficio</h3><p>Explica en una o dos líneas qué gana tu cliente con esto.</p></div></div></div></section>',
    base: true,
  },
  {
    id: 'texto-imagen',
    name: 'Texto con imagen',
    hint: 'Dos columnas',
    category: 'section',
    kind: 'section',
    icon: 'Columns2',
    html: `<section class="lzb-sec"><div class="lzb-wrap lzb-grid c2" style="align-items:center"><img src="${PLACEHOLDER_IMG}" alt="Describe la imagen"><div><h2>Cuenta tu historia</h2><p>Escribe aquí un párrafo sobre tu negocio, cómo empezó y qué lo hace especial. Las personas compran a quien conocen.</p><a class="lzb-btn" href="#">Conócenos</a></div></div></section>`,
    base: true,
  },
  {
    id: 'testimonios',
    name: 'Testimonios',
    hint: 'Opiniones de clientes',
    category: 'section',
    kind: 'section',
    icon: 'MessageSquare',
    html: '<section class="lzb-sec"><div class="lzb-wrap"><h2>Lo que dicen nuestros clientes</h2><div class="lzb-grid c3" style="margin-top:28px"><figure class="lzb-card" style="margin:0"><p>“Escribe aquí una opinión real y específica de un cliente.”</p><figcaption><b>Nombre Apellido</b><br><span style="opacity:.65">Cliente desde 2024</span></figcaption></figure><figure class="lzb-card" style="margin:0"><p>“Escribe aquí una opinión real y específica de un cliente.”</p><figcaption><b>Nombre Apellido</b><br><span style="opacity:.65">Cliente desde 2024</span></figcaption></figure><figure class="lzb-card" style="margin:0"><p>“Escribe aquí una opinión real y específica de un cliente.”</p><figcaption><b>Nombre Apellido</b><br><span style="opacity:.65">Cliente desde 2024</span></figcaption></figure></div></div></section>',
    base: true,
  },
  {
    id: 'precios',
    name: 'Precios',
    hint: 'Tres planes',
    category: 'section',
    kind: 'section',
    icon: 'CreditCard',
    html: '<section class="lzb-sec"><div class="lzb-wrap"><h2>Elige tu plan</h2><p class="lzb-lead">Precios claros, sin letras chiquitas.</p><div class="lzb-grid c3" style="margin-top:28px"><div class="lzb-card"><h3>Básico</h3><p style="font-size:34px;font-weight:700;margin:0 0 12px">$299 <small style="font-size:15px;opacity:.6">MXN/mes</small></p><ul style="padding-left:1.1em;line-height:1.8"><li>Incluye esto</li><li>Incluye aquello</li></ul><a class="lzb-btn alt" href="#">Elegir</a></div><div class="lzb-card" style="border:2px solid var(--lz-accent,#e5007d)"><h3>Popular</h3><p style="font-size:34px;font-weight:700;margin:0 0 12px">$599 <small style="font-size:15px;opacity:.6">MXN/mes</small></p><ul style="padding-left:1.1em;line-height:1.8"><li>Todo lo básico</li><li>Más funciones</li><li>Soporte prioritario</li></ul><a class="lzb-btn" href="#">Elegir</a></div><div class="lzb-card"><h3>Pro</h3><p style="font-size:34px;font-weight:700;margin:0 0 12px">$999 <small style="font-size:15px;opacity:.6">MXN/mes</small></p><ul style="padding-left:1.1em;line-height:1.8"><li>Todo lo popular</li><li>Para equipos</li></ul><a class="lzb-btn alt" href="#">Elegir</a></div></div></div></section>',
    base: true,
  },
  {
    id: 'faq',
    name: 'Preguntas frecuentes',
    hint: 'Desplegables',
    category: 'section',
    kind: 'section',
    icon: 'CircleHelp',
    html: '<section class="lzb-sec"><div class="lzb-wrap" style="max-width:820px"><h2>Preguntas frecuentes</h2><details class="lzb-faq" open><summary>¿Primera pregunta que te hacen siempre?</summary><p>Responde con claridad y en pocas líneas.</p></details><details class="lzb-faq"><summary>¿Segunda pregunta?</summary><p>Responde con claridad y en pocas líneas.</p></details><details class="lzb-faq"><summary>¿Tercera pregunta?</summary><p>Responde con claridad y en pocas líneas.</p></details></div></section>',
    base: true,
    css: '.lzb-faq{border-bottom:1px solid color-mix(in srgb,currentColor 18%,transparent);padding:16px 0}.lzb-faq summary{cursor:pointer;font-weight:700;font-size:18px}.lzb-faq p{margin:10px 0 0;opacity:.8}',
  },
  {
    id: 'cta',
    name: 'Llamado a la acción',
    hint: 'Franja con botón',
    category: 'section',
    kind: 'section',
    icon: 'Megaphone',
    html: '<section class="lzb-sec"><div class="lzb-wrap"><div class="lzb-cta"><h2>¿Listo para empezar?</h2><p class="lzb-lead" style="margin-left:auto;margin-right:auto;opacity:.9">Escríbenos hoy y te respondemos en menos de un día.</p><a class="lzb-btn lzb-cta-btn" href="#">Contactar ahora</a></div></div></section>',
    base: true,
    css: '.lzb-cta{text-align:center;padding:56px 24px;border-radius:24px;background:var(--lz-accent,#e5007d);color:var(--lz-on-accent,#fff)}.lzb-cta .lzb-cta-btn{background:var(--lz-on-accent,#fff);color:var(--lz-accent,#e5007d)}',
  },
  {
    id: 'galeria',
    name: 'Galería',
    hint: 'Cuadrícula de fotos',
    category: 'media',
    kind: 'section',
    icon: 'LayoutGrid',
    html: `<section class="lzb-sec"><div class="lzb-wrap"><h2>Galería</h2><div class="lzb-gal">${Array.from({ length: 6 }, (_, i) => `<img src="${PLACEHOLDER_IMG}" alt="Foto ${i + 1}">`).join('')}</div></div></section>`,
    base: true,
    css: '.lzb-gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:24px}.lzb-gal img{width:100%;aspect-ratio:4/3;object-fit:cover}@media (max-width:820px){.lzb-gal{grid-template-columns:repeat(2,minmax(0,1fr))}}',
  },
  {
    id: 'contacto',
    name: 'Formulario de contacto',
    hint: 'Nombre, correo y mensaje',
    category: 'section',
    kind: 'section',
    icon: 'Mail',
    html: '<section class="lzb-sec"><div class="lzb-wrap" style="max-width:640px"><h2>Escríbenos</h2><p class="lzb-lead">Te respondemos en menos de 24 horas.</p><form class="lzb-form" action="#" method="post"><label>Nombre<input type="text" name="nombre" required></label><label>Correo<input type="email" name="correo" required></label><label>Mensaje<textarea name="mensaje" rows="4" required></textarea></label><button class="lzb-btn" type="submit" style="border:0;cursor:pointer;font-size:16px">Enviar mensaje</button></form></div></section>',
    base: true,
    css: '.lzb-form{display:grid;gap:16px;margin-top:24px}.lzb-form label{display:grid;gap:6px;font-weight:600}.lzb-form input,.lzb-form textarea{padding:12px 14px;border-radius:10px;border:1px solid color-mix(in srgb,currentColor 28%,transparent);font:inherit;background:transparent;color:inherit}',
  },
  {
    id: 'pie',
    name: 'Pie de página',
    hint: 'Datos de contacto y enlaces',
    category: 'section',
    kind: 'section',
    icon: 'PanelBottom',
    html: '<footer class="lzb-sec lzb-foot"><div class="lzb-wrap lzb-grid c3"><div><b style="font-size:20px">Tu negocio</b><p style="opacity:.7;margin-top:8px">Una frase corta que describa lo que haces.</p></div><div><b>Contacto</b><p style="opacity:.8;margin-top:8px">hola@tunegocio.com<br>+52 55 1234 5678</p></div><div><b>Síguenos</b><p style="opacity:.8;margin-top:8px"><a href="#" style="color:inherit">Instagram</a> · <a href="#" style="color:inherit">Facebook</a></p></div></div></footer>',
    base: true,
    css: '.lzb-foot{padding:48px 0;border-top:1px solid color-mix(in srgb,currentColor 16%,transparent)}',
  },
  {
    id: 'anuncio',
    name: 'Barra de anuncio',
    hint: 'Aviso arriba de la página',
    category: 'section',
    kind: 'section',
    icon: 'Megaphone',
    html: '<div class="lzb-bar">Envío gratis en pedidos mayores a $500 MXN</div>',
    css: '.lzb-bar{padding:10px 16px;text-align:center;font-weight:600;font-size:14px;background:var(--lz-accent,#e5007d);color:var(--lz-on-accent,#fff)}',
  },
]

export const BLOCK_CATEGORIES: Array<{ id: BlockDef['category']; label: string }> = [
  { id: 'basic', label: 'Básicos' },
  { id: 'section', label: 'Secciones' },
  { id: 'media', label: 'Medios y código' },
]

// ── color de acento del sitio ───────────────────────────────────────────────

function parseRgb(c: string): [number, number, number, number] | null {
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null
  return [p[0], p[1], p[2], p[3] ?? 1]
}

function toHex([r, g, b]: [number, number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function luminance([r, g, b]: [number, number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function isNeutral([r, g, b]: [number, number, number, number]): boolean {
  return Math.max(r, g, b) - Math.min(r, g, b) < 24
}

/** Busca el color de marca de la página: variables CSS tipo --primary o el fondo de sus botones. */
export function detectAccent(doc: Document, win: Window): { accent: string; onAccent: string } {
  const fallback = { accent: '#e5007d', onAccent: '#ffffff' }
  const make = (rgb: [number, number, number, number]) => ({
    accent: toHex(rgb),
    onAccent: luminance(rgb) > 0.55 ? '#1b1a2e' : '#ffffff',
  })
  try {
    const probe = doc.createElement('span')
    probe.style.display = 'none'
    doc.body.appendChild(probe)
    const cs = win.getComputedStyle(doc.documentElement)
    for (const sheet of Array.from(doc.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof (win as unknown as typeof globalThis).CSSStyleRule) || !/:root|^html$/.test(rule.selectorText)) continue
        for (let i = 0; i < rule.style.length; i++) {
          const name = rule.style.item(i)
          if (!name.startsWith('--') || !/(primary|accent|brand|principal|main|rosa|color-1|cta)/i.test(name)) continue
          probe.style.color = cs.getPropertyValue(name).trim()
          const rgb = parseRgb(win.getComputedStyle(probe).color)
          if (rgb && rgb[3] > 0.9 && !isNeutral(rgb)) {
            probe.remove()
            return make(rgb)
          }
        }
      }
    }
    probe.remove()
    const candidates = doc.querySelectorAll('a[class*="btn"], a[class*="boton"], a[class*="button"], button, [class*="cta"]')
    for (const el of Array.from(candidates)) {
      const rgb = parseRgb(win.getComputedStyle(el).backgroundColor)
      if (rgb && rgb[3] > 0.9 && !isNeutral(rgb)) return make(rgb)
    }
  } catch {
    /* sin acceso a las hojas de estilo */
  }
  return fallback
}
