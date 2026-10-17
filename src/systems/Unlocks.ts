import type { MusicTrack } from './Sfx'

/**
 * Party Tickets and cosmetic unlocks (dice colours, golden characters, confetti, board music).
 * Tickets are earned by playing; everything they buy is cosmetic, so no learning content is gated.
 * Stored per device in localStorage under `vocab-party-unlocks`.
 */

export type UnlockKind = 'dice' | 'golden' | 'confetti' | 'music'

export interface UnlockItem {
  id: string
  kind: UnlockKind
  name: string
  icon: string
  cost: number
  desc: string
  /** Dice: face / pip / dark colours. */
  dice?: { face: number; dark: number; pip: number }
  /** Golden: CHARACTER_DEFS index. */
  character?: number
  /** Confetti: emoji or colour palette. */
  confetti?: { emoji?: string[]; colors?: number[] }
  /** Music: track id in Sfx. */
  track?: MusicTrack
}

export const UNLOCKS: UnlockItem[] = [
  // Dice colours (the classic pink die is free and owned from the start).
  { id: 'dice_classic', kind: 'dice', name: 'Classic Die', icon: '🎲', cost: 0, desc: 'The original party pink.', dice: { face: 0xf04a6a, dark: 0xb02848, pip: 0xffffff } },
  { id: 'dice_ocean', kind: 'dice', name: 'Ocean Die', icon: '🌊', cost: 40, desc: 'Cool blue with white pips.', dice: { face: 0x3d8fff, dark: 0x1e5aa8, pip: 0xffffff } },
  { id: 'dice_mint', kind: 'dice', name: 'Mint Die', icon: '🍃', cost: 40, desc: 'Fresh green, easy on the eyes.', dice: { face: 0x2ad46a, dark: 0x168a42, pip: 0xffffff } },
  { id: 'dice_sunset', kind: 'dice', name: 'Sunset Die', icon: '🌅', cost: 60, desc: 'Warm orange glow.', dice: { face: 0xff9f1c, dark: 0xb86a08, pip: 0xfff4dc } },
  { id: 'dice_royal', kind: 'dice', name: 'Royal Die', icon: '👑', cost: 80, desc: 'Deep purple with gold pips.', dice: { face: 0x7c4ddb, dark: 0x4a2a94, pip: 0xffd24a } },
  { id: 'dice_midnight', kind: 'dice', name: 'Midnight Die', icon: '🌙', cost: 100, desc: 'Inky navy with starlight pips.', dice: { face: 0x1c2744, dark: 0x0a1020, pip: 0xbfe3ff } },
  { id: 'dice_gold', kind: 'dice', name: 'Golden Die', icon: '🏅', cost: 160, desc: 'Solid gold. Rolls like a champion.', dice: { face: 0xf4c430, dark: 0xa87a08, pip: 0x5a3a00 } },

  // Golden character editions.
  ...['Party Ace', 'Blue Wizard', 'Green Knight', 'Gold Pirate', 'Shadow Ninja', 'Forest Ranger', 'Steel Robot', 'Pink Princess'].map((name, i): UnlockItem => ({
    id: `golden_${i}`, kind: 'golden', name: `Golden ${name.split(' ').pop()}`, icon: '✨', cost: 120,
    desc: `A shining gold edition of ${name}.`, character: i,
  })),

  // Celebration confetti.
  { id: 'confetti_classic', kind: 'confetti', name: 'Party Confetti', icon: '🎉', cost: 0, desc: 'The classic colourful burst.', confetti: {} },
  { id: 'confetti_stars', kind: 'confetti', name: 'Star Shower', icon: '⭐', cost: 50, desc: 'Celebrate with falling stars.', confetti: { emoji: ['⭐', '🌟', '✨'] } },
  { id: 'confetti_hearts', kind: 'confetti', name: 'Heart Burst', icon: '💖', cost: 50, desc: 'Hearts for every win.', confetti: { emoji: ['💖', '💜', '💙', '💚'] } },
  { id: 'confetti_letters', kind: 'confetti', name: 'Alphabet Rain', icon: '🔤', cost: 70, desc: 'Letters fly when you win!', confetti: { emoji: ['🅰️', '🅱️', '🔤', '📝', '📚'] } },
  { id: 'confetti_gold', kind: 'confetti', name: 'Gold Rush', icon: '🪙', cost: 90, desc: 'A shower of gold.', confetti: { colors: [0xffd24a, 0xf4c430, 0xffe9a0, 0xffffff] } },

  // Board music.
  { id: 'music_board', kind: 'music', name: 'Party Groove', icon: '🎵', cost: 0, desc: 'The classic board theme.', track: 'board' },
  { id: 'music_lofi', kind: 'music', name: 'Study Lo-Fi', icon: '🎧', cost: 80, desc: 'Mellow beats for focused play.', track: 'lofi' },
  { id: 'music_fiesta', kind: 'music', name: 'Fiesta Fanfare', icon: '🎺', cost: 80, desc: 'Big, bouncy party energy.', track: 'fiesta' },
]

