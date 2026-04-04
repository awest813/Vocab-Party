export type TileType =
  | 'vocab'
  | 'grammar'
  | 'bonus'
  | 'mystery'
  | 'minigame'
  | 'swap'
  | 'start'
  | 'shop'
  | 'star'
  | 'brick'

import type { CpuLevel } from './CpuPolicy'
import { DEFAULT_CPU_LEVEL } from './CpuPolicy'

export interface Player {
  id: number
  name: string
  emoji: string
  score: number
  position: number
  trophies: number
  coins: number
  bricksCollected: number
  /** When true, the board auto-rolls and resolves vocab/grammar/minigames without human input. */
  isCpu: boolean
  /** Difficulty for `isCpu` players; ignored for humans (kept at default). */
  cpuLevel: CpuLevel
}

export interface GameState {
  players: Player[]
  currentPlayer: number
  turn: number
  round: number
}

export function createInitialState(
  names: string[],
  emojis: string[],
  cpuFlags?: boolean[],
  cpuLevels?: CpuLevel[]
): GameState {
  return {
    players: names.map((name, i) => ({
      id: i,
      name,
      emoji: emojis[i],
      score: 0,
      position: 0,
      trophies: 0,
      coins: 18,
      bricksCollected: 0,
      isCpu: cpuFlags?.[i] ?? false,
      cpuLevel: cpuLevels?.[i] ?? DEFAULT_CPU_LEVEL
    })),
    currentPlayer: 0,
    turn: 0,
    round: 1
  }
}
