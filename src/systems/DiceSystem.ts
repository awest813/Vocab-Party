export function rollDice(sides = 6): number {
  return Math.floor(Math.random() * sides) + 1
}

/** Small 1–3 roll used by the Dash card's bonus move. */
export function rollBlockDie(): number {
  return rollDice(3)
}

/** One face of a die: how far you move, plus optional coins gained (or lost). */
export interface DieFace {
  move: number
  coins?: number
}

export interface DieDef {
  name: string
  emoji: string
  faces: DieFace[]
  /** One-line strategy hint for setup / tooltips. */
  hint: string
}

const f = (move: number, coins?: number): DieFace => (coins ? { move, coins } : { move })

/** The standard die everyone can use (1–6, average 3.5). */
export const STANDARD_DIE: DieDef = {
  name: 'Block',
  emoji: '🎲',
  faces: [f(1), f(2), f(3), f(4), f(5), f(6)],
  hint: 'Classic 1–6.',
}

/**
 * Character dice (Super Mario Party style). They trade reliability for range or coins and are
 * tuned by simulation so each wins about as often as the standard die (avg move 3.3–3.8).
 * Indexed like CHARACTER_DEFS.
 */
export const CHARACTER_DICE: DieDef[] = [
  { name: 'Lucky Block', emoji: '🎉', faces: [f(0, 4), f(2, 1), f(3), f(4), f(5), f(7)], hint: 'Anything can happen — even a 7.' },
  { name: 'Arcane Block', emoji: '🧙', faces: [f(0, 3), f(1, 1), f(2), f(5), f(6), f(7)], hint: 'Low or high, rarely in between.' },
  { name: 'Steady Block', emoji: '🛡️', faces: [f(3, 1), f(3, 1), f(3), f(4), f(4), f(4)], hint: 'Always 3 or 4 — some 3s pay a coin.' },
  { name: 'Plunder Block', emoji: '🏴‍☠️', faces: [f(0, 4), f(1, 1), f(3), f(5), f(6), f(6)], hint: 'Stay and loot 4 coins, or sail far.' },
  { name: 'Shadow Block', emoji: '🥷', faces: [f(0, 3), f(1, 1), f(4), f(5), f(5), f(6)], hint: 'Lie low for coins, then strike far.' },
  { name: 'Trail Block', emoji: '🏹', faces: [f(2, 1), f(2, 1), f(3), f(4), f(5), f(5)], hint: 'Short steps pay a coin.' },
  { name: 'Calibrated Block', emoji: '🤖', faces: [f(2), f(2), f(2), f(5), f(5), f(5)], hint: 'Exactly 2 or exactly 5.' },
  { name: 'Royal Block', emoji: '👑', faces: [f(1, 2), f(2), f(3), f(4), f(4), f(6)], hint: 'A 1 pays 2 coins, and never a zero.' },
]

export function characterDie(characterIndex: number): DieDef {
  const n = CHARACTER_DICE.length
  return CHARACTER_DICE[((characterIndex % n) + n) % n]
}

export function rollDie(die: DieDef): DieFace {
  return die.faces[Math.floor(Math.random() * die.faces.length)]
}

export function maxMove(die: DieDef): number {
  return Math.max(...die.faces.map(x => x.move))
}

/** Compact face list for UI, e.g. "0+3 1 2 2 3 4". */
export function faceSummary(die: DieDef): string {
  return die.faces
    .map(x => (x.coins ? `${x.move}${x.coins > 0 ? '+' : ''}${x.coins}🪙` : String(x.move)))
    .join(' · ')
}
