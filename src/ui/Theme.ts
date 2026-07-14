/**
 * Shared visual language for Vocab Party.
 * Carnival board-game look: deep ink stage, teal accents, warm gold highlights.
 */

export const COLORS = {
  // Stage
  bgDeep: 0x070b14,
  bgMid: 0x10182a,
  bgPanel: 0x121c30,
  bgPanelAlt: 0x182438,
  bgWash: 0x0e1a28,
  bgOverlay: 0x03060c,

  // Accents
  gold: 0xf4c430,
  goldDeep: 0xc49212,
  teal: 0x2ec4b6,
  tealDeep: 0x1a8f86,
  sky: 0x5eb7ff,
  skyDeep: 0x2a6fb0,
  coral: 0xff6b6b,
  mint: 0x44dd88,
  danger: 0xe84a4a,
  warning: 0xff9f1c,

  // Neutrals
  ink: 0x0a101c,
  mist: 0xa8bdd4,
  frost: 0xe8f2ff,
  mute: 0x6a7f99,
  strokeSoft: 0xffffff,

  // Players
  player: [0xff5c5c, 0x5c8cff, 0x44dd77, 0xffd24a] as const,
} as const

export const PLAYER_HEX = ['#ff5c5c', '#5c8cff', '#44dd77', '#ffd24a'] as const

export const FONT = {
  display: 'Fredoka, Arial Black, Arial',
  body: 'Fredoka, Arial',
} as const

export const DEPTH = {
  backdrop: -10,
  board: 0,
  tokens: 10,
  hud: 20,
  chrome: 30,
  modal: 50,
  banner: 100,
  fx: 120,
} as const

export function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

export function textStyle(
  size: number | string,
  color: string = '#ffffff',
  opts: {
    stroke?: string
    strokeThickness?: number
    align?: string
    wordWrap?: number
    letterSpacing?: number
  } = {}
): Phaser.Types.GameObjects.Text.TextStyle {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontSize: typeof size === 'number' ? `${size}px` : size,
    fontFamily: FONT.display,
    color,
  }
  if (opts.stroke) style.stroke = opts.stroke
  if (opts.strokeThickness !== undefined) style.strokeThickness = opts.strokeThickness
  if (opts.align) style.align = opts.align
  if (opts.wordWrap) style.wordWrap = { width: opts.wordWrap }
  if (opts.letterSpacing !== undefined) (style as any).letterSpacing = opts.letterSpacing
  return style
}
