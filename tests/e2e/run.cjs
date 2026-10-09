/**
 * Prueba de extremo a extremo en un navegador real contra un GitHub simulado:
 * inicia sesión con un token, abre el sitio, edita, publica, sigue el despliegue y resuelve un conflicto.
 *
 *   npm run build && npm run test:e2e
 */
const { spawn } = require('node:child_process')
const path = require('node:path')
const http = require('node:http')

const ROOT = path.resolve(__dirname, '..', '..')
const APP = process.env.APP_URL || 'http://localhost:4173'
const MOCK_PORT = Number(process.env.MOCK_PORT || 4010)
const MOCK = `http://127.0.0.1:${MOCK_PORT}`
const STRESS_PORT = MOCK_PORT + 1
const STRESS = `http://127.0.0.1:${STRESS_PORT}`
const TOKEN = 'ghp_testtoken'

const { chromium } = require('playwright')

let failures = 0
const ok = (cond, label, extra = '') => {
  if (cond) console.log(`  ✓ ${label}`)
  else {
    failures++
    console.log(`  ✗ ${label}${extra ? ' → ' + extra : ''}`)
  }
}

function waitFor(url, ms = 20000) {
  const t0 = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (r) => {
          r.resume()
          resolve()
        })
        .on('error', () => (Date.now() - t0 > ms ? reject(new Error('No respondió ' + url)) : setTimeout(tick, 250)))
    }
    tick()
  })
}

async function mockGet(p, base = MOCK) {
  const r = await fetch(base + p)
  return r.ok ? r.text() : null
}
const mockFile = (branch, file, base = MOCK) => mockGet(`/__test/file?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(file)}`, base)

/** Cuántas líneas se agregaron y cuántas se quitaron entre dos versiones de un archivo (sin importar el orden). */
function changedLines(a, b) {
  const left = new Map()
  for (const l of a.split('\n')) left.set(l, (left.get(l) || 0) + 1)
  let added = 0
  for (const l of b.split('\n')) {
    const n = left.get(l) || 0
    if (n > 0) left.set(l, n - 1)
    else added++
  }
  let removed = 0
  for (const n of left.values()) removed += n
  return { added, removed }
}

