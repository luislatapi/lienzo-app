import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthError, ConflictError, EncodingError, NetworkError, NotFoundError, RateLimitError } from '../../src/lib/git/errors'
import { GitHubProvider } from '../../src/lib/git/github'
import { DEMO_REPO_FILES } from '../../src/lib/git/demo-site'
import { Project } from '../../src/lib/project'
import { startMockGitHub, type MockGitHub } from '../mock/github-server'

let mock: MockGitHub
let gh: GitHubProvider

beforeAll(async () => {
  mock = await startMockGitHub({ files: DEMO_REPO_FILES, deployMs: 700 })
  gh = new GitHubProvider(mock.token, mock.url)
})
afterAll(async () => {
  await mock.close()
})

const owner = 'luis'
const name = 'casa-nopal'

describe('GitHubProvider (contra un GitHub simulado)', () => {
  it('lee usuario, repositorios y ramas', async () => {
    expect((await gh.getUser()).login).toBe('luis')
    const repos = await gh.listRepos()
    expect(repos).toHaveLength(1)
    expect(repos[0]).toMatchObject({ fullName: 'luis/casa-nopal', defaultBranch: 'main', canPush: true })
    expect(await gh.listBranches(owner, name)).toContain('main')
    const b = await gh.getBranch(owner, name, 'main')
    expect(b?.sha).toMatch(/^[0-9a-f]{40}$/)
    expect(await gh.getBranch(owner, name, 'no-existe')).toBeNull()
  })

  it('lee el árbol y el contenido de un archivo', async () => {
    const b = (await gh.getBranch(owner, name, 'main'))!
    const { entries } = await gh.getTree(owner, name, b.treeSha)
    const index = entries.find((e) => e.path === 'index.html')!
    expect(index.type).toBe('blob')
    const bytes = await gh.getBlob(owner, name, index.sha)
    expect(new TextDecoder().decode(bytes)).toBe(DEMO_REPO_FILES['index.html'])
    expect(entries.some((e) => e.path === 'css' && e.type === 'tree')).toBe(true)
  })

  it('crea un commit con archivo nuevo, editado y eliminado (también binarios)', async () => {
    const b = (await gh.getBranch(owner, name, 'main'))!
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128])
    const r = await gh.commit(owner, name, {
      branch: 'main',
      parentSha: b.sha,
      baseTreeSha: b.treeSha,
      message: 'Prueba de commit',
      changes: [
        { path: 'nuevo.html', content: '<p>ñandú ✓</p>' },
        { path: 'README.md', content: '# Editado' },
        { path: 'img/foto.png', content: png },
        { path: 'vercel.json', delete: true },
      ],
    })
    expect(r.sha).toMatch(/^[0-9a-f]{40}$/)
    expect(mock.readFile('main', 'nuevo.html')).toBe('<p>ñandú ✓</p>')
    expect(mock.readFile('main', 'README.md')).toBe('# Editado')
    expect(mock.readFile('main', 'vercel.json')).toBeNull()
    expect(mock.readFile('main', 'index.html')).toBe(DEMO_REPO_FILES['index.html']) // lo demás intacto
    const after = (await gh.getBranch(owner, name, 'main'))!
    const { entries } = await gh.getTree(owner, name, after.treeSha)
    const foto = entries.find((e) => e.path === 'img/foto.png')!
    expect(Array.from(await gh.getBlob(owner, name, foto.sha))).toEqual(Array.from(png))
    expect(mock.messages('main')[0]).toBe('Prueba de commit')
  })

  it('avisa con ConflictError si la rama se movió (sin forzar)', async () => {
    const b = (await gh.getBranch(owner, name, 'main'))!
    mock.push('main', { 'otro.txt': 'de alguien más' }, 'Cambio de otra persona')
    await expect(
      gh.commit(owner, name, { branch: 'main', parentSha: b.sha, baseTreeSha: b.treeSha, message: 'x', changes: [{ path: 'a.txt', content: 'a' }] }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('crea y borra ramas, une con la principal y abre pull requests', async () => {
    const b = (await gh.getBranch(owner, name, 'main'))!
    await gh.createBranch(owner, name, 'lienzo/borrador-1', b.sha)
    expect(await gh.listBranches(owner, name)).toContain('lienzo/borrador-1')
    const d = (await gh.getBranch(owner, name, 'lienzo/borrador-1'))! // nombre con diagonal
    await gh.commit(owner, name, {
      branch: 'lienzo/borrador-1',
      parentSha: d.sha,
      baseTreeSha: d.treeSha,
      message: 'En la rama',
      changes: [{ path: 'borrador.txt', content: 'hola' }],
    })
    expect(mock.readFile('lienzo/borrador-1', 'borrador.txt')).toBe('hola')
    expect(mock.readFile('main', 'borrador.txt')).toBeNull()
    const pr = await gh.createPullRequest(owner, name, { title: 'Mi cambio', head: 'lienzo/borrador-1', base: 'main' })
    expect(pr.number).toBe(1)
    expect(pr.url).toContain('/pull/1')
    const merged = await gh.mergeBranch(owner, name, 'main', 'lienzo/borrador-1', 'Publicar borrador')
    expect(merged.merged).toBe(true)
    expect(mock.readFile('main', 'borrador.txt')).toBe('hola')
    expect((await gh.mergeBranch(owner, name, 'main', 'lienzo/borrador-1', 'otra vez')).merged).toBe(false) // ya estaba unida
    await gh.deleteBranch(owner, name, 'lienzo/borrador-1')
    expect(await gh.listBranches(owner, name)).not.toContain('lienzo/borrador-1')
  })

  it('sigue el despliegue de Vercel: pendiente → listo con su dirección', async () => {
    mock.push('main', { 'deploy.txt': '1' }, 'Para desplegar')
    const sha = (await gh.getBranch(owner, name, 'main'))!.sha
    const first = await gh.deploymentStatus(owner, name, sha)
    expect(first.state).toBe('pending')
    await new Promise((r) => setTimeout(r, 1000))
    const later = await gh.deploymentStatus(owner, name, sha)
    expect(later.state).toBe('success')
    expect(later.url).toBe('https://casa-nopal.vercel.app')
    expect(later.environment).toBe('Production')
    expect(await gh.latestProductionUrl(owner, name)).toBe('https://casa-nopal.vercel.app')
  })

  it('traduce los errores de GitHub a mensajes propios', async () => {
    await expect(new GitHubProvider('ghp_mal', mock.url).getUser()).rejects.toBeInstanceOf(AuthError)
    await expect(gh.getRepo(owner, 'otro-repo')).rejects.toBeInstanceOf(NotFoundError)
    mock.setRateLimited(true)
    await expect(gh.getUser()).rejects.toBeInstanceOf(RateLimitError)
    mock.setRateLimited(false)
    await expect(new GitHubProvider(mock.token, 'http://127.0.0.1:1').getUser()).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('Project (copia de trabajo sobre GitHub)', () => {
  it('detecta el sitio, guarda cambios y conserva lo demás', async () => {
    const repo = await gh.getRepo(owner, name)
    const p = await Project.open(gh, repo)
    expect(p.site.pages).toContain('index.html')
    const before = (await p.readText('index.html'))!
    p.writeText('index.html', before.replace('Casa Nopal', 'Casa Nopal 2'))
    p.writeText('contacto.html', '<!DOCTYPE html><title>Contacto</title>')
    expect(p.site.pages).toContain('contacto.html')
    const res = await p.save('Cambios de prueba')
    expect(res.files).toBe(2)
    expect(mock.readFile('main', 'index.html')).toContain('Casa Nopal 2')
    expect(mock.readFile('main', 'contacto.html')).toContain('Contacto')
    expect(p.working.size).toBe(0)
    expect(p.headSha).toBe((await gh.getBranch(owner, name, 'main'))!.sha)
  })

  it('un archivo sin cambios reales no genera commit', async () => {
    const p = await Project.open(gh, await gh.getRepo(owner, name))
    const txt = (await p.readText('index.html'))!
    p.writeText('index.html', txt)
    expect(await p.collectChanges()).toHaveLength(0)
    await expect(p.save('nada')).rejects.toThrow()
  })

  it('si otra persona cambió otro archivo, se publica encima sin pisarlo', async () => {
    const p = await Project.open(gh, await gh.getRepo(owner, name))
    mock.push('main', { 'otro-archivo.txt': 'de otra persona' })
    p.writeText('README.md', '# Mi cambio')
    await p.save('Mi cambio')
    expect(mock.readFile('main', 'README.md')).toBe('# Mi cambio')
    expect(mock.readFile('main', 'otro-archivo.txt')).toBe('de otra persona')
  })

  it('si otra persona cambió el mismo archivo, avisa del conflicto y permite forzar', async () => {
    const p = await Project.open(gh, await gh.getRepo(owner, name))
    mock.push('main', { 'README.md': '# Cambio ajeno' })
    p.writeText('README.md', '# Mi versión')
    const err = await p.save('Mi versión').catch((e) => e)
    expect(err).toBeInstanceOf(ConflictError)
    expect((err as ConflictError).paths).toEqual(['README.md'])
    expect(mock.readFile('main', 'README.md')).toBe('# Cambio ajeno') // no se pisó nada
    await p.save('Mi versión', { overwrite: true })
    expect(mock.readFile('main', 'README.md')).toBe('# Mi versión')
  })

  it('no abre archivos que no están en UTF-8 (para no dañar los acentos) y conserva el BOM de los que sí', async () => {
    const b = (await gh.getBranch(owner, name, 'main'))!
    const latin1 = new Uint8Array([0x3c, 0x70, 0x3e, 0x43, 0x61, 0x66, 0xe9, 0x3c, 0x2f, 0x70, 0x3e]) // <p>Café</p> en ISO-8859-1
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('<p>Hola</p>')])
    await gh.commit(owner, name, {
      branch: 'main',
      parentSha: b.sha,
      baseTreeSha: b.treeSha,
      message: 'Archivos con codificación especial',
      changes: [
        { path: 'latin1.html', content: latin1 },
        { path: 'bom.html', content: bom },
      ],
    })
    const p = await Project.open(gh, await gh.getRepo(owner, name))
    const err = await p.readText('latin1.html').catch((e) => e)
    expect(err).toBeInstanceOf(EncodingError)
    expect((err as Error).message).toContain('latin1.html')
    expect(await p.tryReadText('latin1.html')).toBeNull()
    expect(await p.readText('bom.html')).toBe('<p>Hola</p>') // la marca BOM no se ve como texto
    p.writeText('bom.html', '<p>Hola, mundo</p>')
    await p.save('Editar archivo con BOM')
    const saved = mock.readFile('main', 'bom.html')!
    expect(saved.charCodeAt(0)).toBe(0xfeff) // sigue empezando con BOM
    expect(saved.slice(1)).toBe('<p>Hola, mundo</p>')
  })

  it('crea una rama de trabajo y guarda ahí sin tocar main', async () => {
    const p = await Project.open(gh, await gh.getRepo(owner, name))
    p.writeText('README.md', '# Solo en el borrador')
    await p.startBranch('lienzo/borrador-prueba')
    expect(p.branch).toBe('lienzo/borrador-prueba')
    expect(p.working.size).toBe(1) // los cambios sin guardar se conservan
    await p.save('Borrador')
    expect(mock.readFile('lienzo/borrador-prueba', 'README.md')).toBe('# Solo en el borrador')
    expect(mock.readFile('main', 'README.md')).not.toBe('# Solo en el borrador')
  })
})
