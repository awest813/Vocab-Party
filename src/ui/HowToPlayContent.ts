/** Shared How-to-Play copy used by Menu and Pause. */

import { TILE_COLORS } from '../systems/SpriteFactory'

export type HowToTile = {
  emoji: string
  label: string
  desc: string
  color: number
}

export const HOW_TO_TILES: HowToTile[] = [
  { emoji: '🏠', label: 'Start', desc: 'Pass for +5 coins · land for +3 score/coins', color: TILE_COLORS.start },
  { emoji: '📖', label: 'Vocab', desc: 'Answer a vocabulary question (+10)', color: TILE_COLORS.vocab },
  { emoji: '✏️', label: 'Grammar', desc: 'Fix a grammar problem (+10)', color: TILE_COLORS.grammar },
  { emoji: '⭐', label: 'Bonus', desc: '+5 score, +4 coins (doubled in the Last Stretch)', color: TILE_COLORS.bonus },
  { emoji: '💀', label: 'Penalty', desc: 'Lose score and coins (shield blocks it)', color: TILE_COLORS.penalty },
  { emoji: '❓', label: 'Mystery', desc: 'Random surprise effect!', color: TILE_COLORS.mystery },
  { emoji: '🕹️', label: 'Duel', desc: '1-on-1 minigame — winner steals 6 coins', color: TILE_COLORS.minigame },
  { emoji: '🔄', label: 'Swap', desc: 'Trade board positions with a player', color: TILE_COLORS.swap },
  { emoji: '🏪', label: 'Shop', desc: 'Own it: rivals pay rent, +1 coin every round', color: TILE_COLORS.shop },
  { emoji: '🏆', label: 'Star', desc: '20 coins = a trophy (+12) · land on it or pass it', color: TILE_COLORS.star },
  { emoji: '🧱', label: 'Brick', desc: 'Collect pieces for build bonuses', color: TILE_COLORS.brick },
  { emoji: '🛍️', label: 'Item Shop', desc: 'Buy power-up cards for your turn', color: TILE_COLORS.item_shop },
]

export const HOW_TO_RULES = [
  '🎭 Setup: pick characters, one of 4 boards (G), a word level, and Quick / Classic / Full Map',
  '🎁 Head start: give a younger or newer player extra coins at the start and every round',
  '🎲 Roll to move — or switch to your character\'s special die (D / tap the die)',
  '📖 Vocab & grammar tiles ask questions for points',
  '🏆 Stars: land on OR walk past a star tile to buy — rich players can buy several at once',
  '🛍️ Item shops let you pick a card or pass · use ITEMS on your turn',
  '⚔️ Landing on another player starts a battle',
  '🎉 After each round everyone plays a vocab minigame — 1st place wins 6 coins + 10 points',
  '🔥 Last Stretch: final rounds double bonus/penalty tiles; last place gets a boost',
  '🌊 Thesaurus Tides: the tide turns every 3 rounds — low tide opens a sandbar shortcut',
  '🌟 Bonus Stars at the end: Word Wizard, Minigame Master, Explorer (+1 🏆 each)',
  '🎯 First to 5 trophies wins — or most trophies (then score) when rounds end',
  '💾 Autosave every turn · 📝 Word Lists play your own words · 🎟️ tickets buy cosmetics in the Shop',
]

export const HOW_TO_CONTROLS_DESKTOP = [
  'Board: Space / Enter / R = Roll · Esc = Pause · 1/2 = fork paths',
  'Questions: 1–4 or A–D · Minigames: see each game\'s rules card',
  'Shops & stars: 1 = buy · 2 or Esc = pass  ·  Item shop: 1–7 = pick a card · Esc = pass',
  'Item backpack: 1–7 use a card · Esc closes',
  'Battle: 1 = Defend · 2 = Evade',
]

export const HOW_TO_CONTROLS_TOUCH = [
  'Board: Tap ROLL / ITEMS · Tap ⏸️ to pause',
  'Questions & minigames: Tap an answer',
  'Shops & items: Tap Buy/Pass or pick a card',
  'Battle: Tap Defend or Evade',
  'Tap a board tile anytime to inspect it',
]

export const HOW_TO_INTRO =
  'Roll, race, and answer your way to 5 trophies. Every round ends in a vocab minigame — and the Minigame Arcade lets you practice any of them solo!'
