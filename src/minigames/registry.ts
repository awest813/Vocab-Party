import type { CpuLevel } from '../systems/CpuPolicy'
import { anagramDash } from './games/anagramDash'
import { memoryMatch } from './games/memoryMatch'
import { whackAWord, wordSorter } from './games/posGames'
import {
  antonymAttack,
  contextClues,
  definitionDash,
  grammarGauntlet,
  homophoneHunt,
  oddOneOut,
  prefixFactory,
  rootDetective,
  spellingBee,
  compoundCrafter,
} from './games/quizGames'
import { synonymStorm } from './games/synonymStorm'
import { linkUp } from './games/linkUp'
import { wordHero } from './games/wordHero'
import { wordRacer } from './games/wordRacer'
import { letterRescue } from './games/letterRescue'
import { sentenceScramble } from './games/sentenceScramble'
import type { MinigameDef } from './types'

export const MINIGAMES: MinigameDef[] = [
  wordHero,
  wordRacer,
  synonymStorm,
  anagramDash,
  memoryMatch,
  linkUp,
  whackAWord,
  sentenceScramble,
  letterRescue,
  wordSorter,
  definitionDash,
  oddOneOut,
  spellingBee,
  antonymAttack,
  contextClues,
  prefixFactory,
  rootDetective,
  compoundCrafter,
  homophoneHunt,
  grammarGauntlet,
]

export function getMinigame(id: string | undefined): MinigameDef | undefined {
  return MINIGAMES.find(m => m.id === id)
}

/**
 * Pick a game for a party round, avoiding the most recent picks so the
 * rotation feels fresh (Mario Party–style roulette).
 */
const recent: string[] = []
export function pickPartyMinigame(): MinigameDef {
  const pool = MINIGAMES.filter(m => !recent.includes(m.id))
  const choice = pool[Math.floor(Math.random() * pool.length)] ?? MINIGAMES[0]
  recent.push(choice.id)
  while (recent.length > Math.min(6, MINIGAMES.length - 1)) recent.shift()
  return choice
}

/** Simulated CPU final score: uniform within the level range, with a light bell curve. */
export function cpuMinigameScore(def: MinigameDef, level: CpuLevel): number {
  const [lo, hi] = def.cpu[level]
  const r = (Math.random() + Math.random()) / 2
  return Math.round(lo + r * (hi - lo))
}

const BEST_KEY = 'vocab-party-bests'

export function getPersonalBests(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    return out
  } catch {
    return {}
  }
}

/** Saves a score; returns true when it's a new personal best. */
export function recordPersonalBest(id: string, score: number): boolean {
  const bests = getPersonalBests()
  if (score <= (bests[id] ?? 0)) return false
  bests[id] = score
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(bests))
  } catch {
    /* storage unavailable */
  }
  return true
}
