const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8')

export function utf8Encode(s: string): Uint8Array {
  return encoder.encode(s)
}

export function utf8Decode(b: Uint8Array): string {
  return decoder.decode(b)
}

const strictDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** Texto UTF-8 sin pérdidas: devuelve null si los bytes no son UTF-8 válido. Si había BOM, lo conserva como \uFEFF. */
export function utf8DecodeStrict(b: Uint8Array): string | null {
  try {
    return strictDecoder.decode(b)
  } catch {
    return null
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '')
  const binary = atob(clean)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? utf8Encode(content) : content
}

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** SHA-1 de un blob de git ("blob <largo>\0contenido"), igual al que calcula GitHub. */
export async function gitBlobSha(content: string | Uint8Array): Promise<string> {
  const bytes = toBytes(content)
  const header = utf8Encode(`blob ${bytes.length}\0`)
  const all = new Uint8Array(header.length + bytes.length)
  all.set(header, 0)
  all.set(bytes, header.length)
  return toHex(await crypto.subtle.digest('SHA-1', all as BufferSource))
}

export async function sha1Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-1', utf8Encode(text) as BufferSource))
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
