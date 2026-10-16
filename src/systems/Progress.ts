/**
 * Lifetime learning progress for this device (all human players combined).
 * Stored in localStorage under `vocab-party-progress`.
 */

export interface WordRecord {
  correct: number
  wrong: number
  lastSeen: number
  note?: string
}

export interface ProgressData {
  version: 1
  words: Record<string, WordRecord>
  gamesPlayed: number
  gamesWon: number
  minigamesPlayed: number
  minigamesWon: number
  /** Achievement id → unlock timestamp. */
  achievements?: Record<string, number>
  /** Board ids on which a human has won a party. */
  boardsWon?: string[]
}

export type Mastery = 'mastered' | 'learning' | 'practice'

const KEY = 'vocab-party-progress'
const MAX_WORDS = 1500

function empty(): ProgressData {
  return { version: 1, words: {}, gamesPlayed: 0, gamesWon: 0, minigamesPlayed: 0, minigamesWon: 0 }
}

let cache: ProgressData | null = null

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

/** Keep only well-formed fields from stored progress, so one bad entry can't break the Word Book. */
function sanitize(p: Partial<ProgressData>): ProgressData {
  const words: Record<string, WordRecord> = {}
  for (const [word, rec] of Object.entries(p.words ?? {})) {
    const r = rec as Partial<WordRecord> | null
    if (!r || typeof r !== 'object' || typeof word !== 'string' || !word.trim()) continue
    words[word] = {
      correct: count(r.correct),
      wrong: count(r.wrong),
      lastSeen: count(r.lastSeen),
      ...(typeof r.note === 'string' ? { note: r.note } : {}),
    }
  }
  const achievements: Record<string, number> = {}
  if (p.achievements && typeof p.achievements === 'object' && !Array.isArray(p.achievements)) {
    for (const [id, at] of Object.entries(p.achievements)) if (typeof at === 'number' && Number.isFinite(at)) achievements[id] = at
  }
  return {
    version: 1,
    words,
    gamesPlayed: count(p.gamesPlayed),
    gamesWon: count(p.gamesWon),
    minigamesPlayed: count(p.minigamesPlayed),
    minigamesWon: count(p.minigamesWon),
    achievements,
    boardsWon: Array.isArray(p.boardsWon) ? p.boardsWon.filter((b): b is string => typeof b === 'string') : [],
  }
}

export function getProgress(): ProgressData {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<ProgressData> | null
      if (p?.version === 1 && p.words && typeof p.words === 'object') {
        cache = sanitize(p)
        return cache
      }
    }
  } catch {
    /* corrupt storage — start fresh */
  }
  cache = empty()
  return cache
}

export function saveProgress(): void {
  save()
}

function save() {
  if (!cache) return
  try {
    const entries = Object.entries(cache.words)
    if (entries.length > MAX_WORDS) {
      entries.sort((a, b) => b[1].lastSeen - a[1].lastSeen)
      cache.words = Object.fromEntries(entries.slice(0, MAX_WORDS))
    }
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* storage unavailable — progress is best-effort */
  }
}

/** Normalize study keys: lowercase, trimmed, no trailing hyphen spacing. */
function keyOf(word: string): string {
  return word.trim().toLowerCase()
}

export function recordWords(entries: { word: string; correct: boolean; note?: string }[]): void {
  if (entries.length === 0) return
  const p = getProgress()
  const now = Date.now()
  for (const e of entries) {
    const k = keyOf(e.word)
    if (!k || k.length > 80) continue
    const rec = p.words[k] ?? { correct: 0, wrong: 0, lastSeen: now }
    if (e.correct) rec.correct += 1
    else rec.wrong += 1
    rec.lastSeen = now
    if (e.note) rec.note = e.note
    p.words[k] = rec
  }
  save()
}

export function recordMinigame(won: boolean): void {
  const p = getProgress()
  p.minigamesPlayed += 1
  if (won) p.minigamesWon += 1
  save()
}

export function recordGame(won: boolean, boardId?: string): void {
  const p = getProgress()
  p.gamesPlayed += 1
  if (won) {
    p.gamesWon += 1
    if (boardId) p.boardsWon = Array.from(new Set([...(p.boardsWon ?? []), boardId]))
  }
  save()
}

export function masteryOf(r: WordRecord): Mastery {
  if (r.correct >= 3 && r.correct >= r.wrong * 3) return 'mastered'
  if (r.wrong > r.correct) return 'practice'
  return 'learning'
}

/** Pull the quoted target word out of board questions like "What does 'benevolent' mean?". */
export function wordFromQuestion(question: string): string | null {
  const m = question.match(/['‘’"“”]([A-Za-z-]{3,24})['‘’"“”]/)
  return m ? m[1] : null
}

/** Words the player should practice most (most misses first). */
export function weakWords(limit = 30): string[] {
  const p = getProgress()
  return Object.entries(p.words)
    .filter(([, r]) => masteryOf(r) !== 'mastered')
    .sort((a, b) => (b[1].wrong - b[1].correct) - (a[1].wrong - a[1].correct) || b[1].lastSeen - a[1].lastSeen)
    .slice(0, limit)
    .map(([w]) => w)
}
