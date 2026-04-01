export type TileType = 'vocab' | 'grammar' | 'bonus' | 'mystery' | 'minigame' | 'swap' | 'start'

export interface Player {
  id: number
  name: string
  emoji: string
  score: number
  position: number
  trophies: number
}

export interface GameState {
  players: Player[]
  currentPlayer: number
  turn: number
  round: number
}

export function createInitialState(names: string[], emojis: string[]): GameState {
  return {
    players: names.map((name, i) => ({
      id: i,
      name,
      emoji: emojis[i],
      score: 0,
      position: 0,
      trophies: 0
    })),
    currentPlayer: 0,
    turn: 0,
    round: 1
  }
}
