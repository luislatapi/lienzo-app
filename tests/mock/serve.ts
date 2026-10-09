/** Arranca el GitHub de mentira con el sitio de ejemplo: `npx vite-node tests/mock/serve.ts` */
import { STRESS_FILES } from '../fixtures/stress-site'
import { DEMO_REPO_FILES } from '../../src/lib/git/demo-site'
import { startMockGitHub } from './github-server'

const port = Number(process.env.PORT || 4010)
const files = process.env.SITE === 'stress' ? STRESS_FILES : DEMO_REPO_FILES
const mock = await startMockGitHub({ files, repo: process.env.SITE === 'stress' ? 'taller-tlacuache' : 'casa-nopal', deployMs: Number(process.env.DEPLOY_MS || 3000) }, port)

// pequeña API para que las pruebas del navegador puedan inspeccionar y simular cambios externos
console.log(`MOCK_READY ${mock.url} token=${mock.token}`)
process.on('SIGTERM', () => mock.close().then(() => process.exit(0)))
