#!/usr/bin/env node
/**
 * Headless playthrough runner — Classic + Full Map across several rounds.
 * Usage: node scripts/run-playthroughs.mjs [baseUrl]
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'docs', 'playthroughs')
const base = process.argv[2] || 'http://127.0.0.1:4174'

/** Classic + Full Map across player counts (each slot = different character class). */
const RUNS = [
  // Classic map — vary rounds & party size
  { name: 'classic-1p-6', query: 'autoSim=1&rounds=6&players=1', midShotAtMs: 4000 },
  { name: 'classic-2p-8', query: 'autoSim=1&rounds=8&players=2', midShotAtMs: 6000 },
  { name: 'classic-3p-7', query: 'autoSim=1&rounds=7&players=3', midShotAtMs: 6000 },
  { name: 'classic-4p-5', query: 'autoSim=1&rounds=5&players=4', midShotAtMs: 5000 },
  { name: 'classic-4p-10', query: 'autoSim=1&rounds=10&players=4', midShotAtMs: 8000 },
  // Full map — longer track, mix of party sizes
  { name: 'fullmap-1p-10', query: 'autoSim=1&fullMap=1&rounds=10&players=1', midShotAtMs: 5000 },
  { name: 'fullmap-2p-12', query: 'autoSim=1&fullMap=1&rounds=12&players=2', midShotAtMs: 7000 },
  { name: 'fullmap-3p-9', query: 'autoSim=1&fullMap=1&rounds=9&players=3', midShotAtMs: 7000 },
  { name: 'fullmap-4p-8', query: 'autoSim=1&fullMap=1&rounds=8&players=4', midShotAtMs: 7000 },
]

async function waitReady(url, maxMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Server not ready: ${url}`)
}

await mkdir(outDir, { recursive: true })
await waitReady(base)

const browser = await chromium.launch()
const summary = []

for (const run of RUNS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message || e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })

  const url = `${base}/?${run.query}`
  console.log(`\n▶ ${run.name}: ${url}`)
  const t0 = Date.now()

  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 })

  // Mid-game board shot
  await page.waitForTimeout(run.midShotAtMs)
  const midPath = join(outDir, `${run.name}-mid.png`)
  await page.screenshot({ path: midPath, type: 'png' })
  console.log(`  mid → ${midPath}`)

  // Wait for results
  try {
    await page.waitForFunction(() => window.__VOCAB_PARTY_RESULTS_READY__ === true, null, {
      timeout: 300000,
    })
  } catch (e) {
    errors.push(`timeout waiting for results: ${e}`)
  }

  await page.waitForTimeout(600)
  const resultsPath = join(outDir, `${run.name}-results.png`)
  await page.screenshot({ path: resultsPath, type: 'png' })
  console.log(`  results → ${resultsPath}`)

  const elapsed = Date.now() - t0
  let winner = null
  try {
    winner = await page.evaluate(() => {
      // Phaser text isn't in DOM; expose via flag if present
      return window.__VOCAB_PARTY_WINNER__ ?? null
    })
  } catch { /* ignore */ }

  const entry = {
    name: run.name,
    query: run.query,
    players: Number(new URLSearchParams(run.query).get('players') || 4),
    fullMap: run.query.includes('fullMap=1'),
    rounds: Number(new URLSearchParams(run.query).get('rounds') || 0),
    elapsedMs: elapsed,
    reachedResults: errors.every((e) => !String(e).includes('timeout waiting')),
    winner,
    errors,
  }
  summary.push(entry)
  console.log(`  done in ${(elapsed / 1000).toFixed(1)}s — errors: ${errors.length}`)

  await page.close()
}

await browser.close()

const summaryPath = join(outDir, 'summary.json')
await import('node:fs/promises').then(({ writeFile }) =>
  writeFile(summaryPath, JSON.stringify(summary, null, 2))
)
console.log(`\nWrote ${summaryPath}`)

const failed = summary.filter((s) => !s.reachedResults || s.errors.length > 0)
if (failed.length) {
  console.error('\nSome runs had issues:')
  for (const f of failed) console.error(` - ${f.name}:`, f.errors)
  process.exitCode = 1
} else {
  console.log('\nAll playthroughs completed cleanly.')
}