const FREE = UNLOCKS.filter(u => u.cost === 0).map(u => u.id)

interface UnlockData {
  tickets: number
  /** Lifetime tickets earned (for display). */
  earned: number
  owned: string[]
  equipped: { dice: string; confetti: string; music: string; golden: string[] }
  /** One-time rewards already paid (e.g. arcade medal tiers per game). */
  claimed: string[]
  /** Practice participation tickets paid today (capped so mashing keys can't farm tickets). */
  practice: { day: string; paid: number }
}

const KEY = 'vocab-party-unlocks'
let cache: UnlockData | null = null
const listeners = new Set<(gained: number, reason: string) => void>()

function fresh(): UnlockData {
  return {
    tickets: 0,
    earned: 0,
    owned: [...FREE],
    equipped: { dice: 'dice_classic', confetti: 'confetti_classic', music: 'music_board', golden: [] },
    claimed: [],
    practice: { day: '', paid: 0 },
  }
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const nat = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

function load(): UnlockData {
  if (cache) return cache
  const base = fresh()
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (raw) {
      const p = JSON.parse(raw) as Partial<UnlockData> | null
      if (p && typeof p === 'object') {
        const known = new Set(UNLOCKS.map(u => u.id))
        const owned = Array.from(new Set([...FREE, ...strings(p.owned).filter(id => known.has(id))]))
        const eq = (p.equipped ?? {}) as Partial<UnlockData['equipped']>
        const pick = (id: unknown, kind: UnlockKind, fallback: string) =>
          typeof id === 'string' && owned.includes(id) && UNLOCKS.find(u => u.id === id)?.kind === kind ? id : fallback
        cache = {
          tickets: nat(p.tickets),
          earned: nat(p.earned),
          owned,
          equipped: {
            dice: pick(eq.dice, 'dice', base.equipped.dice),
            confetti: pick(eq.confetti, 'confetti', base.equipped.confetti),
            music: pick(eq.music, 'music', base.equipped.music),
            golden: strings(eq.golden).filter(id => owned.includes(id)),
          },
          claimed: strings(p.claimed),
          practice: {
            day: typeof p.practice?.day === 'string' ? p.practice.day : '',
            paid: nat(p.practice?.paid),
          },
        }
        return cache
      }
    }
  } catch {
    /* corrupt or unavailable storage — start fresh */
  }
  cache = base
  return cache
}

// Another tab changed tickets/unlocks: drop the cache so we never overwrite its newer data.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === KEY || e.key === null) cache = null
  })
}

function save() {
  try {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* storage unavailable — unlocks last for this session only */
  }
}

export function getTickets(): number {
  return load().tickets
}

export function getLifetimeTickets(): number {
  return load().earned
}

export function isOwned(id: string): boolean {
  return load().owned.includes(id)
}

export function isEquipped(id: string): boolean {
  const d = load()
  const item = UNLOCKS.find(u => u.id === id)
  if (!item) return false
  if (item.kind === 'golden') return d.equipped.golden.includes(id)
  return d.equipped[item.kind] === id
}

