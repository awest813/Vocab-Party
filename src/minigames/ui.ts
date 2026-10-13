import Phaser from 'phaser'
import { Sfx } from '../systems/Sfx'
import { FONT } from '../ui/Theme'

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'reveal' | 'off'

export interface ChoiceTile extends Phaser.GameObjects.Container {
  setChoiceState(state: ChoiceState): void
  choiceIndex: number
}

const STATE_FILL: Record<ChoiceState, number> = {
  idle: 0x1b2942,
  correct: 0x1fae55,
  wrong: 0xc63b3b,
  reveal: 0x1f7a4a,
  off: 0x141c2c,
}

/**
 * Chunky answer tile with a key badge (1–4), hover lift and colored result states.
 * Lighter than `createButton` and sized for rapid-fire play.
 */
export function createChoiceTile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  badge: string,
  accent: number,
  onPick: () => void,
  /** Force a font size (so every answer in a question matches). */
  fontPx?: number,
): ChoiceTile {
  const c = scene.add.container(x, y) as ChoiceTile
  const g = scene.add.graphics()
  const r = Math.min(16, height / 2 - 2)
  let state: ChoiceState = 'idle'
  let hover = false

  const draw = () => {
    g.clear()
    const fill = state === 'idle' && hover ? Phaser.Display.Color.IntegerToColor(STATE_FILL.idle).lighten(12).color : STATE_FILL[state]
    g.fillStyle(0x000000, 0.35)
    g.fillRoundedRect(-width / 2 + 2, -height / 2 + 5, width, height, r)
    g.fillStyle(fill, 1)
    g.fillRoundedRect(-width / 2, -height / 2, width, height, r)
    g.fillStyle(0xffffff, state === 'off' ? 0.02 : 0.07)
    g.fillRoundedRect(-width / 2 + 4, -height / 2 + 3, width - 8, height * 0.4, { tl: r - 2, tr: r - 2, bl: 4, br: 4 })
    const edge = state === 'idle' ? accent : state === 'off' ? 0x2a3548 : 0xffffff
    g.lineStyle(state === 'idle' && hover ? 3.5 : 2.5, edge, state === 'idle' ? (hover ? 1 : 0.6) : 0.85)
    g.strokeRoundedRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, r)
    // badge
    g.fillStyle(state === 'idle' ? accent : 0x000000, state === 'idle' ? 1 : 0.25)
    g.fillRoundedRect(-width / 2 + 10, -14, 28, 28, 8)
  }

  const badgeText = scene.add.text(-width / 2 + 24, 0, badge, {
    fontSize: '16px', fontFamily: FONT.display, color: '#0a101c',
  }).setOrigin(0.5)

  const text = scene.add.text(14, 0, label, {
    fontSize: `${fontPx ?? choiceFontPx(label.length)}px`,
    fontFamily: FONT.display,
    color: '#ffffff',
    align: 'center',
    wordWrap: { width: width - 76 },
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5)

  const hit = scene.add.rectangle(0, 0, width, height, 0x000000, 0.001).setInteractive({ useHandCursor: true })
  hit.on('pointerover', () => { if (state === 'idle') { hover = true; draw(); Sfx.uiHover() } })
  hit.on('pointerout', () => { hover = false; draw() })
  hit.on('pointerdown', () => { if (state === 'idle') onPick() })

  c.add([g, badgeText, text, hit])
  c.setSize(width, height)
  c.choiceIndex = 0
  c.setChoiceState = (next: ChoiceState) => {
    state = next
    hover = false
    badgeText.setColor(state === 'idle' ? '#0a101c' : '#ffffff')
    text.setAlpha(state === 'off' ? 0.35 : 1)
    if (state !== 'idle') hit.disableInteractive()
    else hit.setInteractive({ useHandCursor: true })
    draw()
  }
  draw()
  return c
}

/** Font size that fits a choice label of this length in a standard tile. */
export function choiceFontPx(length: number): number {
  return length > 46 ? 18 : length > 26 ? 20 : 24
}

/** Floating "+1" style popup. */
export function popText(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, text: string, color: string, size = 34): void {
  const t = scene.add.text(x, y, text, {
    fontSize: `${size}px`, fontFamily: FONT.display, color, stroke: '#000000', strokeThickness: 6,
  }).setOrigin(0.5)
  if (parent) parent.add(t)
  else t.setDepth(200)
  scene.tweens.add({
    targets: t,
    y: y - 56,
    alpha: 0,
    scale: 1.25,
    duration: 760,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  })
}

/** Rounded card backdrop used for prompts. */
export function drawCard(
  scene: Phaser.Scene,
  width: number,
  height: number,
  accent: number,
  fill = 0x111a2e,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  g.fillStyle(0x000000, 0.4)
  g.fillRoundedRect(-width / 2 + 3, -height / 2 + 7, width, height, 20)
  // Accent cap: a rounded-top band, then the body drawn over all but its top 8px.
  // (A 20px corner radius on an 8px-tall rect renders far too tall in Phaser.)
  const r = Math.min(20, (height - 8) / 2)
  g.fillStyle(accent, 0.9)
  g.fillRoundedRect(-width / 2, -height / 2, width, Math.min(40, height), { tl: r, tr: r, bl: 0, br: 0 })
  g.fillStyle(fill, 0.96)
  g.fillRoundedRect(-width / 2, -height / 2 + 8, width, height - 8, { tl: 0, tr: 0, bl: r, br: r })
  g.lineStyle(2.5, accent, 0.55)
  g.strokeRoundedRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, 20)
  return g
}

export const KEY_TO_INDEX: Record<string, number> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
  Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3,
}
