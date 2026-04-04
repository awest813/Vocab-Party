/**
 * Tunable parameters and helpers for computer-controlled players.
 * Scenes pass Phaser.Math (or compatible) for delays and randomness.
 */

export const CPU_POLICY = {
  /** Probability the CPU picks the right answer on board vocab/grammar tiles. */
  boardQuestionCorrectChance: 0.52,
  boardQuestionDelayMsMin: 1400,
  boardQuestionDelayMsMax: 2600,
  rollDelayMsMin: 550,
  rollDelayMsMax: 1100,
  /**
   * Minigames are multi-try for humans until correct or time out.
   * CPU simulates repeated guesses; success awards the current player like a human win.
   */
  minigameGuessCorrectChance: 0.55,
  minigameMaxGuessAttempts: 18,
  minigameThinkDelayMsMin: 220,
  minigameThinkDelayMsMax: 480,
} as const

export type CpuPhaserMath = {
  Between: (min: number, max: number) => number
  FloatBetween: (min: number, max: number) => number
}

export function cpuBoardQuestionResolve(math: CpuPhaserMath) {
  return {
    delayMs: math.Between(CPU_POLICY.boardQuestionDelayMsMin, CPU_POLICY.boardQuestionDelayMsMax),
    correctChance: CPU_POLICY.boardQuestionCorrectChance,
  }
}

export function cpuRollDelayMs(math: CpuPhaserMath) {
  return math.Between(CPU_POLICY.rollDelayMsMin, CPU_POLICY.rollDelayMsMax)
}

/**
 * Simulates CPU playing a single-answer minigame (wrong answers can be retried).
 * Returns whether the current player won and total simulated "thinking" delay.
 */
export function simulateCpuMinigameGuesses(math: CpuPhaserMath): { currentPlayerWins: boolean; totalDelayMs: number } {
  let totalDelayMs = 0
  for (let a = 0; a < CPU_POLICY.minigameMaxGuessAttempts; a++) {
    totalDelayMs += math.Between(
      CPU_POLICY.minigameThinkDelayMsMin,
      CPU_POLICY.minigameThinkDelayMsMax
    )
    if (math.FloatBetween(0, 1) < CPU_POLICY.minigameGuessCorrectChance) {
      return { currentPlayerWins: true, totalDelayMs }
    }
  }
  return { currentPlayerWins: false, totalDelayMs }
}
