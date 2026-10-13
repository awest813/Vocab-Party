/**
 * Tunable parameters and helpers for computer-controlled players.
 * Scenes pass Phaser.Math (or compatible) for delays and randomness.
 */

export type CpuLevel = 'easy' | 'normal' | 'hard'

export const DEFAULT_CPU_LEVEL: CpuLevel = 'normal'

/** Display label for setup UI and HUD. */
export const CPU_LEVEL_LABEL: Record<CpuLevel, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard'
}

type CpuLevelProfile = {
  boardQuestionCorrectChance: number
  boardQuestionDelayMsMin: number
  boardQuestionDelayMsMax: number
  rollDelayMsMin: number
  rollDelayMsMax: number
  itemThinkDelayMsMin: number
  itemThinkDelayMsMax: number
  /** 0-1: how likely to buy a shop when affordable */
  shopBuyChance: number
  /** 0-1: how likely to buy a star immediately vs save */
  starBuyThreshold: number
  /** Keep at least this many coins in reserve when shopping (unless endgame) */
  coinReserve: number
  /** Items the CPU will try to buy in priority order at an item shop */
  preferredItems: string[]
  /** Bonus correct chance added per round (scales difficulty as game progresses) */
  roundBonus: number
  /** 0-1: how often the CPU takes the optimally scored choice */
  smartChance: number
  /** How many tiles ahead branch scoring looks */
  branchLookahead: number
}

const CPU_BY_LEVEL: Record<CpuLevel, CpuLevelProfile> = {
  easy: {
    boardQuestionCorrectChance: 0.42,
    boardQuestionDelayMsMin: 1800,
    boardQuestionDelayMsMax: 3200,
    rollDelayMsMin: 700,
    rollDelayMsMax: 1400,
    itemThinkDelayMsMin: 500,
    itemThinkDelayMsMax: 1100,
    shopBuyChance: 0.28,
    starBuyThreshold: 0.35,
    coinReserve: 4,
    preferredItems: ['shield', 'dash', 'double_score', 'warp', 'poison_dart', 'swap', 'golden_key'],
    roundBonus: 0.01,
    smartChance: 0.35,
    branchLookahead: 2
  },
  normal: {
    boardQuestionCorrectChance: 0.55,
    boardQuestionDelayMsMin: 1400,
    boardQuestionDelayMsMax: 2600,
    rollDelayMsMin: 550,
    rollDelayMsMax: 1100,
    itemThinkDelayMsMin: 400,
    itemThinkDelayMsMax: 850,
    shopBuyChance: 0.62,
    starBuyThreshold: 0.62,
    coinReserve: 10,
    preferredItems: ['shield', 'double_score', 'golden_key', 'dash', 'poison_dart', 'swap', 'warp'],
    roundBonus: 0.015,
    smartChance: 0.72,
    branchLookahead: 4
  },
  hard: {
    boardQuestionCorrectChance: 0.76,
    boardQuestionDelayMsMin: 900,
    boardQuestionDelayMsMax: 1700,
    rollDelayMsMin: 350,
    rollDelayMsMax: 750,
    itemThinkDelayMsMin: 280,
    itemThinkDelayMsMax: 600,
    shopBuyChance: 0.88,
    starBuyThreshold: 0.9,
    coinReserve: 16,
    preferredItems: ['double_score', 'shield', 'golden_key', 'dash', 'poison_dart', 'swap', 'warp'],
    roundBonus: 0.02,
    smartChance: 0.94,
    branchLookahead: 6
  }
}

export function cpuPolicyForLevel(level: CpuLevel | undefined): CpuLevelProfile {
  return CPU_BY_LEVEL[level ?? DEFAULT_CPU_LEVEL]
}

/**
 * Returns the effective question correct chance for a CPU at a given round.
 * Caps at 0.95 to keep some challenge.
 */
const ACCURACY_CAP: Record<CpuLevel, number> = { easy: 0.55, normal: 0.75, hard: 0.82 }

/**
 * Effective question accuracy: CPUs warm up a little over the game, based on progress through
 * the party (not raw rounds), and each level has its own ceiling so levels never converge.
 */
export function cpuEffectiveChance(level: CpuLevel | undefined, round: number, totalRounds = 10): number {
  const lv = level ?? DEFAULT_CPU_LEVEL
  const base = cpuPolicyForLevel(lv).boardQuestionCorrectChance
  const progress = Math.min(1, Math.max(0, (round - 1) / Math.max(1, totalRounds - 1)))
  return Math.min(ACCURACY_CAP[lv], base + 0.1 * progress)
}