async function main() {
  const children = []
  const start = (cmd, args, env = {}) => {
    const c = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' })
    children.push(c)
    return c
  }
  try {
    // 1) GitHub simulado
    const mock = start('npx', ['vite-node', 'tests/mock/serve.ts'], { PORT: String(MOCK_PORT), DEPLOY_MS: '3000' })
    await new Promise((resolve, reject) => {
      mock.stdout.on('data', (d) => /MOCK_READY/.test(String(d)) && resolve())
      mock.on('exit', () => reject(new Error('El GitHub simulado se cerró')))
      setTimeout(() => reject(new Error('El GitHub simulado no arrancó')), 30000)
    })
    // 1b) otro GitHub simulado con un sitio de HTML "difícil"
    const stressMock = start('npx', ['vite-node', 'tests/mock/serve.ts'], { PORT: String(STRESS_PORT), SITE: 'stress', DEPLOY_MS: '3000' })
    await new Promise((resolve, reject) => {
      stressMock.stdout.on('data', (d) => /MOCK_READY/.test(String(d)) && resolve())
      stressMock.on('exit', () => reject(new Error('El segundo GitHub simulado se cerró')))
      setTimeout(() => reject(new Error('El segundo GitHub simulado no arrancó')), 30000)
    })
    // 2) la app (si no está ya corriendo)
    const appUp = await waitFor(APP, 800).then(() => true, () => false)
    if (!appUp) {
      start('npx', ['vite', 'preview', '--port', new URL(APP).port || '4173', '--strictPort'])
      await waitFor(APP)
    }

    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
    const newPage = async () => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      page.errors = []
      page.on('pageerror', (e) => page.errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Blocked script execution|Failed to load resource|ERR_/.test(m.text())) page.errors.push(m.text())
      })
      return page
    }
    const fl = (page) => page.frameLocator('iframe.page-frame')
    const login = async (page, api = MOCK) => {
      await page.goto(`${APP}/?debug=1&api=${api}`)
      await page.fill('#token', TOKEN)
      await page.click('.login-form button[type=submit]')
      await page.waitForSelector('.repo-card', { timeout: 15000 })
    }

    // ── A. token incorrecto ────────────────────────────────────────────
    console.log('A. Inicio de sesión')
    {
      const page = await newPage()
      await page.goto(`${APP}/?debug=1&api=${MOCK}`)
      await page.fill('#token', 'ghp_incorrecto')
      await page.click('.login-form button[type=submit]')
      await page.waitForSelector('.login-error')
      ok(/no es válida|venció|inválid/i.test(await page.locator('.login-error').innerText()), 'un token incorrecto muestra un mensaje claro')
      await page.fill('#token', TOKEN)
      await page.click('.login-form button[type=submit]')
      await page.waitForSelector('.repo-card', { timeout: 15000 })
      ok((await page.locator('.repo-card').count()) === 1, 'con el token correcto aparece el repositorio')
      ok(/casa-nopal/.test(await page.locator('.repo-card').innerText()), 'el repositorio se llama casa-nopal')
      await page.reload()
      await page.waitForSelector('.repo-card', { timeout: 15000 })
      ok(true, 'la sesión se conserva al recargar la página')
      await page.context().close()
    }

    // ── B. editar y publicar ───────────────────────────────────────────
    console.log('B. Editar y publicar')
    const original = await mockFile('main', 'index.html')
    {
      const page = await newPage()
      await login(page)
      await page.click('.repo-card')
      await page.waitForFunction(() => window.__lienzo && window.__lienzo.engine.loaded, null, { timeout: 20000 })
      ok((await fl(page).locator('h1').first().innerText()).includes('El pan de la esquina'), 'la página se abre desde GitHub con su contenido')
      ok(await fl(page).locator('img.portada-imagen').evaluate((i) => i.complete && i.naturalWidth > 0), 'las imágenes del repositorio se ven en el lienzo')

      await fl(page).locator('h1').first().dblclick()
      await page.keyboard.press('Control+a')
      await page.keyboard.type('Pan recién horneado')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await page.click('.rail-btn:has-text("Sitio")')
      await page.waitForSelector('input[aria-label="Color Rosa"]')
      await page.locator('input[aria-label="Color Rosa"]').fill('#2255cc')
      await page.waitForTimeout(500)

      await page.click('.tb-right .btn.primary')
      await page.waitForSelector('.modal .changes ul li')
      const listed = (await page.locator('.changes li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
      ok(listed.length === 2 && listed.some((t) => /index\.html/.test(t)) && listed.some((t) => /estilos\.css/.test(t)), 'el resumen lista solo los 2 archivos modificados', listed.join(' | '))
      await page.fill('#commit-msg', 'Nuevo título y color')
      await page.click('.modal-foot .btn.primary')
      await page.waitForSelector('.done-box', { timeout: 20000 })
      ok(true, 'la publicación termina con éxito')

      const published = await mockFile('main', 'index.html')
      ok(published.includes('<h1>Pan recién horneado</h1>'), 'GitHub recibió el título nuevo')
      const diffLines = published.split('\n').filter((l, i) => l !== original.split('\n')[i]).length
      ok(diffLines <= 2, 'el commit cambió solo las líneas editadas, no reformateó el archivo', `${diffLines} líneas distintas`)
      ok(/--rosa:\s*#2255cc/.test(await mockFile('main', 'css/estilos.css')), 'GitHub recibió el nuevo color en el CSS')
      const mockMsgs = await mockGet('/__test/branches')
      ok(!!mockMsgs, 'el GitHub simulado respondió')

      await page.click('.modal-foot .btn.primary')
      const chip1 = (await page.locator('.tb-right .chip').first().innerText()).trim()
      ok(/Desplegando|Vercel/i.test(chip1), 'el estado de Vercel aparece como "desplegando"', chip1)
      await page.waitForFunction(() => /Publicado/i.test(document.querySelector('.tb-right .chip')?.textContent || ''), null, { timeout: 25000 })
      ok(true, 'el estado de Vercel pasa a "Publicado"')
      ok(page.errors.length === 0, 'sin errores en la consola', page.errors.join(' | '))
      await page.context().close()
    }

    // ── C. conflicto con otra persona ──────────────────────────────────
    console.log('C. Conflicto con cambios de otra persona')
    {
      const page = await newPage()
      await login(page)
      await page.click('.repo-card')
      await page.waitForFunction(() => window.__lienzo && window.__lienzo.engine.loaded, null, { timeout: 20000 })
      await fl(page).locator('h1').first().dblclick()
      await page.keyboard.press('Control+a')
      await page.keyboard.type('Mi título')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      const cur = await mockFile('main', 'index.html')
      await fetch(MOCK + '/__test/push', {
        method: 'POST',
        body: JSON.stringify({ branch: 'main', files: { 'index.html': cur.replace('</footer>', '<p>Otra persona</p></footer>') }, message: 'Cambio de otra persona' }),
      })
      await page.click('.tb-right .btn.primary')
      await page.waitForSelector('.modal .changes ul li')
      await page.click('.modal-foot .btn.primary')
      await page.waitForSelector('.conflict-files', { timeout: 20000 })
      ok(/index\.html/.test(await page.locator('.conflict-files').innerText()), 'se avisa que index.html cambió en GitHub')
      ok((await mockFile('main', 'index.html')).includes('Otra persona') && !(await mockFile('main', 'index.html')).includes('Mi título'), 'no se pisó el trabajo de la otra persona')
      await page.locator('.option', { hasText: 'rama aparte' }).click()
      await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 20000 })
      const branches = JSON.parse(await mockGet('/__test/branches'))
      const draft = branches.find((b) => b.startsWith('lienzo/'))
      ok(!!draft, 'se creó una rama de borrador', branches.join(','))
      ok(draft && (await mockFile(draft, 'index.html')).includes('Mi título'), 'tus cambios quedaron guardados en esa rama')
      ok((await mockFile('main', 'index.html')).includes('Otra persona'), 'la rama principal sigue con lo de la otra persona')
      ok(page.errors.length === 0, 'sin errores en la consola', page.errors.join(' | '))
      await page.context().close()
    }


    // ── D. sitio con HTML desordenado ──────────────────────────────────
    console.log('D. Sitio con HTML desordenado (CRLF, etiquetas sin cerrar, subcarpetas, srcset, fondos en CSS)')
    {
      const page = await newPage()
      const stray = []
      page.on('request', (r) => {
        const u = r.url()
        if (u.startsWith(APP + '/') && !u.includes('/assets/') && !/^[^?]*\/[0-9a-f-]{36}$/.test(u) && u !== APP + '/' && !u.startsWith(APP + '/?')) stray.push(u)
      })
      await login(page, STRESS)
      await page.click('.repo-card')
      await page.waitForFunction(() => window.__lienzo && window.__lienzo.engine.loaded, null, { timeout: 20000 })
      await page.waitForTimeout(600)
      const pagesList = await page.evaluate(() => window.__lienzo.project.site.pages)
      ok(pagesList.length === 3 && pagesList.includes('about/index.html'), 'se detectan las 3 páginas, también la de la subcarpeta', pagesList.join(','))

      // cada página se abre completa y fiel a su archivo
      for (const path of pagesList) {
        const res = await page.evaluate(async (path) => {
          const L = window.__lienzo
          await L.controller.openPage(path)
          await new Promise((r) => setTimeout(r, 600))
          const orig = await L.project.readText(path)
          const doc = L.engine.doc
          const loadable = Array.from(doc.querySelectorAll('img,source,video,link[rel~=stylesheet]')).filter((e) => !e.closest('noscript'))
          const unresolved = loadable.filter((e) => /^(?!blob:|data:|https?:|\/\/|#)/i.test(e.getAttribute('src') || e.getAttribute('href') || e.getAttribute('poster') || 'blob:')).length
          const broken = Array.from(doc.querySelectorAll('img')).filter((i) => !i.closest('noscript') && !(i.complete && i.naturalWidth > 0)).length
          return { same: L.lib.normalizeHtml(orig) === L.engine.serialize(), unresolved, broken }
        }, path)
        ok(res.same, `${path}: lo que muestra el editor coincide con el archivo`)
        ok(res.unresolved === 0 && res.broken === 0, `${path}: todas sus imágenes y hojas de estilo cargan`, JSON.stringify(res))
      }
      const heroBg = await page.evaluate(async () => {
        const L = window.__lienzo
        await L.controller.openPage('index.html')
        await new Promise((r) => setTimeout(r, 600))
        const win = L.engine.win
        return {
          hero: win.getComputedStyle(L.engine.doc.querySelector('.hero')).backgroundImage.slice(0, 9),
          imported: Array.from(L.engine.doc.styleSheets).some((s) => Array.from(s.cssRules).some((r) => r.styleSheet && r.styleSheet.cssRules.length > 0)),
        }
      })
      ok(heroBg.hero === 'url("blob', 'el fondo escrito en style="background-image:url(…)" se ve')
      ok(heroBg.imported, 'el CSS con @import se carga completo')

      // ediciones
      const original = await mockFile('main', 'index.html', STRESS)
      const originalAbout = await mockFile('main', 'about/index.html', STRESS)
      ok(original.includes('\r\n'), 'el index.html del repositorio usa finales de línea de Windows')
      const fr = page.frameLocator('iframe.page-frame')
      const p1 = fr.locator('.hero p').first()
      await p1.scrollIntoViewIfNeeded()
      await p1.dblclick()
      await page.keyboard.press('Control+a')
      await page.keyboard.type('Piezas de barro negro, hechas a mano en Oaxaca.')
      await page.keyboard.press('Escape')
      const td = fr.locator('.precios td').first()
      await td.scrollIntoViewIfNeeded()
      await td.dblclick()
      await page.keyboard.press('Control+a')
      await page.keyboard.type('Taza chica')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await page.evaluate(() => {
        const L = window.__lienzo
        L.engine.select(L.engine.doc.querySelector('img[srcset]'))
      })
      await page.click('.inspector [role=tab]:has-text("Contenido")')
      await page.locator('textarea[aria-label="Descripción (texto alternativo)"]').fill('Taza de barro negro con acabado pulido')
      await page.evaluate(() => {
        const L = window.__lienzo
        L.engine.ops.remove(Array.from(L.engine.doc.querySelectorAll('li')).find((x) => x.textContent.includes('Macetas')))
      })
      // copiar una imagen y pegarla: tiene que verse y no pedir nada al servidor del editor
      stray.length = 0
      const pasted = await page.evaluate(async () => {
        const L = window.__lienzo
        const pic = L.engine.doc.querySelector('picture')
        L.engine.copy(pic)
        const made = L.engine.paste(pic)
        await new Promise((r) => setTimeout(r, 800))
        return made.length === 1 && Array.from(made[0].querySelectorAll('img')).every((i) => i.complete && i.naturalWidth > 0)
      })
      ok(pasted, 'una imagen copiada y pegada se ve en el lienzo')
      ok(stray.length === 0, 'pegar no hace peticiones de archivos al servidor del editor', stray.join(', '))

      // pegar en una página de otra carpeta: las rutas se ajustan
      await page.evaluate(async () => {
        await window.__lienzo.controller.openPage('about/index.html')
        await new Promise((r) => setTimeout(r, 600))
      })
      const cross = await page.evaluate(async () => {
        const L = window.__lienzo
        const made = L.engine.paste(L.engine.doc.querySelector('main > section:last-child').firstElementChild)
        await new Promise((r) => setTimeout(r, 800))
        return { shows: Array.from(made[0].querySelectorAll('img')).every((i) => i.complete && i.naturalWidth > 0), html: L.engine.ops.cleanHtmlOf(made[0]) }
      })
      ok(cross.shows && cross.html.includes('src="../img/jarra.svg"') && cross.html.includes('srcset="../img/jarra.svg 1x, ../img/jarra@2x.svg 2x"'), 'al pegar en otra carpeta las rutas se ajustan y la imagen se ve', cross.html)
      const h1 = fr.locator('h1').first()
      await h1.dblclick()
      await page.keyboard.press('Control+a')
      await page.keyboard.type('Quiénes somos')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // publicar
      await page.click('.tb-right .btn.primary')
      await page.waitForSelector('.modal .changes ul li')
      const changed = (await page.locator('.changes li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
      ok(changed.length === 2, 'el resumen lista solo las 2 páginas modificadas', changed.join(' | '))
      await page.fill('#commit-msg', 'Prueba con sitio difícil')
      await page.click('.modal-foot .btn.primary')
      await page.waitForSelector('.done-box', { timeout: 20000 })
      const pubIndex = await mockFile('main', 'index.html', STRESS)
      const pubAbout = await mockFile('main', 'about/index.html', STRESS)
      ok(pubIndex.split('\n').every((l, i, a) => i === a.length - 1 || l.endsWith('\r')), 'index.html conserva los finales de línea de Windows en todas sus líneas')
      ok(
        pubIndex.includes("<HTML lang='es'>") && pubIndex.includes('<BODY class=home>') && pubIndex.includes("<img src='img/logo.svg' alt='Logo' width=48 height=48>") && pubIndex.includes('<li>Vajillas por encargo\r\n  <li>Talleres de torno'),
        'el resto del código (mayúsculas, comillas simples, etiquetas sin cerrar) queda exactamente igual',
      )
      ok(pubIndex.includes('Oaxaca.\r\n  <p class="nota">Pedidos con 15'), 'al editar el párrafo sin cerrar se conserva el salto de línea que lo seguía')
      ok(pubIndex.includes('Taza de barro negro con acabado pulido') && pubIndex.includes('<td>Taza chica<td>$180 MXN') && !pubIndex.includes('Macetas y floreros'), 'GitHub recibió el alt, la celda editada y el elemento borrado')
      ok(!/blob:|data-lz-|contenteditable/.test(pubIndex + pubAbout), 'no se coló nada del editor en los archivos publicados')
      const dI = changedLines(original, pubIndex)
      const dA = changedLines(originalAbout, pubAbout)
      ok(dI.added <= 12 && dI.removed <= 6, 'index.html: el commit toca solo las líneas editadas', JSON.stringify(dI))
      ok(dA.added <= 6 && dA.removed <= 3, 'about/index.html: el commit toca solo las líneas editadas', JSON.stringify(dA))
      ok(pubAbout.includes('<img src="../img/jarra.svg" alt="Jarra"><picture>') || pubAbout.includes('srcset="../img/jarra.svg 1x, ../img/jarra@2x.svg 2x"'), 'lo pegado en about/ se publicó con rutas "../"')
      const again = await page.evaluate(async () => {
        const L = window.__lienzo
        await L.controller.openPage('index.html')
        await new Promise((r) => setTimeout(r, 600))
        return L.lib.normalizeHtml(await L.project.readText('index.html')) === L.engine.serialize()
      })
      ok(again, 'al volver a abrir lo publicado, el editor muestra exactamente lo que hay en el archivo')
      ok(page.errors.length === 0, 'sin errores en la consola', page.errors.join(' | '))
      await page.context().close()
    }

    await browser.close()
  } finally {
    for (const c of children) {
      try {
        if (process.platform === 'win32') c.kill()
        else process.kill(-c.pid, 'SIGTERM')
      } catch {
        /* ya había terminado */
      }
    }
  }
  console.log(failures ? `\n${failures} comprobación(es) fallaron` : '\nTodo en orden ✔')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error('FALLÓ la prueba:', e)
  process.exit(2)
})
