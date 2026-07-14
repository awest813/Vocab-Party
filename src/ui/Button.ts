import Phaser from 'phaser'
import { COLORS, FONT } from './Theme'
import { Sfx } from '../systems/Sfx'

export interface ButtonOptions {
  width?: number
  height?: number
  fillColor?: number
  hoverColor?: number
  fontSize?: string
  depth?: number
}

/**
 * Arcade-style beveled button with hover lift and press squash.
 * Expanded hit padding improves touch targets on small screens.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  fillColor: number = COLORS.skyDeep,
  hoverColor: number = 0x1e5a96,
  width: number = 320,
  height: number = 60
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)
  const radius = Math.min(14, height / 2 - 2)
  const bevel = Math.max(4, Math.round(height * 0.12))
  // Larger invisible hit area helps touch targets on small screens.
  const hitPad = Math.max(8, Math.round((72 - height) / 2))
  let currentFill = fillColor
  let currentHover = hoverColor

  const g = scene.add.graphics()
  const draw = (fill: number, pressed = false) => {
    g.clear()
    const yOff = pressed ? bevel - 1 : 0
    const faceH = height - bevel

    g.fillStyle(0x000000, 0.35)
    g.fillRoundedRect(-width / 2 + 2, -height / 2 + bevel + 2, width, faceH, radius)

    const bevelCol = Phaser.Display.Color.IntegerToColor(fill)
    bevelCol.darken(18)
    g.fillStyle(bevelCol.color, 1)
    g.fillRoundedRect(-width / 2, -height / 2 + yOff + (pressed ? 0 : bevel * 0.35), width, faceH + bevel * 0.65, radius)

    g.fillStyle(fill, 1)
    g.fillRoundedRect(-width / 2, -height / 2 + yOff, width, faceH, radius)

    g.fillStyle(0xffffff, 0.22)
    g.fillRoundedRect(-width / 2 + 5, -height / 2 + yOff + 3, width - 10, faceH * 0.38, {
      tl: radius - 2, tr: radius - 2, bl: 4, br: 4,
    })

    g.lineStyle(2.5, 0xffffff, 0.45)
    g.strokeRoundedRect(-width / 2 + 1, -height / 2 + yOff + 1, width - 2, faceH - 2, radius)
  }

  draw(currentFill)

  const hit = scene.add.rectangle(0, 0, width, height, 0x000000, 0.001)
  hit.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle(
      -width / 2 - hitPad,
      -height / 2 - hitPad,
      width + hitPad * 2,
      height + hitPad * 2
    ),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  })

  const text = scene.add.text(0, -bevel / 2, label, {
    fontSize: height >= 64 ? '24px' : height >= 52 ? '20px' : '18px',
    fontFamily: FONT.display,
    color: '#ffffff',
    stroke: '#102018',
    strokeThickness: 2,
  }).setOrigin(0.5)

  container.add([g, hit, text])

  let enabled = true
  let hovered = false

  const applyIdle = () => {
    draw(hovered ? currentHover : currentFill, false)
    text.setY(-bevel / 2)
  }

  const enableHit = () => {
    hit.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(
        -width / 2 - hitPad,
        -height / 2 - hitPad,
        width + hitPad * 2,
        height + hitPad * 2
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    })
  }

  hit.on('pointerover', () => {
    if (!enabled) return
    hovered = true
    draw(currentHover, false)
    scene.tweens.killTweensOf(container)
    scene.tweens.add({
      targets: container,
      scaleX: 1.05, scaleY: 1.05,
      duration: 140,
      ease: 'Cubic.easeOut',
    })
    Sfx.uiHover()
  })

  hit.on('pointerout', () => {
    hovered = false
    if (!enabled) return
    applyIdle()
    scene.tweens.killTweensOf(container)
    scene.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1,
      duration: 140,
      ease: 'Cubic.easeOut',
    })
  })

  hit.on('pointerdown', () => {
    if (!enabled) return
    Sfx.uiClick()
    draw(currentHover, true)
    text.setY(bevel * 0.15)
    scene.tweens.killTweensOf(container)
    scene.tweens.add({
      targets: container,
      scaleX: 0.96, scaleY: 0.96,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        if (enabled) applyIdle()
      },
    })
    container.emit('pointerdown')
  })

  ;(container as any).setEnabled = (on: boolean) => {
    enabled = on
    if (on) {
      enableHit()
      container.setAlpha(1)
      applyIdle()
    } else {
      hit.disableInteractive()
      hovered = false
      scene.tweens.killTweensOf(container)
      container.setScale(1)
      draw(currentFill, false)
      text.setY(-bevel / 2)
      container.setAlpha(0.4)
    }
  }

  ;(container as any).setFillColor = (color: number) => {
    currentFill = color
    currentHover = color
    draw(color, false)
  }

  ;(container as any).setLabel = (next: string) => {
    text.setText(next)
  }

  return container
}

/** Recolor a button created by `createButton` (used for correct/wrong feedback). */
export function setButtonFill(btn: Phaser.GameObjects.Container, color: number): void {
  const fn = (btn as any).setFillColor as ((c: number) => void) | undefined
  fn?.(color)
}

/** Enable/disable a button created by `createButton`. */
export function setButtonEnabled(btn: Phaser.GameObjects.Container, on: boolean): void {
  const fn = (btn as any).setEnabled as ((on: boolean) => void) | undefined
  fn?.(on)
}

/** Update label text on a button created by `createButton`. */
export function setButtonLabel(btn: Phaser.GameObjects.Container, label: string): void {
  const fn = (btn as any).setLabel as ((next: string) => void) | undefined
  fn?.(label)
}