export type CpuPhaserMath = {
  Between: (min: number, max: number) => number
  FloatBetween: (min: number, max: number) => number
}

export function cpuBoardQuestionResolve(math: CpuPhaserMath, level?: CpuLevel, round?: number, totalRounds?: number) {
  const p = cpuPolicyForLevel(level)
  return {
    delayMs: math.Between(p.boardQuestionDelayMsMin, p.boardQuestionDelayMsMax),
    correctChance: round != null ? cpuEffectiveChance(level, round, totalRounds) : p.boardQuestionCorrectChance
  }
}

export function cpuRollDelayMs(math: CpuPhaserMath, level?: CpuLevel) {
  const p = cpuPolicyForLevel(level)
  return math.Between(p.rollDelayMsMin, p.rollDelayMsMax)
}

export function cpuItemThinkDelayMs(math: CpuPhaserMath, level?: CpuLevel) {
  const p = cpuPolicyForLevel(level)
  return math.Between(p.itemThinkDelayMsMin, p.itemThinkDelayMsMax)
}

/** Minimal player fields the CPU needs for decisions. */
export type CpuRivalView = {
  id: number
  position: number
  coins: number
  score: number
  trophies: number
}

export type CpuSelfView = CpuRivalView & {
  inventory: string[]
  shieldActive?: boolean
}

/** Extra context for item use. */
export type CpuItemContext = Partial<CpuBoardContext> & {
  rivals?: CpuRivalView[]
  shieldActive?: boolean
  doubleScoreActive?: boolean
}

export type CpuBoardContext = {
  tileTypes: string[]
  boardLength: number
  /** Adjacency list: node id → next node ids. Optional; improves branch look-ahead. */
  nextByNode?: number[][]
  round?: number
  totalRounds?: number
  shopPrice?: number
  starCost?: number
}

/** Golden Key forces a roll of exactly 3. */
/** The Golden Key fixes the next roll at 6 (the standard die's max). */
const GOLDEN_KEY_STEPS = 6
const DEFAULT_STAR_COST = 20
const DEFAULT_SHOP_PRICE = 8

/** Rank players: trophies first (win condition), then score. 0 = leader. */
export function cpuPlayerRank(selfId: number, players: CpuRivalView[]): number {
  const sorted = [...players].sort((a, b) => {
    if (b.trophies !== a.trophies) return b.trophies - a.trophies
    return b.score - a.score
  })
  return sorted.findIndex(p => p.id === selfId)
}

export function findStarPositions(tileTypes: string[], boardLength: number): number[] {
  const stars: number[] = []
  for (let i = 1; i < Math.min(boardLength, tileTypes.length); i++) {
    if (tileTypes[i] === 'star') stars.push(i)
  }
  return stars
}

/** Fallback graph for callers without one: a simple ring of `n` nodes. */
function ringGraph(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => [(i + 1) % n])
}

/** Fewest real steps (≥ 1, along the board's edges) from `from` to any node in `targets`. */
export function stepsToNearest(next: number[][], from: number, targets: Set<number>): number {
  if (targets.size === 0) return Infinity
  const seen = new Set<number>([from])
  let frontier = [...(next[from] ?? [])]
  for (let d = 1; frontier.length > 0 && d <= next.length + 1; d++) {
    const nextFrontier: number[] = []
    for (const id of frontier) {
      if (targets.has(id)) return d
      if (seen.has(id)) continue
      seen.add(id)
      nextFrontier.push(...(next[id] ?? []))
    }
    frontier = nextFrontier
  }
  return Infinity
}

/** Every node you can stop on after exactly `k` steps from `from` (any fork choice). */
export function nodesAfterExactly(next: number[][], from: number, k: number): Set<number> {
  let cur = new Set<number>([from])
  for (let i = 0; i < k; i++) {
    const nxt = new Set<number>()
    cur.forEach(id => (next[id] ?? []).forEach(n => nxt.add(n)))
    cur = nxt
  }
  return cur
}

/** Nodes from which `target` is exactly `k` steps away along some path. */
export function nodesExactlyBefore(next: number[][], target: number, k: number): number[] {
  return next.map((_, id) => id).filter(id => id !== target && nodesAfterExactly(next, id, k).has(target))
}

