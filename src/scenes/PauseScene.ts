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
    helpBtn.on('pointerdown', () => {
      // Launch tutorial or show help
      alert('Roll the dice, move to tiles, answer questions, and collect Stars to win!')
    })

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
}