/** Subscribe to ticket gains (for "+N 🎟️" toasts). Returns an unsubscribe function. */
export function onTickets(fn: (gained: number, reason: string) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Add tickets; `once` makes a reward claimable only one time ever. Returns tickets actually added. */
export function earnTickets(amount: number, reason: string, once?: string): number {
  const d = load()
  const n = Math.max(0, Math.floor(amount))
  if (n === 0) return 0
  if (once) {
    if (d.claimed.includes(once)) return 0
    d.claimed.push(once)
  }
  d.tickets += n
  d.earned += n
  save()
  listeners.forEach(fn => fn(n, reason))
  return n
}

export type BuyResult = 'ok' | 'owned' | 'poor' | 'unknown'

export function buy(id: string): BuyResult {
  const d = load()
  const item = UNLOCKS.find(u => u.id === id)
  if (!item) return 'unknown'
  if (d.owned.includes(id)) return 'owned'
  if (d.tickets < item.cost) return 'poor'
  d.tickets -= item.cost
  d.owned.push(id)
  save()
  equip(id)
  return 'ok'
}

/** Equip an owned item (golden editions toggle on/off independently). */
export function equip(id: string): void {
  const d = load()
  const item = UNLOCKS.find(u => u.id === id)
  if (!item || !d.owned.includes(id)) return
  if (item.kind === 'golden') {
    d.equipped.golden = d.equipped.golden.includes(id)
      ? d.equipped.golden.filter(g => g !== id)
      : [...d.equipped.golden, id]
  } else {
    d.equipped[item.kind] = id
  }
  save()
  changeListeners.forEach(fn => fn(item.kind))
}

const changeListeners = new Set<(kind: UnlockKind) => void>()
/** Subscribe to equip changes (textures regenerate on dice/golden changes). */
export function onEquipChange(fn: (kind: UnlockKind) => void): () => void {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

export function equippedDice(): NonNullable<UnlockItem['dice']> {
  const id = load().equipped.dice
  return UNLOCKS.find(u => u.id === id)?.dice ?? UNLOCKS[0].dice!
}

export function equippedConfetti(): NonNullable<UnlockItem['confetti']> {
  const id = load().equipped.confetti
  return UNLOCKS.find(u => u.id === id)?.confetti ?? {}
}

export function equippedBoardTrack(): MusicTrack {
  const id = load().equipped.music
  return UNLOCKS.find(u => u.id === id)?.track ?? 'board'
}

export function isGolden(characterIndex: number): boolean {
  return load().equipped.golden.includes(`golden_${characterIndex}`)
}

// ─────────────────────────── earning rules ───────────────────────────

/** End of a party: every human finish pays; trophies and a human win pay more. */
export function rewardParty(opts: { bestHumanTrophies: number; humanWon: boolean; rounds: number }): number {
  const base = 8 + Math.min(12, opts.rounds)
  return earnTickets(base + opts.bestHumanTrophies * 4 + (opts.humanWon ? 15 : 0), 'Party finished')
}

const PRACTICE_DAILY_CAP = 30

/**
 * Arcade practice: a little for a real attempt (daily cap), plus a one-time bonus per medal tier
 * per game. `earnest` = the score reached at least an Easy CPU's floor.
 */
export function rewardArcade(gameId: string, tier: 0 | 1 | 2 | 3, earnest = true): number {
  const d = load()
  const now = new Date()
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  if (d.practice.day !== today) d.practice = { day: today, paid: 0 }
  let total = 0
  if (earnest && d.practice.paid < PRACTICE_DAILY_CAP) {
    d.practice.paid += 2
    total += earnTickets(2, 'Practice round')
  }
  const bonus = [0, 5, 10, 20]
  for (let t = 1; t <= tier; t++) total += earnTickets(bonus[t], ['', 'Bronze medal', 'Silver medal', 'Gold medal'][t], `medal:${gameId}:${t}`)
  return total
}

export function rewardAchievement(id: string): number {
  return earnTickets(15, 'Achievement', `ach:${id}`)
}

/** Test/support hook: forget cached data (e.g. after storage is cleared). */
export function resetUnlockCache(): void {
  cache = null
}