function starSet(tileTypes: string[], boardLength: number): Set<number> {
  return new Set(findStarPositions(tileTypes, boardLength))
}

function endgamePressure(round?: number, totalRounds?: number): number {
  if (round == null || totalRounds == null || totalRounds <= 0) return 0
  return Math.min(1, Math.max(0, (round - 1) / totalRounds))
}

function maybeSmart(level: CpuLevel | undefined): boolean {
  return Math.random() < cpuPolicyForLevel(level).smartChance
}

/**
 * Choose the best item for the CPU to use right before rolling.
 * Returns the index into the inventory array, or -1 to use nothing.
 */
export function cpuChooseItem(
  inventory: string[],
  coins: number,
  score: number,
  position: number,
  trophies: number,
  isLastPlace: boolean,
  rankAmongPlayers: number,
  level?: CpuLevel,
  ctx?: CpuItemContext
): number {
  if (inventory.length === 0) return -1

  const tileTypes = ctx?.tileTypes ?? []
  const boardLength = ctx?.boardLength ?? tileTypes.length
  const next = ctx?.nextByNode ?? ringGraph(boardLength)
  const stars = starSet(tileTypes, boardLength)
  const starCost = ctx?.starCost ?? DEFAULT_STAR_COST
  const canAffordStar = coins >= starCost
  // Real path distance to the nearest star (a star you're standing on doesn't count).
  const starDist = stepsToNearest(next, position, stars)
  // Stars can be bought in passing, so the key pays off when a star is 4–6 steps out: a normal
  // roll might fall short, a guaranteed 6 can't.
  const keyReachesStar = starDist >= 4 && starDist <= GOLDEN_KEY_STEPS
  const nearStar = starDist <= 6
  const behind = rankAmongPlayers > 1 || isLastPlace
  const leading = rankAmongPlayers === 0
  const lowOnCoins = coins < 8
  const pressure = endgamePressure(ctx?.round, ctx?.totalRounds)
  const rivals = ctx?.rivals ?? []
  const leader = [...rivals].sort((a, b) => {
    if (b.trophies !== a.trophies) return b.trophies - a.trophies
    return b.score - a.score
  })[0]
  const richestRival = [...rivals].sort((a, b) => b.coins - a.coins)[0]

  type Scored = { idx: number; score: number }
  const scored: Scored[] = []

  const push = (type: string, value: number) => {
    const idx = inventory.indexOf(type)
    if (idx >= 0 && value > 0) scored.push({ idx, score: value })
  }

  // Golden Key: guaranteed 6 — use it when that's what it takes to reach a star we can afford.
  if (keyReachesStar && canAffordStar) push('golden_key', 110)

  // Shield / Double: pointless while one is already active.
  // A shield only protects once it's raised, so a CPU holding one raises it.
  if (!ctx?.shieldActive) {
    if (lowOnCoins) push('shield', 72)
    else push('shield', 50)
  }
  if (!ctx?.doubleScoreActive) {
    if (trophies >= 3) push('double_score', 85)
    else if (score >= 24 || pressure > 0.65) push('double_score', 70)
    else if (score > 12) push('double_score', 45)
  }

  // Dash (+1–3 steps): useful when a star is just past one die's reach.
  if (starDist >= 6 && starDist <= 9 && canAffordStar) push('dash', 80)
  else if (behind && starDist > 9) push('dash', 62)
  else if (!leading && starDist > 9 && Math.random() < 0.2) push('dash', 28)

  // Swap: last place / far behind — hope for a better tile
  if (isLastPlace && starDist > 8) push('swap', 68)
  else if (behind && starDist > 12) push('swap', 48)

  // Warp: escape dead zones far from stars — only worth it with star money.
  if (!nearStar && starDist > 14 && coins >= starCost - 4) push('warp', 58)
  else if (!nearStar && behind && coins >= starCost - 4) push('warp', 36)

  // Poison: snipe coin leaders / trophy threats
  if (richestRival && richestRival.coins >= 12 && behind) push('poison_dart', 60)
  else if (leader && leader.trophies > trophies && leader.coins >= 8) push('poison_dart', 52)
  else if (behind && Math.random() < 0.35) push('poison_dart', 28)

  if (scored.length === 0) return -1

  scored.sort((a, b) => b.score - a.score)

  // Easy CPUs often dither / pick worse options; hard almost always takes best
  if (!maybeSmart(level)) {
    if (Math.random() < 0.45) return -1
    if (scored.length > 1 && Math.random() < 0.5) {
      return scored[1 + Math.floor(Math.random() * Math.min(2, scored.length - 1))]?.idx ?? scored[0].idx
    }
  }

  return scored[0].idx
}

