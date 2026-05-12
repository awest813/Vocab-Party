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
    preferredItems: ['shield', 'dash', 'double_score', 'warp', 'poison_dart', 'swap', 'golden_key']
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
    preferredItems: ['shield', 'double_score', 'dash', 'golden_key', 'poison_dart', 'swap', 'warp']
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
    preferredItems: ['golden_key', 'double_score', 'shield', 'dash', 'poison_dart', 'swap', 'warp']
  }
}

export function cpuPolicyForLevel(level: CpuLevel | undefined): CpuLevelProfile {
  return CPU_BY_LEVEL[level ?? DEFAULT_CPU_LEVEL]
}

export type CpuPhaserMath = {
  Between: (min: number, max: number) => number
  FloatBetween: (min: number, max: number) => number
}

export function cpuBoardQuestionResolve(math: CpuPhaserMath, level?: CpuLevel) {
  const p = cpuPolicyForLevel(level)
  return {
    delayMs: math.Between(p.boardQuestionDelayMsMin, p.boardQuestionDelayMsMax),
    correctChance: p.boardQuestionCorrectChance
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

  const p = cpuPolicyForLevel(level)
  const hasStarTileAhead = hasTileTypeAhead(position, 'star', 6)
  const lowOnCoins = coins < 8
  const behind = rankAmongPlayers > 1 || isLastPlace

  // Golden Key: use if star tile is ahead (guarantees reaching it)
  const gkIdx = inventory.indexOf('golden_key')
  if (gkIdx >= 0 && hasStarTileAhead) return gkIdx

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
  if (warpIdx >= 0 && !hasStarTileAhead && Math.random() < 0.3) return warpIdx

  // Poison Dart: use when there's a leader to catch
  const pdIdx = inventory.indexOf('poison_dart')
  if (pdIdx >= 0 && behind && Math.random() < 0.5) return pdIdx

  // Random first item as fallback (only on hard)
  if (p.boardQuestionCorrectChance > 0.6 && Math.random() < 0.15) return 0

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
  // Star buy threshold: higher = more likely to buy immediately
  return Math.random() < p.starBuyThreshold + (trophies >= 4 ? 0.2 : 0)
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
