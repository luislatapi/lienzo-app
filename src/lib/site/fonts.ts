// Tipografías de Google Fonts que se pueden elegir sin instalar nada.

export type FontKind = 'sans' | 'serif' | 'display' | 'mono' | 'script'

export interface FontDef {
  name: string
  kind: FontKind
  /** pesos disponibles (si se pide uno que no existe, Google responde con error) */
  weights: number[]
}

const sans = (name: string, weights = [400, 500, 600, 700]): FontDef => ({ name, kind: 'sans', weights })
const serif = (name: string, weights = [400, 500, 600, 700]): FontDef => ({ name, kind: 'serif', weights })
const display = (name: string, weights = [400]): FontDef => ({ name, kind: 'display', weights })

export const FONTS: FontDef[] = [
  sans('Inter'),
  sans('Poppins'),
  sans('Montserrat'),
  sans('Open Sans'),
  sans('Roboto'),
  sans('Lato', [400, 700]),
  sans('Nunito'),
  sans('DM Sans'),
  sans('Work Sans'),
  sans('Manrope', [400, 500, 600, 700, 800]),
  sans('Raleway'),
  sans('Rubik'),
  sans('Karla'),
  sans('Outfit'),
  sans('Plus Jakarta Sans'),
  sans('Space Grotesk', [400, 500, 600, 700]),
  sans('Figtree'),
  serif('Playfair Display'),
  serif('Lora'),
  serif('Merriweather', [400, 700]),
  serif('Cormorant Garamond'),
  serif('DM Serif Display'),
  serif('Libre Baskerville', [400, 700]),
  serif('Fraunces'),
  serif('Source Serif 4'),
  display('Bebas Neue'),
  display('Anton'),
  display('Abril Fatface'),
  display('Bricolage Grotesque', [400, 500, 600, 700]),
  display('Archivo Black'),
  display('Lobster'),
  { name: 'Pacifico', kind: 'script', weights: [400] },
  { name: 'Dancing Script', kind: 'script', weights: [400, 500, 600, 700] },
  { name: 'Caveat', kind: 'script', weights: [400, 500, 600, 700] },
  { name: 'JetBrains Mono', kind: 'mono', weights: [400, 500, 700] },
  { name: 'Fira Code', kind: 'mono', weights: [400, 500, 700] },
]

export const FONT_KIND_LABEL: Record<FontKind, string> = {
  sans: 'Sin serifa',
  serif: 'Con serifa',
  display: 'Para títulos',
  mono: 'Código',
  script: 'Manuscrita',
}

const FALLBACK: Record<FontKind, string> = {
  sans: 'sans-serif',
  serif: 'serif',
  display: 'sans-serif',
  mono: 'monospace',
  script: 'cursive',
}

export function stackFor(f: FontDef): string {
  return `'${f.name}', ${FALLBACK[f.kind]}`
}

export function findFont(name: string): FontDef | undefined {
  return FONTS.find((f) => f.name.toLowerCase() === name.trim().toLowerCase())
}

/** Dirección del CSS de Google Fonts para una o más tipografías. */
export function googleFontsHref(fonts: FontDef[]): string {
  const fams = fonts.map((f) => {
    const name = f.name.replace(/ /g, '+')
    if (f.weights.length === 1 && f.weights[0] === 400) return `family=${name}`
    return `family=${name}:wght@${f.weights.join(';')}`
  })
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`
}