/**
 * CPU decides whether to buy an unowned shop.
 * Prefers buying when it can still afford a star afterward (hard), or late-game income.
 */
export function cpuShouldBuyShop(
  coins: number,
  level?: CpuLevel,
  ctx?: { trophies?: number; round?: number; totalRounds?: number; ownedShops?: number; shopPrice?: number; starCost?: number }
): boolean {
  const p = cpuPolicyForLevel(level)
  const price = ctx?.shopPrice ?? DEFAULT_SHOP_PRICE
  const starCost = ctx?.starCost ?? DEFAULT_STAR_COST
  if (coins < price) return false

  const after = coins - price
  const pressure = endgamePressure(ctx?.round, ctx?.totalRounds)
  const canStillStar = after >= starCost
  const trophies = ctx?.trophies ?? 0

  // Hard: almost always buy if star still affordable, or if already can't star this visit
  if (level === 'hard') {
    if (canStillStar) return Math.random() < 0.92
    if (trophies >= 4) return after >= 3 && Math.random() < 0.4
    return Math.random() < p.shopBuyChance * (0.7 + pressure * 0.3)
  }

  if (level === 'easy') {
    return Math.random() < p.shopBuyChance
  }

  // Normal: buy more often when income matters / not starving the star fund
  let chance = p.shopBuyChance
  if (canStillStar) chance += 0.15
  else if (coins < starCost) chance += 0.1
  else chance -= 0.2
  if (pressure > 0.75) chance += 0.1
  return Math.random() < Math.min(0.95, Math.max(0.1, chance))
}

/**
 * CPU decides whether to spend coins on a star or save.
 */
export function cpuShouldBuyStar(
  coins: number,
  trophies: number,
  level?: CpuLevel,
  ctx?: { round?: number; totalRounds?: number; rank?: number; starCost?: number }
): boolean {
  const p = cpuPolicyForLevel(level)
  const starCost = ctx?.starCost ?? DEFAULT_STAR_COST
  if (coins < starCost) return false

  // Stars are the win condition and coins have no better use, so CPUs buy them.
  // Easy CPUs occasionally hesitate, which reads as "easy" without looking broken.
  void p
  void trophies
  if (level === 'easy') return Math.random() < 0.8
  return true
}

type BranchGraph = { nextByNode?: number[][]; tileTypes: string[]; boardLength: number }

function tileScore(type: string, coins: number, shopPrice: number, starCost: number): number {
  switch (type) {
    case 'star': return coins >= starCost ? 120 : 55
    case 'shop': return coins >= shopPrice ? 70 : 15
    case 'item_shop': return coins >= 5 ? 65 : 20
    case 'bonus': return 60
    case 'minigame': return 48
    case 'vocab':
    case 'grammar': return 42
    case 'brick': return 38
    case 'mystery': return 30
    case 'swap': return 25
    case 'start': return 20
    case 'penalty': return -55
    default: return 18
  }
}

function lookaheadValue(
  startId: number,
  graph: BranchGraph,
  coins: number,
  depth: number,
  shopPrice: number,
  starCost: number
): number {
  const { tileTypes, boardLength, nextByNode } = graph
  const typeAt = (id: number) => (id === 0 ? 'start' : tileTypes[id] ?? 'vocab')

  // Without graph: score the immediate tile only
  if (!nextByNode || depth <= 0) {
    return tileScore(typeAt(startId), coins, shopPrice, starCost)
  }

  let best = tileScore(typeAt(startId), coins, shopPrice, starCost)
  const queue: { id: number; d: number; value: number }[] = [{ id: startId, d: 0, value: best }]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.d >= depth) {
      best = Math.max(best, cur.value)
      continue
    }
    const nexts = nextByNode[cur.id] ?? []
    if (nexts.length === 0) {
      best = Math.max(best, cur.value)
      continue
    }
    for (const n of nexts) {
      const key = `${n}:${cur.d + 1}`
      if (seen.has(key)) continue
      seen.add(key)
      void boardLength
      const step = tileScore(typeAt(n), coins, shopPrice, starCost) / (cur.d + 2)
      queue.push({ id: n, d: cur.d + 1, value: cur.value + step })
    }
  }
  return best
}

