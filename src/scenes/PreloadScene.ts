import Phaser from 'phaser'

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene') }

  preload() {
    const w = this.scale.width
    const h = this.scale.height

    // Loading bar background
    this.add.rectangle(w / 2, h / 2, 400, 24, 0x333355)
      .setStrokeStyle(3, 0xffffff)
    const bar = this.add.rectangle(w / 2 - 200, h / 2, 0, 20, 0x88aaff)
    bar.setOrigin(0, 0.5)

    const titleText = this.add.text(w / 2, h / 2 - 60, 'VOCAB PARTY', {
      fontSize: '48px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#3333aa',
      strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, h / 2 + 40, 'Loading...', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#aaaacc'
    }).setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      bar.width = 400 * value
    })

    // Bounce title
    this.tweens.add({
      targets: titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Load JSON data
    this.load.json('vocab', 'data/vocab.json')
    this.load.json('grammar', 'data/grammar.json')
  }

  create() {
    this.scene.start('MenuScene')
  }
}
