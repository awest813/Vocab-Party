#!/usr/bin/env node
/**
 * Builds the app, serves dist with vite preview, runs a full CPU game via ?autoSim=1,
 * and writes a PNG of the final results screen.
 */
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

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts })
    p.on('error', reject)
    p.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with ${code}`))
    })
  })
}

async function waitForServer(url, maxMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Server not ready: ${url}`)
}

await mkdir(dirname(outPath), { recursive: true })
await run('npm', ['run', 'build'], { cwd: root })

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  stdio: 'pipe'
})

try {
  await waitForServer(base)
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (err) => console.error('pageerror:', err))
  await page.goto(`${base}/?autoSim=1`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForFunction(() => window.__VOCAB_PARTY_RESULTS_READY__ === true, null, {
    timeout: 180000
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: outPath, type: 'png' })
  await browser.close()
  console.log('Wrote', outPath)
} finally {
  preview.kill('SIGTERM')
}
