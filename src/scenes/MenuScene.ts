import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { addStarfieldBackdrop } from '../ui/Starfield'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { isAutoSimMode } from '../systems/gameFlags'

const TILE_LEGEND = [
  { emoji: '📖', label: 'Vocab', color: 0x4488ff },
  { emoji: '✏️', label: 'Grammar', color: 0xff8844 },
  { emoji: '⭐', label: 'Bonus', color: 0xffdd00 },
  { emoji: '❓', label: 'Mystery', color: 0xaa44ff },
  { emoji: '🕹️', label: 'Minigame', color: 0xff44aa },
  { emoji: '🔄', label: 'Swap', color: 0x44ffaa },
]

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height

    // Deep space gradient
    this.add.rectangle(0, 0, w, h, 0x050510).setOrigin(0)
    
    // Ambient fog/glow (Flat for compatibility)
    this.add.rectangle(0, 0, w, h, 0x1a1a2e, 0.4).setOrigin(0)

    addStarfieldBackdrop(this, 0.5)
    this.createParallaxStars()

    // Cinematic Title
    const titleContainer = this.add.container(w / 2, 160)
    
    const titleGlow = this.add.ellipse(0, 0, 800, 200, 0xffd700, 0.05)
    
    const title = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#FFD700',
      strokeThickness: 12
    }).setOrigin(0.5)
    
    const titleOverlay = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: 'Arial Black, Arial',
      color: '#FFD700',
    }).setOrigin(0.5).setAlpha(0.8)

    titleContainer.add([titleGlow, title, titleOverlay])
    
    // Prestige Badge
    const badge = this.add.container(w / 2 + 320, 100)
    const bBg = this.add.polygon(0, 0, [0, -20, 100, -20, 120, 0, 100, 20, 0, 20], 0xffd700, 0.8)
    const bText = this.add.text(55, 0, 'PRESTIGE', { fontSize: '14px', fontFamily: 'Arial Black', color: '#000000' }).setOrigin(0.5)
    badge.add([bBg, bText]).setAngle(-15)
    this.tweens.add({ targets: badge, angle: -10, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    this.tweens.add({
      targets: titleContainer,
      y: 175,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.tweens.add({
      targets: titleOverlay,
      alpha: 0.4,
      duration: 1500,
      yoyo: true,
      repeat: -1
    })

    // Subtitle
    this.add.text(w / 2, 260, 'THE ULTIMATE COMPETITIVE LEARNING EXPERIENCE', {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#aaddff',
      letterSpacing: 4
    }).setOrigin(0.5).setAlpha(0.7)

    // Main Actions
    const startGlow = this.add.ellipse(w / 2, 420, 450, 120, 0x22bb55, 0.15).setDepth(0)
    this.tweens.add({ targets: startGlow, alpha: 0.05, scaleX: 1.1, scaleY: 1.1, duration: 1000, yoyo: true, repeat: -1 })

    const startBtn = createButton(this, w / 2, 420, '▶  ENTER PARTY', 0x22bb55, 0x1a8844, 400, 72)
    startBtn.on('pointerdown', () => {
      this.cameras.main.flash(500, 255, 255, 255)
      this.time.delayedCall(500, () => this.scene.start('SetupScene'))
    })

    const howBtn = createButton(this, w / 2, 510, '❓  HOW TO PLAY', 0x5566ff, 0x3344cc, 400, 60)
    howBtn.on('pointerdown', () => this.showHowToPlay())

    if (isAutoSimMode()) {
      this.scene.start('SetupScene')
    }

    // Version/Footer
    this.add.text(w / 2, h - 30, 'v2.0 PRESTIGE EDITION  •  PHASER 3 ENGINE', {
      fontSize: '14px',
      fontFamily: 'Arial Black',
      color: '#445577'
    }).setOrigin(0.5)

    // Floating particles
    for (let i = 0; i < 20; i++) {
      const p = this.add.text(Phaser.Math.Between(0, w), Phaser.Math.Between(h - 100, h), '✨', { fontSize: '16px' })
      this.tweens.add({
        targets: p,
        y: '-=200',
        alpha: 0,
        duration: Phaser.Math.Between(2000, 5000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 5000)
      })
    }
  }

  createParallaxStars() {
    const w = this.scale.width
    const h = this.scale.height
    
    const layers = [
      { count: 100, size: [1, 2], speed: 0.05, alpha: 0.3 },
      { count: 50, size: [2, 3], speed: 0.1, alpha: 0.6 },
      { count: 20, size: [3, 5], speed: 0.2, alpha: 0.9 }
    ]

    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        const x = Phaser.Math.Between(0, w)
        const y = Phaser.Math.Between(0, h)
        const s = Phaser.Math.FloatBetween(layer.size[0], layer.size[1])
        const star = this.add.circle(x, y, s, 0xffffff, layer.alpha)
        
        this.tweens.add({
          targets: star,
          x: `+=${w}`,
          duration: (w / layer.speed) * 10,
          repeat: -1,
          onRepeat: () => star.setX(-10)
        })
      }
    })
  }

  showHowToPlay() {
    const w = this.scale.width
    const h = this.scale.height

    const container = this.add.container(0, 0)

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setInteractive()
    const panel = this.add.rectangle(w / 2, h / 2, 780, 500, 0x141430)
    panel.setStrokeStyle(3, 0x6688cc)

    // Title
    const titleText = this.add.text(w / 2, h / 2 - 220, '🎲 HOW TO PLAY', {
      fontSize: '32px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#664400',
      strokeThickness: 5
    }).setOrigin(0.5)

    // Instructions
    const instrText = this.add.text(w / 2, h / 2 - 172, 'Take turns rolling the dice and moving around the board.', {
      fontSize: '17px',
      fontFamily: 'Arial',
      color: '#aabbdd',
      align: 'center'
    }).setOrigin(0.5)

    // Tile grid
    const tileItems = [
      { emoji: '📖', label: 'Vocab', desc: 'Answer a vocabulary question (+10)', color: 0x4488ff },
      { emoji: '✏️', label: 'Grammar', desc: 'Fix a grammar problem (+10)', color: 0xff8844 },
      { emoji: '⭐', label: 'Bonus', desc: 'Earn 5 bonus points automatically!', color: 0xffdd00 },
      { emoji: '❓', label: 'Mystery', desc: 'Random surprise effect!', color: 0xaa44ff },
      { emoji: '🕹️', label: 'Minigame', desc: 'Everyone plays, winner gets +15', color: 0xff44aa },
      { emoji: '🔄', label: 'Swap', desc: 'Trade board positions with a player', color: 0x44ffaa },
    ]

    const cols = 2
    const itemW = 340
    const itemH = 56
    const gridX = w / 2 - itemW - 10
    const gridStartY = h / 2 - 120

    const tileObjects: Phaser.GameObjects.GameObject[] = []
    tileItems.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = gridX + col * (itemW + 20)
      const y = gridStartY + row * (itemH + 10)

      const bg = this.add.rectangle(x + itemW / 2, y + itemH / 2, itemW, itemH, item.color, 0.15)
      bg.setStrokeStyle(1.5, item.color, 0.6)
      const emojiT = this.add.text(x + 10, y + itemH / 2, item.emoji, { fontSize: '24px' }).setOrigin(0, 0.5)
      const labelT = this.add.text(x + 46, y + itemH / 2 - 9, item.label, {
        fontSize: '15px', fontFamily: 'Arial Black', color: '#eeeeff'
      }).setOrigin(0, 0.5)
      const descT = this.add.text(x + 46, y + itemH / 2 + 10, item.desc, {
        fontSize: '12px', fontFamily: 'Arial', color: '#9999bb'
      }).setOrigin(0, 0.5)
      tileObjects.push(bg, emojiT, labelT, descT)
    })

    const winText = this.add.text(w / 2, h / 2 + 190, '🏆  Most points wins (round count is set in setup; solo play is supported).', {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#443300',
      strokeThickness: 3
    }).setOrigin(0.5)

    const closeBtn = createButton(this, w / 2, h / 2 + 232, '✕  CLOSE', 0xdd3333, 0xaa2222, 200, 48)

    container.add([overlay, panel, titleText, instrText, ...tileObjects, winText, closeBtn])

    const destroy = () => container.destroy(true)
    closeBtn.on('pointerdown', destroy)
    overlay.on('pointerdown', destroy)

    panel.setScale(0.85)
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, duration: 250, ease: 'Back.easeOut' })
  }
}
