export function rollDice(sides = 6): number {
  return Math.floor(Math.random() * sides) + 1
}

/** Mario Party–style "block" die — small movement, big swings. */
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

/** The standard block die everyone can use (1–3, average 2). */
export const STANDARD_DIE: DieDef = {
  name: 'Block',
  emoji: '🎲',
  faces: [f(1), f(2), f(3), f(1), f(2), f(3)],
  hint: 'Reliable 1–3.',
}

/**
 * Character dice (Super Mario Party style). Every die averages about 2 spaces so
 * none is strictly better — they trade reliability for range or coins.
 * Indexed like CHARACTER_DEFS.
 */
export const CHARACTER_DICE: DieDef[] = [
  { name: 'Lucky Block', emoji: '🎉', faces: [f(0, 3), f(1), f(2), f(2), f(3), f(4)], hint: 'Anything can happen — even a 4.' },
  { name: 'Arcane Block', emoji: '🧙', faces: [f(0, 2), f(1), f(1), f(3), f(3), f(4)], hint: 'Low or high, rarely in between.' },
  { name: 'Steady Block', emoji: '🛡️', faces: [f(1), f(2), f(2), f(2), f(2), f(3)], hint: 'Almost always 2. Plan your landing.' },
  { name: 'Plunder Block', emoji: '🏴‍☠️', faces: [f(0, 4), f(0, 4), f(2), f(3), f(3), f(4)], hint: 'Stay and loot 4 coins, or sail far.' },
  { name: 'Shadow Block', emoji: '🥷', faces: [f(0, -2), f(0, -2), f(0, 2), f(4), f(4), f(4)], hint: 'All or nothing: 4 spaces or none.' },
  { name: 'Trail Block', emoji: '🏹', faces: [f(1, 2), f(1, 2), f(2), f(2), f(3), f(3)], hint: 'Short steps pay 2 coins.' },
  { name: 'Calibrated Block', emoji: '🤖', faces: [f(1), f(1), f(1), f(3), f(3), f(3)], hint: 'Exactly 1 or exactly 3.' },
  { name: 'Royal Block', emoji: '👑', faces: [f(1, 2), f(1, 2), f(2), f(2), f(2), f(4)], hint: 'Coins on 1s, and a royal 4.' },
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
