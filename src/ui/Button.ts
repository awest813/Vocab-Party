import Phaser from 'phaser'

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  fillColor: number = 0x4444cc,
  hoverColor: number = 0x2222aa,
  width: number = 320,
  height: number = 60
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)

  // Glass background with neon stroke
  const bg = scene.add.rectangle(0, 0, width, height, fillColor, 0.85)
  bg.setStrokeStyle(3, 0xffffff, 0.4)
  bg.setInteractive({ useHandCursor: true })

  // Gloss highlight
  const gloss = scene.add.rectangle(0, -height / 4, width - 8, height / 2, 0xffffff, 0.1)

  const text = scene.add.text(0, 0, label, {
    fontSize: '22px',
    fontFamily: 'Arial Black, Arial',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5)

  container.add([bg, gloss, text])

  bg.on('pointerover', () => {
    bg.setFillStyle(hoverColor)
    bg.setStrokeStyle(3, 0x44ccff, 1)
    scene.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 150, ease: 'Cubic.easeOut' })
  })
  bg.on('pointerout', () => {
    bg.setFillStyle(fillColor)
    bg.setStrokeStyle(3, 0xffffff, 0.4)
    scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150, ease: 'Cubic.easeOut' })
  })
  bg.on('pointerdown', () => {
    scene.tweens.add({ targets: container, scaleX: 0.9, scaleY: 0.9, duration: 80, yoyo: true })
    container.emit('pointerdown')
  })

  return container
}
