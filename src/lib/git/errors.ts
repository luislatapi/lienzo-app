export class GitError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'GitError'
    this.status = status
  }
}

/** Token inválido, vencido o sin permisos. */
export class AuthError extends GitError {
  constructor(message = 'Tu sesión de GitHub no es válida o venció. Vuelve a conectar tu cuenta.') {
    super(message, 401)
    this.name = 'AuthError'
  }
}

export class PermissionError extends GitError {
  constructor(message = 'El token no tiene permiso para escribir en este repositorio.') {
    super(message, 403)
    this.name = 'PermissionError'
  }
}

export class NotFoundError extends GitError {
  constructor(message = 'No se encontró el recurso en GitHub (o el token no tiene acceso a él).') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends GitError {
  constructor(message = 'GitHub limitó temporalmente las solicitudes. Espera unos minutos e intenta de nuevo.') {
    super(message, 429)
    this.name = 'RateLimitError'
  }
}

/** La rama avanzó desde que abriste el archivo, o los archivos cambiaron en GitHub. */
export class ConflictError extends GitError {
  paths: string[]
  constructor(message = 'Alguien más cambió estos archivos en GitHub.', paths: string[] = []) {
    super(message, 409)
    this.name = 'ConflictError'
    this.paths = paths
  }
}

export class NetworkError extends GitError {
  constructor(message = 'No se pudo conectar con GitHub. Revisa tu conexión a internet.') {
    super(message, 0)
    this.name = 'NetworkError'
  }
}

/** El archivo no está en UTF-8 (por ejemplo, ISO-8859-1): editarlo dañaría los acentos. */
export class EncodingError extends GitError {
  path: string
  constructor(path: string) {
    super(
      `“${path}” no está guardado en UTF-8 (probablemente es un archivo antiguo en ISO-8859-1). Para no dañar los acentos, Lienzo no lo abre. Conviértelo a UTF-8 con tu editor de código y vuelve a intentarlo.`,
      0,
    )
    this.name = 'EncodingError'
    this.path = path
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