/**
 * CPU chooses the best path when a branch is encountered.
 * Returns the index into `options` to take.
 */
export function cpuChooseBranch(
  position: number,
  options: number[],
  tileTypes: string[],
  coins: number,
  trophies: number,
  level?: CpuLevel,
  ctx?: { nextByNode?: number[][]; boardLength?: number; shopPrice?: number; starCost?: number; stepsLeft?: number }
): number {
  if (options.length === 0) return 0
  if (options.length === 1) return 0

  const p = cpuPolicyForLevel(level)
  const boardLength = ctx?.boardLength ?? tileTypes.length
  const shopPrice = ctx?.shopPrice ?? DEFAULT_SHOP_PRICE
  const starCost = ctx?.starCost ?? DEFAULT_STAR_COST
  const graph: BranchGraph = {
    tileTypes,
    boardLength,
    nextByNode: ctx?.nextByNode
  }

  // Every fork option is exactly one step away, so score purely on what lies ahead.
  // (Index distance is meaningless here: shortcut nodes have high ids on most boards.)
  const next = ctx?.nextByNode
  const stepsLeft = ctx?.stepsLeft
  const scored = options.map((id, index) => {
    let score = lookaheadValue(id, graph, coins, p.branchLookahead, shopPrice, starCost)
    if (next && stepsLeft !== undefined && stepsLeft >= 1) {
      // The tile we'll actually stop on matters most (average over our remaining steps' landing spots).
      const landing = [...nodesAfterExactly(next, id, stepsLeft - 1)]
      if (landing.length > 0) {
        const avg = landing.reduce((sum, n) => sum + tileScore(tileTypes[n] ?? 'vocab', coins, shopPrice, starCost), 0) / landing.length
        score += avg * 2
      }
      // Stars can be bought in passing, so a star anywhere along the next few steps is valuable.
      for (let k = 0; k < stepsLeft; k++) {
        if ([...nodesAfterExactly(next, id, k)].some(n => tileTypes[n] === 'star') && coins >= starCost) score += 60
      }
    }
    // Slight trophy hunger: hard CPUs bias harder toward stars when close to norma
    if (trophies >= 3) {
      if (tileTypes[id] === 'star') score += 25
    }
    return { index, id, score }
  })

  scored.sort((a, b) => b.score - a.score)

  if (!maybeSmart(level)) {
    return Math.floor(Math.random() * options.length)
  }

  // Normal: small chance to take 2nd-best
  if (level !== 'hard' && scored.length > 1 && Math.random() < 0.18) {
    return scored[1].index
  }

  return scored[0].index
}

/**
 * CPU battle choice: returns 'defend' or 'evade' scaled by difficulty.
 */
export function cpuBattleChoice(
  atk: number,
  def: number,
  evd: number,
  level?: CpuLevel,
  attackRoll?: number,
): 'defend' | 'evade' {
  const p = cpuPolicyForLevel(level)
  if (Math.random() >= p.smartChance) return Math.random() > 0.5 ? 'defend' : 'evade'
  if (attackRoll === undefined) {
    const defScore = def + 1
    const evdScore = evd + 1
    if (evdScore === defScore) return Math.random() > 0.5 ? 'defend' : 'evade'
    return evdScore > defScore ? 'evade' : 'defend'
  }
  // Expected damage over the defender's d6 (mirrors BattleScene: attackRoll already includes atk).
  void atk
  let defendDmg = 0
  let evadeDmg = 0
  for (let r = 1; r <= 6; r++) {
    defendDmg += Math.max(1, attackRoll - Math.max(1, r + def))
    evadeDmg += Math.max(1, r + evd) > attackRoll ? 0 : attackRoll
  }
  return evadeDmg < defendDmg ? 'evade' : 'defend'
}

/**
 * Pick a swap target player index (into the full players array).
 * Prefers rivals nearer stars / with more trophies when behind.
 */
