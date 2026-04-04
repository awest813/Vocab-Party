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
}

export interface GameState {
  players: Player[]
  currentPlayer: number
  turn: number
  round: number
}

export function createInitialState(names: string[], emojis: string[], cpuFlags?: boolean[]): GameState {
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
      isCpu: cpuFlags?.[i] ?? false
    })),
    currentPlayer: 0,
    turn: 0,
    round: 1
  }
}
