import Phaser from 'phaser'
import { Sfx } from '../systems/Sfx'

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

  // Larger invisible hit area helps touch targets on small screens.
  const hitPad = Math.max(8, Math.round((72 - height) / 2))
  const bg = scene.add.rectangle(0, 0, width, height, fillColor, 0.85)
  bg.setStrokeStyle(3, 0xffffff, 0.4)
  bg.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle(
      -width / 2 - hitPad,
      -height / 2 - hitPad,
      width + hitPad * 2,
      height + hitPad * 2
    ),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  })

  const gloss = scene.add.rectangle(0, -height / 4, width - 8, height / 2, 0xffffff, 0.1)

  const text = scene.add.text(0, 0, label, {
    fontSize: height >= 64 ? '24px' : '22px',
    fontFamily: 'Fredoka, Arial Black, Arial',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5)

  container.add([bg, gloss, text])

  bg.on('pointerover', () => {
    bg.setFillStyle(hoverColor)
    bg.setStrokeStyle(3, 0x44ccff, 1)
    scene.tweens.killTweensOf(container)
    scene.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 120, ease: 'Cubic.easeOut' })
    Sfx.uiHover()
  })
  bg.on('pointerout', () => {
    bg.setFillStyle(fillColor)
    bg.setStrokeStyle(3, 0xffffff, 0.4)
    scene.tweens.killTweensOf(container)
    scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120, ease: 'Cubic.easeOut' })
  })
  bg.on('pointerdown', () => {
    Sfx.uiClick()
    scene.tweens.killTweensOf(container)
    scene.tweens.add({ targets: container, scaleX: 0.92, scaleY: 0.92, duration: 70, yoyo: true })
    container.emit('pointerdown')
  })

  ;(container as any).setEnabled = (enabled: boolean) => {
    if (enabled) {
      bg.setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle(
          -width / 2 - hitPad,
          -height / 2 - hitPad,
          width + hitPad * 2,
          height + hitPad * 2
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      container.setAlpha(1)
    } else {
      bg.disableInteractive()
      bg.setFillStyle(fillColor)
      bg.setStrokeStyle(3, 0xffffff, 0.4)
      scene.tweens.killTweensOf(container)
      container.setScale(1)
      container.setAlpha(0.42)
    }
  }

  ;(container as any).setFillColor = (color: number) => {
    fillColor = color
    bg.setFillStyle(color)
  }

  return container
}
