import Phaser from 'phaser'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

export function playCoinBurst(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.textures.exists(TEXTURE_KEYS.coin)) return

  if (!scene.anims.exists('ext_coin_spin')) {
    scene.anims.create({
      key: 'ext_coin_spin',
      frames: scene.anims.generateFrameNumbers(TEXTURE_KEYS.coin, { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1
    })
  }

  const n = 7
  for (let i = 0; i < n; i++) {
    const spr = scene.add.sprite(
      x + Phaser.Math.Between(-36, 36),
      y + Phaser.Math.Between(-8, 8),
      TEXTURE_KEYS.coin
    )
    spr.setDepth(25)
    spr.setScale(2.2)
    spr.play('ext_coin_spin')

    scene.tweens.add({
      targets: spr,
      y: y - Phaser.Math.Between(50, 110),
      x: x + Phaser.Math.Between(-70, 70),
      alpha: 0,
      scale: 1.2,
      duration: 900,
      delay: i * 55,
      ease: 'Quad.easeOut',
      onComplete: () => spr.destroy()
    })
  }
}
