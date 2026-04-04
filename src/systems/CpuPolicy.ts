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
    minigameThinkDelayMsMax: 560
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
    minigameThinkDelayMsMax: 480
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
    minigameThinkDelayMsMax: 380
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
