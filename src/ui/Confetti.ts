import Phaser from 'phaser'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

const CONFETTI_COLORS = [0xff4444, 0x44ff88, 0x4488ff, 0xffdd00, 0xff88ff, 0x44ffff]

function showParticleConfetti(scene: Phaser.Scene, cx: number, cy: number): boolean {
  const keys = [
    TEXTURE_KEYS.particleYellow,
    TEXTURE_KEYS.particleRed,
    TEXTURE_KEYS.particleBlue,
    TEXTURE_KEYS.particleSquare
  ].filter((k) => scene.textures.exists(k))

  if (keys.length === 0) return false

  keys.forEach((key) => {
    const emitter = scene.add.particles(cx + Phaser.Math.Between(-50, 50), cy, key, {
      speed: { min: 140, max: 380 },
      angle: { min: 65, max: 115 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 1100, max: 2400 },
      scale: { start: Phaser.Math.FloatBetween(0.22, 0.5), end: 0.02 },
      gravityY: Phaser.Math.Between(160, 280),
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    })
    emitter.setDepth(100)
    emitter.explode(Phaser.Math.Between(14, 26))
    scene.time.delayedCall(3000, () => emitter.destroy())
  })
  return true
}

export function showConfetti(scene: Phaser.Scene, x?: number, y?: number): void {
  const cx = x ?? scene.scale.width / 2
  const cy = y ?? scene.scale.height / 3

  if (showParticleConfetti(scene, cx, cy)) return

  for (let i = 0; i < 50; i++) {
    const color = Phaser.Utils.Array.GetRandom(CONFETTI_COLORS)
    const size = Phaser.Math.Between(4, 10)
    const piece = scene.add.rectangle(
      cx + Phaser.Math.Between(-100, 100),
      cy,
      size,
      size * 1.5,
      color
    ).setDepth(100)

    scene.tweens.add({
      targets: piece,
      x: cx + Phaser.Math.Between(-400, 400),
      y: cy + Phaser.Math.Between(200, 600),
      angle: Phaser.Math.Between(-360, 360),
      alpha: 0,
      duration: Phaser.Math.Between(1000, 2500),
      ease: 'Quad.easeIn',
      delay: Phaser.Math.Between(0, 500),
      onComplete: () => piece.destroy()
    })
  }
}
