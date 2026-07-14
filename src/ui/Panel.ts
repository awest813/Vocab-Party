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

/** Soft edge vignette for menu / modal depth. */
export function addVignette(
  scene: Phaser.Scene,
  strength = 0.55,
  depth = -4
): Phaser.GameObjects.Graphics {
  const w = scene.scale.width
  const h = scene.scale.height
  const g = scene.add.graphics().setDepth(depth)
  const steps = 10
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const inset = t * Math.min(w, h) * 0.22
    g.fillStyle(0x000000, strength * (1 - t) * 0.12)
    g.fillRect(inset, inset, w - inset * 2, h - inset * 2)
  }
  // Darker corners via overlapping edge bands
  g.fillStyle(0x000000, strength * 0.35)
  g.fillRect(0, 0, w, h * 0.08)
  g.fillRect(0, h * 0.92, w, h * 0.08)
  g.fillRect(0, 0, w * 0.06, h)
  g.fillRect(w * 0.94, 0, w * 0.06, h)
  return g
}

/** Warm floor spotlight under hero content. */
export function addFloorGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width = 520,
  color = COLORS.gold,
  alpha = 0.14
): Phaser.GameObjects.Ellipse {
  return scene.add
    .ellipse(x, y, width, Math.max(36, width * 0.12), color, alpha)
    .setDepth(-3)
}

/** Nested inset plate used inside setup / pause layouts. */
export function createInsetPlate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { fill?: number; fillAlpha?: number; border?: number; borderAlpha?: number; radius?: number } = {}
): Phaser.GameObjects.Graphics {
  const {
    fill = COLORS.bgPanelAlt,
    fillAlpha = 0.72,
    border = COLORS.strokeSoft,
    borderAlpha = 0.12,
    radius = 14,
  } = opts
  const g = scene.add.graphics()
  g.fillStyle(0x000000, 0.22)
  g.fillRoundedRect(x - width / 2 + 2, y - height / 2 + 3, width, height, radius)
  g.fillStyle(fill, fillAlpha)
  g.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  g.fillStyle(0xffffff, 0.04)
  g.fillRoundedRect(x - width / 2 + 3, y - height / 2 + 2, width - 6, Math.min(18, height / 5), {
    tl: radius - 2, tr: radius - 2, bl: 3, br: 3,
  })
  g.lineStyle(1.5, border, borderAlpha)
  g.strokeRoundedRect(x - width / 2 + 0.5, y - height / 2 + 0.5, width - 1, height - 1, radius)
  return g
}

export function accentLabel(color: number): string {
  return hexColor(color)
}
