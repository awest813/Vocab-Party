#!/usr/bin/env node
/**
 * Static balance check for every board in src/systems/BoardLayout.ts.
 * Usage: node scripts/check-boards.mjs   (Node 22.18+ strips TypeScript types natively)
 *
 * For each board, and for each tide phase on boards with a tide event:
 *  - every (dry) node is reachable from Start, and every node can get back to Start
 *  - no edge links two identical special tiles (vocab/grammar runs are fine)
 *  - stars are spread out: no two stars within 4 steps, and no node more than 18 steps from a star
 *  - no more than 4 plain question tiles in a row
 *  - tile mix stays close to the average of the other boards
 */
import { BOARDS, BOARD_COLS, BOARD_ROWS, resolveNodes, resolveTiles, isSubmerged } from '../src/systems/BoardLayout.ts'

const QUESTION_TILES = new Set(['vocab', 'grammar'])
let failures = 0
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`) }

function bfs(next, from) {
  const dist = new Map([[from, 0]])
  const q = [from]
  while (q.length) {
    const cur = q.shift()
    for (const n of next[cur] ?? []) {
      if (!dist.has(n)) { dist.set(n, dist.get(cur) + 1); q.push(n) }
    }
  }
  return dist
}

function share(board) {
  const c = {}
  board.tiles.forEach(t => { c[t] = (c[t] ?? 0) + 1 })
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / board.tiles.length]))
}

for (const board of BOARDS) {
  console.log(`\n${board.emoji} ${board.name} (${board.id}) — ${board.nodes.length} nodes`)
  if (board.tiles.length !== board.nodes.length) fail(`tiles ${board.tiles.length} ≠ nodes ${board.nodes.length}`)
  if (board.tiles[0] !== 'start') fail('tile 0 is not start')
  const cells = new Set()
  board.nodes.forEach((n, i) => {
    if (n.id !== i) fail(`node index ${i} has id ${n.id}`)
    if (n.col < 0 || n.col >= BOARD_COLS || n.row < 0 || n.row >= BOARD_ROWS) fail(`node ${i} off-grid`)
    const key = `${n.col},${n.row}`
    if (cells.has(key)) fail(`node ${i} shares cell ${key}`)
    cells.add(key)
  })

  const phases = board.event ? ['high', 'low'] : [undefined]
  for (const tide of phases) {
    const label = tide ? `[${tide} tide] ` : ''
    const nodes = resolveNodes(board, tide)
    const tiles = resolveTiles(board, tide)
    const next = nodes.map(n => n.next)
    const dry = nodes.map(n => n.id).filter(i => !isSubmerged(board, tide, i))

    // Reachability from Start (submerged nodes must be unreachable at high tide).
    const fromStart = bfs(next, 0)
    for (const i of dry) if (!fromStart.has(i)) fail(`${label}node ${i} unreachable from Start`)
    for (const i of nodes.map(n => n.id)) {
      if (isSubmerged(board, tide, i) && fromStart.has(i)) fail(`${label}submerged node ${i} is reachable`)
      if (!bfs(next, i).has(0)) fail(`${label}node ${i} has no path back to Start`)
    }

    // Back-to-back duplicates of special tiles.
    nodes.forEach(n => n.next.forEach(t => {
      if (tiles[n.id] === tiles[t] && !QUESTION_TILES.has(tiles[t])) fail(`${label}duplicate ${tiles[t]} on edge ${n.id}→${t}`)
    }))

    // Star spread.
    const stars = tiles.map((t, i) => (t === 'star' ? i : -1)).filter(i => i >= 0 && !isSubmerged(board, tide, i))
    let worst = 0
    for (const i of dry) {
      const d = bfs(next, i)
      const toStar = Math.min(...stars.filter(s => s !== i).map(s => d.get(s) ?? Infinity))
      worst = Math.max(worst, toStar)
    }
    let closest = Infinity
    for (const a of stars) for (const b of stars) if (a !== b) closest = Math.min(closest, bfs(next, a).get(b) ?? Infinity)
    console.log(`  ${label}stars at ${stars.join(', ')} · closest pair ${closest} steps · worst node→star ${worst} steps`)
    if (closest < 5) fail(`${label}stars clustered (two within ${closest} steps)`)
    if (worst > 18) fail(`${label}a node is ${worst} steps from the nearest star`)

    // Longest run without any special tile.
    let longest = 0
    for (const i of dry) {
      let run = 0, cur = i
      while (QUESTION_TILES.has(tiles[cur]) && run < 99) { run++; cur = next[cur][0] }
      longest = Math.max(longest, run)
    }
    if (longest > 4) fail(`${label}${longest} question tiles in a row`)
  }

  // Tile mix vs. the other boards' average share.
  const others = BOARDS.filter(b => b.id !== board.id).map(share)
  const mine = share(board)
  const types = new Set([...Object.keys(mine), ...others.flatMap(o => Object.keys(o))])
  const rows = []
  for (const t of types) {
    const avg = others.reduce((s, o) => s + (o[t] ?? 0), 0) / others.length
    const m = mine[t] ?? 0
    rows.push(`${t} ${Math.round(m * board.tiles.length)} (${(m * 100).toFixed(0)}% vs ${(avg * 100).toFixed(0)}%)`)
    if (Math.abs(m - avg) > 0.05) fail(`${t} share ${(m * 100).toFixed(0)}% is far from the ${(avg * 100).toFixed(0)}% average`)
  }
  console.log(`  mix: ${rows.join(' · ')}`)
}

console.log(failures === 0 ? '\n✓ All boards pass.' : `\n✗ ${failures} problem(s).`)
process.exit(failures === 0 ? 0 : 1)
