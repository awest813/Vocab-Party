import Phaser from 'phaser'

const CONFETTI_COLORS = [0xff4444, 0x44ff88, 0x4488ff, 0xffdd00, 0xff88ff, 0x44ffff]

export function showConfetti(scene: Phaser.Scene, x?: number, y?: number): void {
  const cx = x ?? scene.scale.width / 2
  const cy = y ?? scene.scale.height / 3

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
