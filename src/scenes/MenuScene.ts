import Phaser from 'phaser'
import { createButton } from '../ui/Button'

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height

    // Animated gradient background using rectangles
    this.add.rectangle(0, 0, w, h, 0x1a1a2e).setOrigin(0)
    this.add.rectangle(0, h * 0.6, w, h * 0.4, 0x16213e).setOrigin(0)

    // Floating star particles
    this.createStars()

    // Title with big bounce
    const title = this.add.text(w / 2, 150, '🎉 VOCAB PARTY! 🎉', {
      fontSize: '72px',
      fontFamily: 'Arial Black, Arial',
      color: '#FFD700',
      stroke: '#cc6600',
      strokeThickness: 8
    }).setOrigin(0.5)

    this.tweens.add({
      targets: title,
      y: 160,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Subtitle
    this.add.text(w / 2, 240, 'A Vocabulary & Grammar Party Game', {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#aaddff',
      stroke: '#003366',
      strokeThickness: 4
    }).setOrigin(0.5)

    // Start button
    const startBtn = createButton(this, w / 2, 370, '▶  START GAME', 0x22bb55, 0x1a8844)
    startBtn.on('pointerdown', () => {
      this.cameras.main.flash(300, 255, 255, 255)
      this.time.delayedCall(300, () => this.scene.start('BoardScene'))
    })

    // How to play
    const howBtn = createButton(this, w / 2, 460, '❓  HOW TO PLAY', 0x5566ff, 0x3344cc)
    howBtn.on('pointerdown', () => this.showHowToPlay())

    // Player count label
    this.add.text(w / 2, 560, '4 Players  •  Turn-Based  •  Vocabulary & Grammar', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#888899'
    }).setOrigin(0.5)

    // Decorative emoji row
    const emojis = ['🎲', '📚', '⭐', '🏆', '🎊', '📝', '🌟', '🎯']
    emojis.forEach((e, i) => {
      const ex = this.add.text(80 + i * 160, h - 60, e, { fontSize: '36px' }).setOrigin(0.5)
      this.tweens.add({
        targets: ex,
        y: h - 75,
        duration: 1000 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    })
  }

  createStars() {
    const w = this.scale.width
    const h = this.scale.height
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, w)
      const y = Phaser.Math.Between(0, h * 0.7)
      const size = Phaser.Math.FloatBetween(1, 3)
      const star = this.add.circle(x, y, size, 0xffffff, Phaser.Math.FloatBetween(0.3, 1.0))
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.1, 0.5),
        duration: Phaser.Math.Between(800, 2500),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
        ease: 'Sine.easeInOut'
      })
    }
  }

  showHowToPlay() {
    const w = this.scale.width
    const h = this.scale.height
    const panel = this.add.rectangle(w / 2, h / 2, 700, 420, 0x222244, 0.97)
    panel.setStrokeStyle(4, 0x88aaff)
    const text = [
      '🎲 HOW TO PLAY',
      '',
      '• Players take turns rolling the dice',
      '• Move along the board and land on tiles:',
      '  📖 Vocab — Answer a vocabulary question',
      '  ✏️ Grammar — Fix a grammar problem',
      '  ⭐ Bonus — Earn extra points!',
      '  ❓ Mystery — Surprise effect',
      '  🕹️ Minigame — Everyone plays!',
      '  🔄 Swap — Trade places with another player',
      '',
      '• Most points wins the trophy! 🏆',
    ].join('\n')
    const t = this.add.text(w / 2, h / 2, text, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#eeeeff',
      lineSpacing: 8,
      align: 'left'
    }).setOrigin(0.5)
    const closeBtn = createButton(this, w / 2, h / 2 + 200, '✕  CLOSE', 0xdd3333, 0xaa2222)
    closeBtn.on('pointerdown', () => { panel.destroy(); t.destroy(); closeBtn.destroy() })
  }
}
