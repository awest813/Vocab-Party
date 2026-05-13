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
  minigameGuessCorrectChance: number
  minigameMaxGuessAttempts: number
  minigameThinkDelayMsMin: number
  minigameThinkDelayMsMax: number
  /** 0-1: how likely to buy a shop when affordable */
  shopBuyChance: number
  /** 0-1: how likely to buy a star immediately vs save */
  starBuyThreshold: number
  /** Items the CPU will try to buy in priority order at an item shop */
  preferredItems: string[]
  /** Bonus correct chance added per round (scales difficulty as game progresses) */
  roundBonus: number
}

const CPU_BY_LEVEL: Record<CpuLevel, CpuLevelProfile> = {
  easy: {
    boardQuestionCorrectChance: 0.38,
    boardQuestionDelayMsMin: 1800,
    boardQuestionDelayMsMax: 3200,
    rollDelayMsMin: 700,
    rollDelayMsMax: 1400,
    minigameGuessCorrectChance: 0.42,
    minigameMaxGuessAttempts: 14,
    minigameThinkDelayMsMin: 280,
    minigameThinkDelayMsMax: 560,
    shopBuyChance: 0.3,
    starBuyThreshold: 0.3,
    preferredItems: ['shield', 'dash', 'double_score', 'warp', 'poison_dart', 'swap', 'golden_key'],
    roundBonus: 0.01
  },
  normal: {
    boardQuestionCorrectChance: 0.52,
    boardQuestionDelayMsMin: 1400,
    boardQuestionDelayMsMax: 2600,
    rollDelayMsMin: 550,
    rollDelayMsMax: 1100,
    minigameGuessCorrectChance: 0.55,
    minigameMaxGuessAttempts: 18,
    minigameThinkDelayMsMin: 220,
    minigameThinkDelayMsMax: 480,
    shopBuyChance: 0.6,
    starBuyThreshold: 0.5,
    preferredItems: ['shield', 'double_score', 'dash', 'golden_key', 'poison_dart', 'swap', 'warp'],
    roundBonus: 0.015
  },
  hard: {
    boardQuestionCorrectChance: 0.72,
    boardQuestionDelayMsMin: 1000,
    boardQuestionDelayMsMax: 2000,
    rollDelayMsMin: 400,
    rollDelayMsMax: 850,
    minigameGuessCorrectChance: 0.68,
    minigameMaxGuessAttempts: 22,
    minigameThinkDelayMsMin: 160,
    minigameThinkDelayMsMax: 380,
    shopBuyChance: 0.85,
    starBuyThreshold: 0.8,
    preferredItems: ['golden_key', 'double_score', 'shield', 'dash', 'poison_dart', 'swap', 'warp'],
    roundBonus: 0.02
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

/**
 * Choose the best item for the CPU to use right before rolling.
 * Returns the index into the inventory array, or -1 to use nothing.
 * @param inventory - player's ItemType list
 * @param coins - current coin count
 * @param score - current score
 * @param position - current board position (0-43)
 * @param trophies - star trophy count
 * @param isLastPlace - whether they're in last place
 * @param rankAmongPlayers - relative rank (lower = better)
 * @param level - CPU difficulty
 */
export function cpuChooseItem(
  inventory: string[],
  coins: number,
  score: number,
  position: number,
  trophies: number,
  isLastPlace: boolean,
  rankAmongPlayers: number,
  level?: CpuLevel
): number {
  if (inventory.length === 0) return -1

  const lowOnCoins = coins < 8
  const behind = rankAmongPlayers > 1 || isLastPlace

  // Star positions on board: tiles 6, 22, 39. Max roll = 3 (4 with speed boost).
  // Golden Key: use if star is within reach (3 steps ahead, wrapping)
  const starPositions = [6, 22, 39]
  const maxSteps = 4
  const hasStarAhead = starPositions.some(si => {
    const dist = si > position ? si - position : 44 - position + si
    return dist > 0 && dist <= maxSteps
  })

  // Golden Key: use if star tile is within reach
  const gkIdx = inventory.indexOf('golden_key')
  if (gkIdx >= 0 && hasStarAhead) return gkIdx

  // Shield: use when low on coins (protect from rent/penalties)
  const shieldIdx = inventory.indexOf('shield')
  if (shieldIdx >= 0 && lowOnCoins) return shieldIdx

  // Double Score: use if ahead or close to winning
  const dsIdx = inventory.indexOf('double_score')
  if (dsIdx >= 0 && trophies >= 3) return dsIdx
  if (dsIdx >= 0 && score > 20 && Math.random() < 0.4) return dsIdx

  // Dash: use when behind (need more movement)
  const dashIdx = inventory.indexOf('dash')
  if (dashIdx >= 0 && behind && Math.random() < 0.6) return dashIdx

  // Swap: use when in last place
  const swapIdx = inventory.indexOf('swap')
  if (swapIdx >= 0 && isLastPlace) return swapIdx

  // Warp: use when far from star
  const warpIdx = inventory.indexOf('warp')
  if (warpIdx >= 0 && !hasStarAhead && Math.random() < 0.3) return warpIdx

  // Poison Dart: use when there's a leader to catch
  const pdIdx = inventory.indexOf('poison_dart')
  if (pdIdx >= 0 && behind && Math.random() < 0.5) return pdIdx

  return -1
}

/**
 * Check if a tile type appears within `range` steps ahead of `position`.
 */
function hasTileTypeAhead(position: number, type: string, range: number, tileTypes?: string[]): boolean {
  // This is a board-agnostic version; the caller must provide tileTypes
  // We just check if the position + range crosses the star tile index
  // Star tiles are at indices: 6, 22, 39 in the board layout (approximately)
  const starIndices = [6, 22, 39]
  for (const si of starIndices) {
    const dist = si > position ? si - position : 44 - position + si
    if (dist > 0 && dist <= range) return true
  }
  return false
}

/**
 * CPU decides whether to buy a shop when landing on one.
 */
export function cpuShouldBuyShop(coins: number, level?: CpuLevel): boolean {
  const p = cpuPolicyForLevel(level)
  return coins >= 8 && Math.random() < p.shopBuyChance
}

/**
 * CPU decides whether to spend coins on a star or save.
 */
export function cpuShouldBuyStar(coins: number, trophies: number, level?: CpuLevel): boolean {
  const p = cpuPolicyForLevel(level)
  if (coins < 20) return false
  // Buy immediately if ahead or near win; otherwise probabilistic
  return Math.random() < p.starBuyThreshold || trophies >= 4
}

/**
 * CPU chooses the best path when a branch is encountered.
 * tileTypes: the 44-element TILE_TYPES array from BoardScene.
 * Returns the index into `options` to take.
 */
export function cpuChooseBranch(
  position: number,
  options: number[],
  tileTypes: string[],
  coins: number,
  trophies: number,
  level?: CpuLevel
): number {
  const p = cpuPolicyForLevel(level)
  const tileCount = tileTypes.length

  const scored = options.map(id => {
    const dist = (id > position) ? id - position : tileCount - position + id
    const type = tileTypes[id % tileCount] ?? 'vocab'
    let score = 0
    if (type === 'star') score = 100 - dist
    else if (type === 'shop' && coins >= 8) score = 90 - dist
    else if (type === 'item_shop') score = 80 - dist
    else if (type === 'bonus') score = 70 - dist
    else if (type === 'minigame') score = 60 - dist
    else if (type === 'vocab' || type === 'grammar') score = 50 - dist
    else if (type === 'mystery') score = 40 - dist
    else if (type === 'brick') score = 35 - dist
    else if (type === 'penalty' || type === 'brick') score = -50 + dist
    else score = 30
    return { id, score, dist }
  })

  // Hard CPU takes best path; easy/normal adds randomness
  if (p.boardQuestionCorrectChance < 0.5) {
    // Easy: mostly random, slight preference
    if (Math.random() < 0.3) {
      return Math.floor(Math.random() * options.length)
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return options.indexOf(scored[0].id)
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
  // Higher difficulty makes smarter choices more often
  const smartChance = p.boardQuestionCorrectChance
  if (Math.random() < smartChance) {
    return evdScore > defScore ? 'evade' : 'defend'
  }
  return Math.random() > 0.5 ? 'defend' : 'evade'
}
