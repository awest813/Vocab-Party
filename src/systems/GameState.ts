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
  | 'item_shop'
  | 'penalty'

import type { CpuLevel } from './CpuPolicy'
import { DEFAULT_CPU_LEVEL } from './CpuPolicy'

export type ItemType = 'dash' | 'swap' | 'warp' | 'shield' | 'double_score' | 'poison_dart' | 'golden_key'

export interface Item {
  id: string
  type: ItemType
  name: string
  emoji: string
  cost: number
  description: string
}

export interface Player {
  id: number
  name: string
  emoji: string
  /** Index into CHARACTER_DEFS / PLAYER_TEXTURE_KEYS. */
  characterIndex: number
  score: number
  position: number
  trophies: number
  coins: number
  bricksCollected: number
  inventory: ItemType[]
  doubleScoreActive: boolean
  shieldActive: boolean
  dashActive: boolean
  /** Next roll is forced to this value if > 0 */
  forcedMoveValue: number
  atk: number
  def: number
  evd: number
  /** Consecutive correct board-question answers. */
  answerStreak: number
  /** Number of upcoming turns with a boosted block die. */
  speedBoostTurns: number
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

export const ITEMS: Record<ItemType, Item> = {
  dash: { id: 'dash', type: 'dash', name: 'Dash Card', emoji: '🏃', cost: 5, description: 'Roll two dice this turn.' },
  swap: { id: 'swap', type: 'swap', name: 'Swap Card', emoji: '🔄', cost: 10, description: 'Swap positions with a random player.' },
  warp: { id: 'warp', type: 'warp', name: 'Warp Card', emoji: '🌀', cost: 8, description: 'Teleport to a random board tile.' },
  shield: { id: 'shield', type: 'shield', name: 'Shield Card', emoji: '🛡️', cost: 6, description: 'Avoid the next penalty or battle loss.' },
  double_score: { id: 'double_score', type: 'double_score', name: 'Double Card', emoji: '📈', cost: 12, description: 'Double the points from your next correct answer.' },
  poison_dart: { id: 'poison_dart', type: 'poison_dart', name: 'Poison Dart', emoji: '🎯', cost: 7, description: 'The next player you pass or land on loses 8 coins.' },
  golden_key: { id: 'golden_key', type: 'golden_key', name: 'Golden Key', emoji: '🔑', cost: 15, description: 'Your next roll will be exactly 5.' }
}

export function createInitialState(
  names: string[],
  emojis: string[],
  cpuFlags?: boolean[],
  cpuLevels?: CpuLevel[],
  characterIndices?: number[]
): GameState {
  return {
    players: names.map((name, i) => ({
      id: i,
      name,
      emoji: emojis[i],
      characterIndex: characterIndices?.[i] ?? i,
      score: 0,
      position: 0,
      trophies: 0,
      coins: 18,
      bricksCollected: 0,
      inventory: [],
      doubleScoreActive: false,
      shieldActive: false,
      dashActive: false,
      atk: [1, -1, -1, 0][i % 4],
      def: [-1, 1, 0, 0][i % 4],
      evd: [0, 0, 1, 0][i % 4],
      answerStreak: 0,
      speedBoostTurns: 0,
      isCpu: cpuFlags?.[i] ?? false,
      cpuLevel: cpuLevels?.[i] ?? DEFAULT_CPU_LEVEL,
      forcedMoveValue: 0
    })),
    currentPlayer: 0,
    turn: 0,
    round: 1
  }
}

