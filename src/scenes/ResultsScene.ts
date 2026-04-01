import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'

export class ResultsScene extends Phaser.Scene {
  constructor() { super('ResultsScene') }

  create(data: { state: GameState }) {
    const { state } = data
    const w = this.scale.width
    const h = this.scale.height

    this.add.rectangle(0, 0, w, h, 0x1a1a2e).setOrigin(0)

    for (let i = 0; i < 80; i++) {
      this.add.circle(
        Phaser.Math.Between(0, w), Phaser.Math.Between(0, h),
        Phaser.Math.FloatBetween(1, 3), 0xffffff, Phaser.Math.FloatBetween(0.3, 1)
      )
    }

    const sorted = [...state.players].sort((a, b) => b.score - a.score)

    const title = this.add.text(w / 2, 60, '🏆 FINAL RESULTS 🏆', {
      fontSize: '56px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#884400',
      strokeThickness: 8
    }).setOrigin(0.5).setScale(0)

    this.tweens.add({ targets: title, scaleX: 1, scaleY: 1, duration: 600, ease: 'Back.easeOut' })

    const medals = ['🥇', '🥈', '🥉', '4️⃣']
    const podiumColors = [0xFFD700, 0xC0C0C0, 0xCD7F32, 0x888888]
    const podiumH = [200, 160, 120, 80]
    const podiumX = [w / 2, w / 2 - 200, w / 2 + 200, w / 2 - 400]
    const podiumBase = h - 160

    sorted.forEach((player, rank) => {
      const x = podiumX[rank]
      const ph = podiumH[rank]
      const pColor = podiumColors[rank]

      const podium = this.add.rectangle(x, podiumBase, 140, ph, pColor)
      podium.setStrokeStyle(3, 0xffffff)
      podium.setOrigin(0.5, 1)
      podium.setAlpha(0)
      this.tweens.add({ targets: podium, alpha: 1, duration: 400, delay: rank * 200 })

      const cardY = podiumBase - ph - 80
      const card = this.add.rectangle(x, cardY, 150, 140, 0x222244)
      card.setStrokeStyle(4, pColor)
      card.setAlpha(0)
      this.tweens.add({ targets: card, alpha: 1, duration: 400, delay: rank * 200 + 200 })

      const emoji = this.add.text(x, cardY - 30, player.emoji, { fontSize: '36px' }).setOrigin(0.5).setAlpha(0)
      const nameT = this.add.text(x, cardY + 10, player.name, {
        fontSize: '18px', fontFamily: 'Arial Black', color: '#ffffff'
      }).setOrigin(0.5).setAlpha(0)
      const scoreT = this.add.text(x, cardY + 38, `${player.score} pts`, {
        fontSize: '22px', fontFamily: 'Arial Black', color: '#FFD700'
      }).setOrigin(0.5).setAlpha(0)
      const medal = this.add.text(x, cardY - 72, medals[rank], { fontSize: '32px' }).setOrigin(0.5).setAlpha(0)

      this.tweens.add({ targets: [emoji, nameT, scoreT, medal], alpha: 1, duration: 300, delay: rank * 200 + 400 })

      if (rank === 0) {
        this.tweens.add({
          targets: [card, emoji, nameT, scoreT, medal],
          y: '-=8',
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: 1200
        })
      }

      this.add.text(x, podiumBase - ph / 2, String(rank + 1), {
        fontSize: '28px', fontFamily: 'Arial Black', color: '#000000', alpha: 0.4
      } as any).setOrigin(0.5)
    })

    this.time.delayedCall(1200, () => {
      showConfetti(this)
      const banner = this.add.text(w / 2, 160, `🎉 ${sorted[0].name} WINS! 🎉`, {
        fontSize: '42px',
        fontFamily: 'Arial Black',
        color: '#FFD700',
        stroke: '#884400',
        strokeThickness: 7
      }).setOrigin(0.5).setScale(0)
      this.tweens.add({ targets: banner, scaleX: 1, scaleY: 1, duration: 500, ease: 'Back.easeOut' })

      for (let t = 0; t < 8; t++) {
        this.time.delayedCall(t * 150, () => {
          const tx = this.add.text(Phaser.Math.Between(100, w - 100), -40, '🏆', { fontSize: '40px' })
          this.tweens.add({
            targets: tx,
            y: Phaser.Math.Between(200, h - 200),
            rotation: Phaser.Math.FloatBetween(-1, 1),
            duration: 1500,
            ease: 'Bounce.easeOut',
            onComplete: () => this.time.delayedCall(2000, () => tx.destroy())
          })
        })
      }
    })

    const playAgainBtn = createButton(this, w / 2 - 150, h - 60, '🔄 PLAY AGAIN', 0x22bb55, 0x1a8844)
    playAgainBtn.on('pointerdown', () => {
      this.cameras.main.flash(300, 255, 255, 255)
      this.time.delayedCall(300, () => this.scene.start('BoardScene'))
    })

    const menuBtn = createButton(this, w / 2 + 150, h - 60, '🏠 MAIN MENU', 0x5566ff, 0x3344cc)
    menuBtn.on('pointerdown', () => {
      this.cameras.main.flash(300, 255, 255, 255)
      this.time.delayedCall(300, () => this.scene.start('MenuScene'))
    })
  }
}
