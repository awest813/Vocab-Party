/** Shared How-to-Play copy used by Menu and Pause. */

export type HowToTile = {
  emoji: string
  label: string
  desc: string
  color: number
}

export const HOW_TO_TILES: HowToTile[] = [
  { emoji: '📖', label: 'Vocab', desc: 'Answer a vocabulary question (+10)', color: 0x4488ff },
  { emoji: '✏️', label: 'Grammar', desc: 'Fix a grammar problem (+10)', color: 0xff8844 },
  { emoji: '⭐', label: 'Bonus', desc: 'Earn 5 bonus points automatically!', color: 0xffdd00 },
  { emoji: '❓', label: 'Mystery', desc: 'Random surprise effect!', color: 0xaa44ff },
  { emoji: '🕹️', label: 'Minigame', desc: 'Quick challenge — winner gets +15', color: 0xff44aa },
  { emoji: '🔄', label: 'Swap', desc: 'Trade board positions with a player', color: 0x44ffaa },
]

export const HOW_TO_RULES = [
  '🎲 Roll to move (tap ROLL, or Space / R on desktop)',
  '📖 Vocab & grammar tiles ask questions for points',
  '🌟 Star tiles: spend 20 coins for a trophy (+12 score)',
  '🏪 Buy shops to earn rent · 🛍️ Item shops stock power-ups',
  '⚔️ Landing on another player starts a battle',
  '🎯 First to 5 trophies wins · most points break ties',
]

export const HOW_TO_CONTROLS_DESKTOP = [
  'Board: Space / Enter / R = Roll · Esc = Pause',
  'Questions & minigames: 1–4 or A–D',
  'Battle: 1 = Defend · 2 = Evade',
]

export const HOW_TO_CONTROLS_TOUCH = [
  'Board: Tap ROLL / ITEMS · Tap ⏸️ to pause',
  'Questions & minigames: Tap an answer',
  'Battle: Tap Defend or Evade',
  'Tap a board tile anytime to inspect it',
]

export const HOW_TO_INTRO =
  'Take turns rolling and racing around the board. Answer questions, grab stars, and outplay your rivals!'
