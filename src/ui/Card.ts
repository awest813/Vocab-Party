import Phaser from 'phaser'
import { COLORS, FONT } from './Theme'

export interface CardConfig {
  x: number
  y: number
  width: number
  height: number
  fillColor?: number
  fillAlpha?: number
  borderColor?: number
  borderWidth?: number
  shadowAlpha?: number
  shadowOffsetY?: number
  headerColor?: number
  headerHeight?: number
  headerTitle?: string
  headerTitleColor?: string
  radius?: number
  depth?: number
  animateIn?: boolean
  origin?: [number, number]
}

export function createCard(scene: Phaser.Scene, cfg: CardConfig): Phaser.GameObjects.Container {
  const {
    x, y, width, height,
    fillColor = COLORS.bgPanel, fillAlpha = 0.92,
    borderColor = COLORS.sky, borderWidth = 2.5,
    shadowAlpha = 0.3, shadowOffsetY = 6,
    headerColor, headerHeight = 0,
    headerTitle, headerTitleColor = '#ffffff',
    radius = 14,
    depth = 10,
    animateIn = true,
  } = cfg

  const container = scene.add.container(x, y).setDepth(depth)
  const g = scene.add.graphics()

  g.fillStyle(0x000000, shadowAlpha)
  g.fillRoundedRect(-width / 2, -height / 2 + shadowOffsetY, width, height, radius)

  g.fillStyle(fillColor, fillAlpha)
  g.fillRoundedRect(-width / 2, -height / 2, width, height, radius)

  g.fillStyle(0xffffff, 0.06)
  g.fillRoundedRect(-width / 2 + 4, -height / 2 + 3, width - 8, Math.min(24, height / 5), {
    tl: radius - 2, tr: radius - 2, bl: 4, br: 4,
  })

  g.lineStyle(borderWidth, borderColor, 0.65)
  g.strokeRoundedRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius)

  container.add(g)

  if (headerColor) {
    const hg = scene.add.graphics()
    const hh = headerHeight || 36
    hg.fillStyle(headerColor, 0.9)
    hg.fillRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, hh, {
      tl: radius - 2, tr: radius - 2, bl: 0, br: 0,
    })
    hg.fillStyle(0xffffff, 0.12)
    hg.fillRect(-width / 2 + 8, -height / 2 + 3, width - 16, 3)
    container.add(hg)
  }

  if (headerTitle) {
    const hh = headerHeight || 36
    const titleText = scene.add.text(0, -height / 2 + hh / 2, headerTitle, {
      fontSize: '18px',
      fontFamily: FONT.display,
      color: headerTitleColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5)
    container.add(titleText)
  }

  if (animateIn) {
    container.setScale(0.88).setAlpha(0)
    scene.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 360,
      ease: 'Back.easeOut',
    })
  }

  return container
}
