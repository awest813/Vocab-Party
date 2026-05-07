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

  const n = 8
  const borderColor = 0xffd700
  
  // Sparkle Emitter (Particle effect)
  const particles = scene.add.particles(0, 0, TEXTURE_KEYS.particleYellow, {
    x, y,
    speed: { min: 80, max: 220 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 600,
    blendMode: 'ADD',
    quantity: 12,
    emitting: false
  })
  particles.explode(12)
  scene.time.delayedCall(800, () => particles.destroy())

  for (let i = 0; i < n; i++) {
    const spr = scene.add.sprite(
      x + Phaser.Math.Between(-20, 20),
      y + Phaser.Math.Between(-5, 5),
      TEXTURE_KEYS.coin
    )
    spr.setDepth(25)
    spr.setScale(2.5)
    spr.play('ext_coin_spin')

    const angle = Phaser.Math.FloatBetween(-Math.PI * 0.8, -Math.PI * 0.2)
    const dist = Phaser.Math.Between(80, 150)
    const tx = x + Math.cos(angle) * dist
    const ty = y + Math.sin(angle) * dist

    scene.tweens.add({
      targets: spr,
      x: tx,
      y: ty,
      alpha: 0,
      scale: 1.0,
      duration: 1000,
      delay: i * 40,
      ease: 'Cubic.easeOut',
      onComplete: () => spr.destroy()
    })
  }
}
