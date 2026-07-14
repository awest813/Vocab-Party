import Phaser from 'phaser'
import { COLORS, DEPTH, FONT, hexColor } from './Theme'

export interface PanelOptions {
  x: number
  y: number
  width: number
  height: number
  fill?: number
  fillAlpha?: number
  border?: number
  borderAlpha?: number
  radius?: number
  shadow?: boolean
  headerColor?: number
  headerHeight?: number
  title?: string
  titleColor?: string
  depth?: number
  animateIn?: boolean
}

/**
 * Rounded glass panel with optional header bar — shared chrome for menus/modals.
 */
export function createPanel(scene: Phaser.Scene, opts: PanelOptions): Phaser.GameObjects.Container {
  const {
    x, y, width, height,
    fill = COLORS.bgPanel,
    fillAlpha = 0.92,
    border = COLORS.sky,
    borderAlpha = 0.55,
    radius = 16,
    shadow = true,
    headerColor,
    headerHeight = 0,
    title,
    titleColor = '#ffffff',
    depth = DEPTH.modal,
    animateIn = true,
  } = opts

  const container = scene.add.container(x, y).setDepth(depth)
  const g = scene.add.graphics()

  if (shadow) {
    g.fillStyle(0x000000, 0.35)
    g.fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, radius)
  }

  g.fillStyle(fill, fillAlpha)
  g.fillRoundedRect(-width / 2, -height / 2, width, height, radius)

  // Soft inner top highlight
  g.fillStyle(0xffffff, 0.06)
  g.fillRoundedRect(-width / 2 + 4, -height / 2 + 3, width - 8, Math.min(28, height / 4), {
    tl: radius - 2, tr: radius - 2, bl: 4, br: 4,
  })

  g.lineStyle(2.5, border, borderAlpha)
  g.strokeRoundedRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius)

  container.add(g)

  if (headerColor && headerHeight > 0) {
    const hg = scene.add.graphics()
    hg.fillStyle(headerColor, 0.9)
    hg.fillRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, headerHeight, {
      tl: radius - 2, tr: radius - 2, bl: 0, br: 0,
    })
    hg.fillStyle(0xffffff, 0.12)
    hg.fillRect(-width / 2 + 10, -height / 2 + 4, width - 20, 3)
    container.add(hg)
  }

  if (title) {
    const titleY = headerHeight > 0
      ? -height / 2 + headerHeight / 2 + 1
      : -height / 2 + 28
    const t = scene.add.text(0, titleY, title, {
      fontSize: '22px',
      fontFamily: FONT.display,
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5)
    container.add(t)
  }

  if (animateIn) {
    container.setScale(0.88).setAlpha(0)
    scene.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 320,
      ease: 'Back.easeOut',
    })
  }

  return container
}

/** Full-screen dimmer that blocks input behind modals. */
export function createDimmer(
  scene: Phaser.Scene,
  alpha = 0.62,
  interactive = true
): Phaser.GameObjects.Rectangle {
  const w = scene.scale.width
  const h = scene.scale.height
  const dim = scene.add.rectangle(0, 0, w, h, COLORS.bgOverlay, alpha)
    .setOrigin(0)
    .setDepth(DEPTH.modal - 1)
  if (interactive) dim.setInteractive()
  return dim
}

/** Vertical gradient-ish stage wash using stacked rects (WebGL-safe). */
export function paintStage(scene: Phaser.Scene, options?: {
  topColor?: number
  bottomColor?: number
  midAlpha?: number
}): void {
  const w = scene.scale.width
  const h = scene.scale.height
  const top = options?.topColor ?? COLORS.bgDeep
  const bottom = options?.bottomColor ?? COLORS.bgMid
  const midAlpha = options?.midAlpha ?? 0.45

  scene.add.rectangle(0, 0, w, h, top).setOrigin(0).setDepth(-20)
  scene.add.rectangle(0, h * 0.35, w, h * 0.65, bottom, midAlpha).setOrigin(0).setDepth(-19)
  // Soft teal floor wash for party atmosphere
  scene.add.rectangle(0, h * 0.72, w, h * 0.28, COLORS.teal, 0.05).setOrigin(0).setDepth(-18)
}

export function accentLabel(color: number): string {
  return hexColor(color)
}
