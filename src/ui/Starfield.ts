import Phaser from 'phaser'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

/**
 * Full-screen tiled starfield from Phaser examples assets (if loaded).
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
  return img
}