export function cpuChooseSwapTarget(
  selfIndex: number,
  players: CpuRivalView[],
  tileTypes: string[],
  boardLength: number,
  level?: CpuLevel,
  nextByNode?: number[][],
): number {
  const others = players
    .map((p, i) => ({ p, i }))
    .filter(x => x.i !== selfIndex)
  if (others.length === 0) return selfIndex

  if (!maybeSmart(level)) {
    return others[Math.floor(Math.random() * others.length)].i
  }

  const next = nextByNode ?? ringGraph(boardLength)
  const stars = starSet(tileTypes, boardLength)
  const self = players[selfIndex]
  const selfStarDist = Math.min(30, stepsToNearest(next, self.position, stars))

  const ranked = others.map(({ p, i }) => {
    const starDist = Math.min(30, stepsToNearest(next, p.position, stars))
    let score = 0
    // Want their spot if a star is closer from there (1–3 steps ahead is ideal for the next roll).
    score += (selfStarDist - starDist) * 8
    if (starDist >= 1 && starDist <= 3) score += 20
    score += p.trophies * 6
    score += p.score * 0.15
    score += p.coins * 0.2
    return { i, score }
  })
  ranked.sort((a, b) => b.score - a.score)
  return ranked[0].i
}

/**
 * Poison dart currently hits a chosen rival immediately.
 * Prefer richest / leading threats.
 */
export function cpuChoosePoisonTarget(
  selfIndex: number,
  players: CpuRivalView[],
  level?: CpuLevel
): number {
  const others = players
    .map((p, i) => ({ p, i }))
    .filter(x => x.i !== selfIndex)
  if (others.length === 0) return (selfIndex + 1) % players.length

  if (!maybeSmart(level)) {
    return others[Math.floor(Math.random() * others.length)].i
  }

  const ranked = others.map(({ p, i }) => {
    const score = p.coins * 2 + p.trophies * 15 + p.score * 0.25
    return { i, score }
  })
  ranked.sort((a, b) => b.score - a.score)
  return ranked[0].i
}

/**
 * Prefer warping near a star (a few tiles before it) rather than pure random.
 */
export function cpuChooseWarpPosition(
  boardLength: number,
  tileTypes: string[],
  level?: CpuLevel,
  nextByNode?: number[][],
): number {
  const stars = findStarPositions(tileTypes, boardLength)
  if (stars.length === 0 || !maybeSmart(level)) {
    return Math.floor(Math.random() * boardLength)
  }
  const next = nextByNode ?? ringGraph(boardLength)
  const star = stars[Math.floor(Math.random() * stars.length)]
  // Land 1–3 real steps before the star (any branch) so the next roll can claim it.
  const back = 1 + Math.floor(Math.random() * 3)
  const spots = nodesExactlyBefore(next, star, back)
  return spots.length > 0 ? spots[Math.floor(Math.random() * spots.length)] : star
}

/**
 * Pick which item to buy at an item shop (by type id), or null to take pity.
 */
export function cpuChooseItemToBuy(
  coins: number,
  inventory: string[],
  catalog: { type: string; cost: number }[],
  level?: CpuLevel,
  ctx?: { trophies?: number; round?: number; totalRounds?: number; starCost?: number }
): { type: string; cost: number } | null {
  const p = cpuPolicyForLevel(level)
  const starCost = ctx?.starCost ?? DEFAULT_STAR_COST
  const pressure = endgamePressure(ctx?.round, ctx?.totalRounds)
  const reserve = pressure > 0.8 || (ctx?.trophies ?? 0) >= 4 ? 0 : p.coinReserve

  const affordable = catalog.filter(item => {
    if (coins < item.cost) return false
    // Keep a reserve so shopping doesn't drain the star fund.
    if (coins - item.cost < reserve) return false
    if (coins >= starCost && coins - item.cost < starCost && pressure > 0.55) {
      // Prefer saving for star in mid/late game unless item is high priority
      const prio = p.preferredItems.indexOf(item.type)
      return prio >= 0 && prio <= 1
    }
    return true
  })

  if (affordable.length === 0) return null

  // Never stack duplicates (a second shield or key just sits in the bag); dashes are cheap enough to double up.
  const pool = affordable.filter(a => !inventory.includes(a.type as never) || a.type === 'dash')
  if (pool.length === 0) return null

  for (const pref of p.preferredItems) {
    const hit = pool.find(a => a.type === pref)
    if (hit) {
      if (maybeSmart(level) || Math.random() < 0.55) return hit
    }
  }

  return pool[Math.floor(Math.random() * pool.length)]
}
