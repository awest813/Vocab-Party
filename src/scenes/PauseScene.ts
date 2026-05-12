import Phaser from 'phaser'
import { createButton } from '../ui/Button'

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene')
  }

  create() {
    const w = this.scale.width
    const h = this.scale.height

    // Semi-transparent backdrop
    this.add.rectangle(0, 0, w, h, 0x050510, 0.7).setOrigin(0)
    
    // Glassmorphic Panel
    const panel = this.add.container(w / 2, h / 2)
    const bg = this.add.rectangle(0, 0, 400, 320, 0x1a2a4a, 0.85)
    bg.setStrokeStyle(4, 0x4488ff, 0.6)
    
    const title = this.add.text(0, -110, '⏸️ PAUSED', {
      fontSize: '42px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5)

    const resumeBtn = createButton(this, 0, -20, 'RESUME', 0x22bb55, 0x1a8844, 300, 50)
    resumeBtn.on('pointerdown', () => {
      this.scene.resume('BoardScene')
      this.scene.stop()
    })

    const quitBtn = createButton(this, 0, 50, 'QUIT TO MENU', 0xaa2222, 0x881111, 300, 50)
    quitBtn.on('pointerdown', () => {
      this.scene.stop('BoardScene')
      this.scene.start('MenuScene')
    })

    const helpBtn = createButton(this, 0, 120, 'HOW TO PLAY', 0x4488ff, 0x224488, 300, 50)
    helpBtn.on('pointerdown', () => this.showHelp(panel, helpBtn, resumeBtn, quitBtn))

    panel.add([bg, title, resumeBtn, quitBtn, helpBtn])
    panel.setScale(0.8).setAlpha(0)
    
    this.tweens.add({
      targets: panel,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 300, ease: 'Back.easeOut'
    })

    // ESC to resume
    this.input.keyboard?.once('keydown-ESC', () => {
      this.scene.resume('BoardScene')
      this.scene.stop()
    })
  }

  private showHelp(panel: Phaser.GameObjects.Container, ...hide: Phaser.GameObjects.Container[]) {
    hide.forEach(o => o.setVisible(false))
    const w = this.scale.width
    const h = this.scale.height

    const rules = [
      '🎲 Roll the dice to move around the board',
      '📖 Land on tiles to answer vocab/grammar questions',
      '⭐ Collect Stars (cost: 20 coins) to earn trophies',
      '🛡️ Use items: Dash, Swap, Warp, Shield, Double Score, Poison Dart, Golden Key',
      '🏪 Buy shops to collect rent from passing players',
      '⚔️ Battle happens when two players land on the same tile',
      '🎯 First to 5 trophies wins! Most points breaks ties',
    ]

    const helpPanel = this.add.container(w / 2, h / 2)
    const bg = this.add.rectangle(0, 0, 600, 380, 0x141430, 0.95)
    bg.setStrokeStyle(3, 0x6688cc, 0.8)

    const title = this.add.text(0, -150, '📖 HOW TO PLAY', {
      fontSize: '28px', fontFamily: 'Arial Black', color: '#FFD700', stroke: '#664400', strokeThickness: 4
    }).setOrigin(0.5)

    const texts = rules.map((rule, i) =>
      this.add.text(0, -100 + i * 36, rule, {
        fontSize: '16px', fontFamily: 'Arial', color: '#aabbdd'
      }).setOrigin(0.5)
    )

    const closeBtn = createButton(this, 0, 155, '✕ CLOSE', 0xdd3333, 0xaa2222, 160, 44)
    closeBtn.on('pointerdown', () => {
      helpPanel.destroy(true)
      hide.forEach(o => o.setVisible(true))
    })

    helpPanel.add([bg, title, ...texts, closeBtn])
    helpPanel.setScale(0.85)
    this.tweens.add({ targets: helpPanel, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' })
  }
}
