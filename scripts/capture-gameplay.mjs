#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outPath = join(root, 'docs', 'gameplay-simulated.png')
const port = 4173
const base = `http://127.0.0.1:${port}`

async function waitForServer(url, maxMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch { }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Server not ready: ${url}`)
}

await mkdir(dirname(outPath), { recursive: true })

console.log('Building...')
await new Promise((resolve, reject) => {
  const p = spawn('cmd.exe', ['/c', 'npm.cmd run build'], { cwd: root, stdio: 'inherit' })
  p.on('error', reject)
  p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`npm exited ${code}`)))
})

console.log('Starting preview server...')
let preview
try {
  preview = spawn('cmd.exe', ['/c', `node_modules\\.bin\\vite.cmd preview --host 127.0.0.1 --port ${port}`], {
    cwd: root,
    stdio: 'pipe'
  })
  preview.stdout?.on('data', (d) => process.stdout.write(d))
  preview.stderr?.on('data', (d) => process.stderr.write(d))
} catch (e) {
  console.error('Failed to start preview:', e)
  process.exit(1)
}

console.log('Waiting for server...')
await waitForServer(base)

console.log('Launching browser...')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.error('pageerror:', err))

console.log('Loading game...')
await page.goto(`${base}/?autoSim=1`, { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForFunction(() => window.__VOCAB_PARTY_RESULTS_READY__ === true, null, {
  timeout: 180000
})

console.log('Taking screenshot...')
await page.waitForTimeout(800)
await page.screenshot({ path: outPath, type: 'png' })
await browser.close()
console.log('Wrote', outPath)

if (preview && preview.pid) {
  console.log('Stopping server...')
  try { preview.kill('SIGTERM') } catch { }
}