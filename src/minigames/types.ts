import type Phaser from 'phaser'
import type { ContentBank } from './ContentBank'

export type MinigameCategory = 'Vocabulary' | 'Grammar' | 'Spelling' | 'Word Parts'

/** CPU final-score ranges per difficulty, inclusive. */
export type CpuScoreRanges = {
  easy: [number, number]
  normal: [number, number]
  hard: [number, number]
}

export interface PlayArea {
  /** Center x of the play area. */
  cx: number
  /** Top y of the play area. */
  top: number
  /** Bottom y of the play area. */
  bottom: number
  /** Width of the play area. */
  width: number
  left: number
  right: number
}

/** Everything a running minigame may use. Owned by MinigameScene. */
export interface MinigameContext {
  scene: Phaser.Scene
  bank: ContentBank
  /** All game objects should be added to this container (depth managed by the runner). */
  root: Phaser.GameObjects.Container
  area: PlayArea
  accent: number
  touch: boolean
  reduceMotion: boolean
  /** Award (or subtract) points; shows a popup at x/y when given. Score never drops below 0. */
  addScore(delta: number, x?: number, y?: number): void
  /** Record a word or item the player practised (feeds the end-of-game study sheet). */
  recordWord(word: string, correct: boolean, note?: string): void
  /** Key handler; receives KeyboardEvent.key and code. Return true when handled. */
  onKey(handler: (ev: KeyboardEvent) => boolean | void): void
  /** True once the clock has run out — stop accepting input. */
  isOver(): boolean
  /** Milliseconds remaining on the clock. */
  timeLeftMs(): number
  /** Runs `fn` after `ms` unless the round has ended. */
  after(ms: number, fn: () => void): Phaser.Time.TimerEvent
  /**
   * Other participants and their current scores: CPUs report their live (ghost) score,
   * humans who already played report their final score, humans yet to play report null.
   */
  rivals(): RivalView[]
  /** Brief center-screen text flash (e.g. "NEW TARGET!"). */
  flash(text: string, color?: string): void
}

export interface RivalView {
  id: number
  name: string
  color: number
  characterIndex: number
  isCpu: boolean
  score: number | null
}

export interface MinigameInstance {
  /** Called every frame while the round is live. */
  update?(time: number, delta: number): void
  /** Called once when time runs out (before objects are destroyed). */
  stop?(): void
}

export interface MinigameDef {
  id: string
  title: string
  icon: string
  accent: number
  category: MinigameCategory
  /** One-line hook for cards and roulette. */
  tagline: string
  /** 2–3 short rules lines for the intro card. */
  howTo: string[]
  controls: { keys: string; touch: string }
  durationMs: number
  cpu: CpuScoreRanges
  start(ctx: MinigameContext): MinigameInstance
}
