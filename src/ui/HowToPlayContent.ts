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
  { emoji: '⭐', label: 'Bonus', desc: 'Earn +5 score and +4 coins!', color: TILE_COLORS.bonus },
  { emoji: '💀', label: 'Penalty', desc: 'Lose score and coins (shield blocks it)', color: TILE_COLORS.penalty },
  { emoji: '❓', label: 'Mystery', desc: 'Random surprise effect!', color: TILE_COLORS.mystery },
  { emoji: '🕹️', label: 'Minigame', desc: 'Quick challenge — winner gets +15', color: TILE_COLORS.minigame },
  { emoji: '🔄', label: 'Swap', desc: 'Trade board positions with a player', color: TILE_COLORS.swap },
  { emoji: '🏪', label: 'Shop', desc: 'Buy shops to earn rent from rivals', color: TILE_COLORS.shop },
  { emoji: '🌟', label: 'Star', desc: 'Spend 20 coins for a trophy (+12 score)', color: TILE_COLORS.star },
  { emoji: '🧱', label: 'Brick', desc: 'Collect pieces for build bonuses', color: TILE_COLORS.brick },
  { emoji: '🛍️', label: 'Item Shop', desc: 'Buy power-up cards for your turn', color: TILE_COLORS.item_shop },
]

export const HOW_TO_RULES = [
  '🎭 Setup: tap a portrait to pick a character · choose Quick / Classic / Full Map',
  '🎲 Roll to move (tap ROLL, or Space / R on desktop)',
  '📖 Vocab & grammar tiles ask questions for points',
  '🌟 Star & 🏪 shop tiles: choose Buy or Pass when you land',
  '🛍️ Item shops let you pick a card or pass · use ITEMS on your turn',
  '⚔️ Landing on another player starts a battle',
  '🎯 First to 5 trophies wins — or most trophies (then score) when rounds end',
]

export const HOW_TO_CONTROLS_DESKTOP = [
  'Board: Space / Enter / R = Roll · Esc = Pause · 1/2 = fork paths',
  'Questions & minigames: 1–4 or A–D',
  'Shops & item cards: 1 = yes/buy · 2 or Esc = pass/cancel',
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
  'Take turns rolling and racing around the board. Answer questions, grab stars, and outplay your rivals!'
