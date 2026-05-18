import Phaser from 'phaser'

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
    fillColor = 0x0f1a2e, fillAlpha = 0.88,
    borderColor = 0x4488ff, borderWidth = 3,
    shadowAlpha = 0.2, shadowOffsetY = 4,
    headerColor, headerHeight = 0,
    headerTitle, headerTitleColor = '#ffffff',
    radius = 12,
    depth = 10,
    animateIn = true,
    origin = [0.5, 0.5],
  } = cfg

  const container = scene.add.container(x, y).setDepth(depth)

  const g = scene.add.graphics()

  // Shadow
  g.fillStyle(0x000000, shadowAlpha)
  g.fillRoundedRect(-width / 2, -height / 2 + shadowOffsetY, width, height, radius)

  // Card body
  g.fillStyle(fillColor, fillAlpha)
  g.fillRoundedRect(-width / 2, -height / 2, width, height, radius)

  // Border
  g.lineStyle(borderWidth, borderColor, borderColor ? 0.7 : 0)
  g.strokeRoundedRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius)

  container.add(g)

  // Header accent bar
  if (headerColor) {
    const hg = scene.add.graphics()
    hg.fillStyle(headerColor, 0.85)
    hg.beginPath()
    hg.moveTo(-width / 2 + radius, -height / 2)
    hg.lineTo(width / 2 - radius, -height / 2)
    hg.lineTo(width / 2, -height / 2 + radius)
    hg.lineTo(width / 2, -height / 2 + headerHeight)
    hg.lineTo(-width / 2, -height / 2 + headerHeight)
    hg.lineTo(-width / 2, -height / 2 + radius)
    hg.closePath()
    hg.fillPath()

    // Header shine line
    hg.fillStyle(0xffffff, 0.12)
    hg.fillRect(-width / 2 + 8, -height / 2 + 2, width - 16, 3)

    container.add(hg)
  }

  // Header title text
  if (headerTitle) {
    const titleText = scene.add.text(0, -height / 2 + headerHeight / 2, headerTitle, {
      fontSize: '20px',
      fontFamily: 'Fredoka, Arial Black, Arial',
      color: headerTitleColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5)
    container.add(titleText)
  }

  // Animated entry
  if (animateIn) {
    container.setScale(0.85).setAlpha(0)
    scene.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
    })
  }

  return container
}


