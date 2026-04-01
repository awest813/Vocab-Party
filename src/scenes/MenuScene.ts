import Phaser from 'phaser'
import { createButton } from '../ui/Button'

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

    // Layered gradient background
    this.add.rectangle(0, 0, w, h, 0x0d0d1f).setOrigin(0)
    this.add.rectangle(0, h * 0.55, w, h * 0.45, 0x11112a).setOrigin(0)

    this.createStars()

    // Decorative glow behind title
    const glow = this.add.ellipse(w / 2, 155, 700, 160, 0xffd700, 0.07)
    this.tweens.add({ targets: glow, scaleX: 1.1, scaleY: 1.2, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Title
    const title = this.add.text(w / 2, 145, '🎉 VOCAB PARTY! 🎉', {
      fontSize: '72px',
      fontFamily: 'Arial Black, Arial',
      color: '#FFD700',
      stroke: '#8B4500',
      strokeThickness: 8
    }).setOrigin(0.5)

    this.tweens.add({
      targets: title,
      y: 155,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Subtitle
    this.add.text(w / 2, 228, 'A Vocabulary & Grammar Party Game', {
      fontSize: '26px',
      fontFamily: 'Arial',
      color: '#aaddff',
      stroke: '#001133',
      strokeThickness: 3
    }).setOrigin(0.5)

    // Divider line
    const divider = this.add.graphics()
    divider.lineStyle(2, 0x334466, 0.8)
    divider.lineBetween(w / 2 - 280, 258, w / 2 + 280, 258)

    // Tile legend strip
    this.drawTileLegend(w, 295)

    // Second divider
    const divider2 = this.add.graphics()
    divider2.lineStyle(2, 0x334466, 0.8)
    divider2.lineBetween(w / 2 - 280, 340, w / 2 + 280, 340)

    // Buttons
    const startBtn = createButton(this, w / 2, 415, '▶  START GAME', 0x22bb55, 0x1a8844, 340, 64)
    startBtn.on('pointerdown', () => {
      this.cameras.main.flash(300, 255, 255, 255)
      this.time.delayedCall(300, () => this.scene.start('SetupScene'))
    })

    const howBtn = createButton(this, w / 2, 498, '❓  HOW TO PLAY', 0x5566ff, 0x3344cc, 340, 56)
    howBtn.on('pointerdown', () => this.showHowToPlay())

    // Info footer
    this.add.text(w / 2, 572, '2–4 Players  •  Turn-Based  •  10 Rounds', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#556677'
    }).setOrigin(0.5)

    // Floating emoji row
    const floatEmojis = ['🎲', '📚', '⭐', '🏆', '🎊', '📝', '🌟', '🎯']
    floatEmojis.forEach((e, i) => {
      const ex = this.add.text(80 + i * 160, h - 52, e, { fontSize: '32px' }).setOrigin(0.5)
      this.tweens.add({
        targets: ex,
        y: h - 65,
        duration: 1100 + i * 110,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    })
  }

  drawTileLegend(w: number, y: number) {
    const count = TILE_LEGEND.length
    const itemW = 140
    const startX = w / 2 - ((count - 1) * itemW) / 2

    TILE_LEGEND.forEach((tile, i) => {
      const x = startX + i * itemW

      const bg = this.add.rectangle(x, y + 18, 120, 38, tile.color, 0.25)
      bg.setStrokeStyle(1.5, tile.color, 0.7)

      this.add.text(x - 28, y + 18, tile.emoji, { fontSize: '20px' }).setOrigin(0.5)
      this.add.text(x + 14, y + 18, tile.label, {
        fontSize: '14px',
        fontFamily: 'Arial Black',
        color: '#ddddff'
      }).setOrigin(0, 0.5)
    })
  }

  createStars() {
    const w = this.scale.width
    const h = this.scale.height
    for (let i = 0; i < 70; i++) {
      const x = Phaser.Math.Between(0, w)
      const y = Phaser.Math.Between(0, h)
      const size = Phaser.Math.FloatBetween(0.8, 2.8)
      const star = this.add.circle(x, y, size, 0xffffff, Phaser.Math.FloatBetween(0.2, 0.9))
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.05, 0.35),
        duration: Phaser.Math.Between(700, 2800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2200),
        ease: 'Sine.easeInOut'
      })
    }
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

    const winText = this.add.text(w / 2, h / 2 + 190, '🏆  The player with the most points after 10 rounds wins!', {
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
