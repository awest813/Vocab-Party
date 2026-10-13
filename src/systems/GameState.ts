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

/** Keep in sync with CHARACTER_DEFS / PLAYER_TEXTURE_KEYS length in SpriteFactory. */
export const CHARACTER_COUNT = 8

export type ItemType = 'dash' | 'swap' | 'warp' | 'shield' | 'double_score' | 'poison_dart' | 'golden_key'

export interface Item {
  id: string
  type: ItemType
  name: string
  emoji: string
  cost: number
  description: string
}

export interface StudyNote {
  word: string
  note?: string
}

/** Running tallies used for end-of-game bonus stars and the study sheet. */
export interface PlayerStats {
  correctAnswers: number
  wrongAnswers: number
  minigameWins: number
  minigamePoints: number
  /** Highest coin total held at any point (Coin Star). */
  peakCoins: number
  /** Words / questions this player missed, newest last (deduped). */
  missed: StudyNote[]
  /** Distinct words practised in minigames. */
  wordsPracticed: number
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
  stats: PlayerStats
}

/** How often an all-player party minigame runs between rounds. */
export type MinigameFrequency = 'every' | 'alternate' | 'tiles'

export interface PartyOptions {
  minigames: MinigameFrequency
  bonusStars: boolean
}

export const DEFAULT_PARTY_OPTIONS: PartyOptions = { minigames: 'every', bonusStars: true }

export interface GameState {
  players: Player[]
  currentPlayer: number
  turn: number
  round: number
  options: PartyOptions
  /** Set once the "Last Stretch" comeback event has fired. */
  lastStretchDone: boolean
  /** Filled in by the bonus-star ceremony at game end. */
  bonusAwards?: BonusAward[]
}

export interface BonusAward {
  icon: string
  title: string
  blurb: string
  /** Player ids who received the trophy. */
  winners: number[]
  /** The stat value that won it. */
  value: number
}

export function addStudyMiss(player: Player, word: string, note?: string): void {
  const list = player.stats.missed
  const i = list.findIndex(n => n.word.toLowerCase() === word.toLowerCase())
  if (i >= 0) list.splice(i, 1)
  list.push({ word, note })
  if (list.length > 30) list.shift()
}

export const ITEMS: Record<ItemType, Item> = {
  dash: { id: 'dash', type: 'dash', name: 'Dash Card', emoji: '🏃', cost: 5, description: 'Roll two dice this turn.' },
  swap: { id: 'swap', type: 'swap', name: 'Swap Card', emoji: '🔄', cost: 10, description: 'Swap positions with a random player.' },
  warp: { id: 'warp', type: 'warp', name: 'Warp Card', emoji: '🌀', cost: 8, description: 'Teleport to a random board tile.' },
  shield: { id: 'shield', type: 'shield', name: 'Shield Card', emoji: '🛡️', cost: 6, description: 'Avoid the next penalty or battle loss.' },
  double_score: { id: 'double_score', type: 'double_score', name: 'Double Card', emoji: '📈', cost: 12, description: 'Double the points from your next correct answer.' },
  poison_dart: { id: 'poison_dart', type: 'poison_dart', name: 'Poison Dart', emoji: '🎯', cost: 7, description: 'Hit a rival — they lose 8 coins immediately.' },
  golden_key: { id: 'golden_key', type: 'golden_key', name: 'Golden Key', emoji: '🔑', cost: 15, description: 'Your next roll will be exactly 3 (max block die).' }
}

export function createInitialState(
  names: string[],
  emojis: string[],
  cpuFlags?: boolean[],
  cpuLevels?: CpuLevel[],
  characterIndices?: number[],
  options: PartyOptions = DEFAULT_PARTY_OPTIONS
): GameState {
  return {
    players: names.map((name, i) => ({
      id: i,
      name,
      emoji: emojis[i],
      characterIndex: (() => {
        const raw = characterIndices?.[i] ?? i
        const n = CHARACTER_COUNT
        return ((Math.floor(raw) % n) + n) % n
      })(),
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
      forcedMoveValue: 0,
      stats: {
        correctAnswers: 0,
        wrongAnswers: 0,
        minigameWins: 0,
        minigamePoints: 0,
        peakCoins: 18,
        missed: [],
        wordsPracticed: 0,
      },
    })),
    currentPlayer: 0,
    turn: 0,
    round: 1,
    options: { ...options },
    lastStretchDone: false,
  }
}

