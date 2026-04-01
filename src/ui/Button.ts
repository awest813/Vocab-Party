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

  const bg = scene.add.rectangle(0, 0, width, height, fillColor)
  bg.setStrokeStyle(3, 0xffffff)
  bg.setInteractive({ useHandCursor: true })

  const text = scene.add.text(0, 0, label, {
    fontSize: '22px',
    fontFamily: 'Arial Black, Arial',
    color: '#ffffff',
    stroke: '#000044',
    strokeThickness: 3
  }).setOrigin(0.5)

  container.add([bg, text])
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains
  )

  // Hover
  container.on('pointerover', () => {
    bg.setFillStyle(hoverColor)
    scene.tweens.add({ targets: container, scaleX: 1.07, scaleY: 1.07, duration: 100 })
  })
  container.on('pointerout', () => {
    bg.setFillStyle(fillColor)
    scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 })
  })
  container.on('pointerdown', () => {
    scene.tweens.add({ targets: container, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true })
  })

  return container
}
