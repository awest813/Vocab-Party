import Phaser from 'phaser'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { COLORS } from './Theme'

/**
 * Full-screen tiled starfield + optional nebula wash.
 */
export function addStarfieldBackdrop(scene: Phaser.Scene, alpha = 0.55): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(TEXTURE_KEYS.starfield)) return null

  const w = scene.scale.width
  const h = scene.scale.height
  const img = scene.add.image(w / 2, h / 2, TEXTURE_KEYS.starfield)
  const scale = Math.max(w / img.width, h / img.height) * 1.02
  img.setScale(scale)
  img.setAlpha(alpha)
  img.setDepth(-10)
  img.setTint(0xb8d4ff)

  if (scene.textures.exists(TEXTURE_KEYS.skyNebula)) {
    const nebula = scene.add.image(w / 2, h / 2, TEXTURE_KEYS.skyNebula)
    const ns = Math.max(w / nebula.width, h / nebula.height) * 1.05
    nebula.setScale(ns).setAlpha(alpha * 0.28).setDepth(-9).setBlendMode(Phaser.BlendModes.ADD)
    nebula.setTint(0x66ddcc)
  }
  return img
}

/** Soft floating motes for atmosphere (teal/gold mix). */
export function addAmbientMotes(scene: Phaser.Scene, count = 28): void {
  const w = scene.scale.width
  const h = scene.scale.height
  const colors = [COLORS.teal, COLORS.sky, COLORS.gold, 0xffffff]

  for (let i = 0; i < count; i++) {
    const mote = scene.add.circle(
      Phaser.Math.Between(0, w),
      Phaser.Math.Between(0, h),
      Phaser.Math.FloatBetween(1, 2.8),
      Phaser.Utils.Array.GetRandom(colors),
      Phaser.Math.FloatBetween(0.12, 0.4)
    ).setDepth(-5)

    scene.tweens.add({
      targets: mote,
      y: `-=${Phaser.Math.Between(30, 70)}`,
      alpha: Phaser.Math.FloatBetween(0.05, 0.2),
      duration: Phaser.Math.Between(2800, 6200),
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 3500),
      ease: 'Sine.easeInOut',
    })
  }
}

/** Slow parallax drift on a starfield image (skips when reduced motion). */
export function driftStarfield(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image | null,
  reducedMotion = false
): void {
  if (!img || reducedMotion) return
  scene.tweens.add({
    targets: img,
    x: img.x + 18,
    y: img.y - 10,
    duration: 14000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
}
