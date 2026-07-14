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
  minigameGuessCorrectChance: number
  minigameMaxGuessAttempts: number
  minigameThinkDelayMsMin: number
  minigameThinkDelayMsMax: number
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
    boardQuestionCorrectChance: 0.38,
    boardQuestionDelayMsMin: 1800,
    boardQuestionDelayMsMax: 3200,
    rollDelayMsMin: 700,
    rollDelayMsMax: 1400,
    itemThinkDelayMsMin: 500,
    itemThinkDelayMsMax: 1100,
    minigameGuessCorrectChance: 0.42,
    minigameMaxGuessAttempts: 14,
    minigameThinkDelayMsMin: 280,
    minigameThinkDelayMsMax: 560,
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
    minigameGuessCorrectChance: 0.58,
    minigameMaxGuessAttempts: 18,
    minigameThinkDelayMsMin: 220,
    minigameThinkDelayMsMax: 480,
    shopBuyChance: 0.62,
    starBuyThreshold: 0.62,
    coinReserve: 10,
    preferredItems: ['shield', 'double_score', 'dash', 'golden_key', 'poison_dart', 'swap', 'warp'],
    roundBonus: 0.015,
    smartChance: 0.72,
    branchLookahead: 4
  },
  hard: {
    boardQuestionCorrectChance: 0.78,
    boardQuestionDelayMsMin: 900,
    boardQuestionDelayMsMax: 1700,
    rollDelayMsMin: 350,
    rollDelayMsMax: 750,
    itemThinkDelayMsMin: 280,
    itemThinkDelayMsMax: 600,
    minigameGuessCorrectChance: 0.74,
    minigameMaxGuessAttempts: 24,
    minigameThinkDelayMsMin: 140,
    minigameThinkDelayMsMax: 320,
    shopBuyChance: 0.88,
    starBuyThreshold: 0.9,
    coinReserve: 16,
    preferredItems: ['golden_key', 'double_score', 'shield', 'dash', 'poison_dart', 'swap', 'warp'],
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
export function cpuEffectiveChance(level: CpuLevel | undefined, round: number): number {
  const base = cpuPolicyForLevel(level).boardQuestionCorrectChance
  const bonus = cpuPolicyForLevel(level).roundBonus * (round - 1)
  return Math.min(0.95, base + bonus)
}

export type CpuPhaserMath = {
  Between: (min: number, max: number) => number
  FloatBetween: (min: number, max: number) => number
}

export function cpuBoardQuestionResolve(math: CpuPhaserMath, level?: CpuLevel, round?: number) {
  const p = cpuPolicyForLevel(level)
  return {
    delayMs: math.Between(p.boardQuestionDelayMsMin, p.boardQuestionDelayMsMax),
    correctChance: round != null ? cpuEffectiveChance(level, round) : p.boardQuestionCorrectChance
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

/**
 * Simulates CPU playing a single-answer minigame (wrong answers can be retried).
 * Returns whether the current player won and total simulated "thinking" delay.
 */
export function simulateCpuMinigameGuesses(
  math: CpuPhaserMath,
  level?: CpuLevel
): { currentPlayerWins: boolean; totalDelayMs: number } {
  const p = cpuPolicyForLevel(level)
  let totalDelayMs = 0
  for (let a = 0; a < p.minigameMaxGuessAttempts; a++) {
    totalDelayMs += math.Between(p.minigameThinkDelayMsMin, p.minigameThinkDelayMsMax)
    if (math.FloatBetween(0, 1) < p.minigameGuessCorrectChance) {
      return { currentPlayerWins: true, totalDelayMs }
    }
  }
  return { currentPlayerWins: false, totalDelayMs }
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

const GOLDEN_KEY_STEPS = 5
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
  for (let i = 0; i < boardLength; i++) {
    if (i === 0) continue
    const type = tileTypes[i % tileTypes.length]
    if (type === 'star') stars.push(i)
  }
  return stars
}

function forwardDistance(from: number, to: number, boardLength: number): number {
  if (to === from) return 0
  return to > from ? to - from : boardLength - from + to
}

function nearestStarDistance(position: number, stars: number[], boardLength: number): number {
  if (stars.length === 0) return boardLength
  return Math.min(...stars.map(s => forwardDistance(position, s, boardLength)))
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
  ctx?: Partial<CpuBoardContext> & { rivals?: CpuRivalView[] }
): number {
  if (inventory.length === 0) return -1

  const tileTypes = ctx?.tileTypes
  const boardLength = ctx?.boardLength ?? 44
  const stars = tileTypes ? findStarPositions(tileTypes, boardLength) : [5, 20, 38]
  const starDist = nearestStarDistance(position, stars, boardLength)
  const keyReach = starDist > 0 && starDist <= GOLDEN_KEY_STEPS
  const nearStar = starDist > 0 && starDist <= 6
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

  // Golden Key: exactly 5 steps — only when that lands on / past a star window
  if (keyReach) push('golden_key', 100 + (leading ? 5 : 10))
  else if (nearStar && starDist === 4) push('golden_key', 40) // sometimes still useful with branches

  // Shield: protect thin wallets / endgame / owned-shop danger
  if (lowOnCoins) push('shield', 72)
  else if (pressure > 0.7 && coins < 14) push('shield', 55)
  else if (coins < 12 && Math.random() < 0.25) push('shield', 30)

  // Double Score: prioritize when already scoring well or late game
  if (trophies >= 3) push('double_score', 85)
  else if (score >= 24 || pressure > 0.65) push('double_score', 70)
  else if (score > 12) push('double_score', 45)

  // Dash: more movement when chasing stars or catching up
  if (behind && nearStar) push('dash', 78)
  else if (behind) push('dash', 62)
  else if (nearStar && starDist > 3) push('dash', 55)
  else if (!leading && Math.random() < 0.2) push('dash', 28)

  // Swap: last place / far behind — hope for a better tile
  if (isLastPlace && starDist > 8) push('swap', 68)
  else if (behind && starDist > 12) push('swap', 48)

  // Warp: escape dead zones far from stars
  if (!nearStar && starDist > 14) push('warp', 58)
  else if (!nearStar && behind) push('warp', 36)

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

  const pressure = endgamePressure(ctx?.round, ctx?.totalRounds)
  const rank = ctx?.rank ?? 1

  // Always buy when one star from norma win, or final stretch
  if (trophies >= 4) return true
  if (pressure >= 0.85) return true
  if (level === 'hard' && rank === 0) return Math.random() < 0.97
  if (level === 'hard') return Math.random() < Math.min(0.98, p.starBuyThreshold + pressure * 0.25)

  let chance = p.starBuyThreshold + pressure * 0.2
  if (rank === 0) chance += 0.12
  if (rank >= 2) chance += 0.08
  if (level === 'easy' && Math.random() < 0.2) return false
  return Math.random() < Math.min(0.95, chance)
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
  const typeAt = (id: number) => (id === 0 ? 'start' : tileTypes[id % tileTypes.length] ?? 'vocab')

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
      const step = tileScore(typeAt(n % boardLength), coins, shopPrice, starCost) / (cur.d + 2)
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
  ctx?: { nextByNode?: number[][]; boardLength?: number; shopPrice?: number; starCost?: number }
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

  const scored = options.map((id, index) => {
    const dist = forwardDistance(position, id, boardLength)
    let score = lookaheadValue(id, graph, coins, p.branchLookahead, shopPrice, starCost)
    score -= dist * 2
    // Slight trophy hunger: hard CPUs bias harder toward stars when close to norma
    if (trophies >= 3) {
      const t = id === 0 ? 'start' : tileTypes[id % tileTypes.length]
      if (t === 'star') score += 25
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
  level?: CpuLevel
): 'defend' | 'evade' {
  const p = cpuPolicyForLevel(level)
  const defScore = def + 1
  const evdScore = evd + 1
  if (Math.random() < p.smartChance) {
    if (evdScore === defScore) return Math.random() > 0.5 ? 'defend' : 'evade'
    return evdScore > defScore ? 'evade' : 'defend'
  }
  return Math.random() > 0.5 ? 'defend' : 'evade'
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
  level?: CpuLevel
): number {
  const others = players
    .map((p, i) => ({ p, i }))
    .filter(x => x.i !== selfIndex)
  if (others.length === 0) return selfIndex

  if (!maybeSmart(level)) {
    return others[Math.floor(Math.random() * others.length)].i
  }

  const stars = findStarPositions(tileTypes, boardLength)
  const self = players[selfIndex]
  const selfStarDist = nearestStarDistance(self.position, stars, boardLength)

  const ranked = others.map(({ p, i }) => {
    const starDist = nearestStarDistance(p.position, stars, boardLength)
    let score = 0
    // Want their tile if closer to a star than we are
    score += (selfStarDist - starDist) * 8
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
    let score = p.coins * 2 + p.trophies * 15 + p.score * 0.25
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
  level?: CpuLevel
): number {
  const stars = findStarPositions(tileTypes, boardLength)
  if (stars.length === 0 || !maybeSmart(level)) {
    return Math.floor(Math.random() * boardLength)
  }

  const star = stars[Math.floor(Math.random() * stars.length)]
  // Land 1–3 tiles before the star so the next rolls can claim it
  const back = 1 + Math.floor(Math.random() * 3)
  return (star - back + boardLength) % boardLength
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
    if (coins - item.cost < reserve && coins < starCost) return coins >= item.cost
    if (coins >= starCost && coins - item.cost < starCost && pressure > 0.55) {
      // Prefer saving for star in mid/late game unless item is high priority
      const prio = p.preferredItems.indexOf(item.type)
      return prio >= 0 && prio <= 1
    }
    return true
  })

  if (affordable.length === 0) return null

  // Avoid stacking duplicates unless hard and it's golden_key/shield
  const fresh = affordable.filter(a => !inventory.includes(a.type as never) || a.type === 'shield' || a.type === 'dash')
  const pool = fresh.length > 0 ? fresh : affordable

  for (const pref of p.preferredItems) {
    const hit = pool.find(a => a.type === pref)
    if (hit) {
      if (maybeSmart(level) || Math.random() < 0.55) return hit
    }
  }

  return pool[Math.floor(Math.random() * pool.length)]
}
