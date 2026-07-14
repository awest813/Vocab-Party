import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { addStarfieldBackdrop } from '../ui/Starfield'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { Sfx } from '../systems/Sfx'

export class ResultsScene extends Phaser.Scene {
  constructor() { super('ResultsScene') }

  private d(ms: number) {
    return scaleAutoSimDelay(ms)
  }

  create(data: { state: GameState }) {
    const { state } = data
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __VOCAB_PARTY_RESULTS_READY__?: boolean }).__VOCAB_PARTY_RESULTS_READY__ = true
    }
    const w = this.scale.width
    const h = this.scale.height

    this.add.rectangle(0, 0, w, h, 0x0d0d1f).setOrigin(0)
    this.add.rectangle(0, h * 0.55, w, h * 0.45, 0x11112a).setOrigin(0)

    addStarfieldBackdrop(this, 0.4)
    const useStarTex = this.textures.exists(TEXTURE_KEYS.starSmall)
    const starCount = useStarTex ? 48 : 90
    for (let i = 0; i < starCount; i++) {
      const x = Phaser.Math.Between(0, w)
      const y = Phaser.Math.Between(0, h)
      const star = useStarTex
        ? this.add.image(x, y, TEXTURE_KEYS.starSmall).setDisplaySize(
            Phaser.Math.Between(8, 18),
            Phaser.Math.Between(8, 18)
          )
        : this.add.circle(
            x, y,
            Phaser.Math.FloatBetween(0.8, 2.8), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.9)
          )
      star.setAlpha(Phaser.Math.FloatBetween(0.25, 0.85))
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.05, 0.35),
        duration: Phaser.Math.Between(700, 2800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
        ease: 'Sine.easeInOut'
      })
    }

    // Volumetric Light Beams
    const beams = this.add.graphics()
    beams.fillGradientStyle(0xffd700, 0xffd700, 0x000000, 0x000000, 0.15, 0.15, 0, 0)
    beams.beginPath()
    beams.moveTo(w / 2, -100)
    beams.lineTo(0, h)
    beams.lineTo(w, h)
    beams.closePath()
    beams.fillPath()
    beams.setAlpha(0.3).setDepth(-1)

    // Ambient Dust Motes
    for (let i = 0; i < 40; i++) {
      const mote = this.add.circle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        Phaser.Math.Between(1, 3),
        0xffffff,
        Phaser.Math.FloatBetween(0.1, 0.4)
      ).setDepth(-1)
      this.tweens.add({
        targets: mote,
        y: '-=100', alpha: 0,
        duration: Phaser.Math.Between(4000, 8000),
        repeat: -1, delay: Phaser.Math.Between(0, 4000)
      })
    }

    const sorted = [...state.players].sort((a, b) => {
      if (b.trophies !== a.trophies) return b.trophies - a.trophies
      return b.score - a.score
    })

    const title = this.add.text(w / 2, 52, '🏆 FINAL RESULTS 🏆', {
      fontSize: '52px',
      fontFamily: 'Fredoka, Arial Black',
      color: '#FFD700',
      stroke: '#884400',
      strokeThickness: 8
    }).setOrigin(0.5).setScale(0)

    this.tweens.add({ targets: title, scaleX: 1, scaleY: 1, duration: isAutoSimMode() ? 50 : 600, ease: 'Back.easeOut' })

    const medals = ['🥇', '🥈', '🥉', '4️⃣']
    const podiumColors = [0xFFD700, 0xC0C0C0, 0xCD7F32, 0x888888]
    const podiumH = [200, 160, 120, 80]
    const playerCount = sorted.length
    const pSpacing = playerCount === 4 ? 220 : 260
    const podiumX = [
      w / 2,
      w / 2 - pSpacing,
      w / 2 + pSpacing,
      w / 2 - pSpacing * 2.2,
    ]
    const podiumBase = h - 120

    sorted.forEach((player, rank) => {
      const x = podiumX[rank]
      const ph = podiumH[rank]
      const pColor = podiumColors[rank]

      const podium = this.add.rectangle(x, podiumBase, 140, ph, pColor, 0.9)
      podium.setStrokeStyle(3, 0xffffff, 0.4)
      podium.setOrigin(0.5, 1)
      podium.setScale(0, 1)
      
      const podiumGlow = this.add.ellipse(x, podiumBase, 200, 40, pColor, 0.2).setOrigin(0.5, 1).setDepth(-1).setAlpha(0)

      this.tweens.add({
        targets: podium,
        scaleY: 1,
        duration: isAutoSimMode() ? 30 : 350,
        delay: isAutoSimMode() ? rank * 10 : rank * 180,
        ease: 'Back.easeOut'
      })
      this.tweens.add({
        targets: podiumGlow,
        alpha: 1,
        duration: isAutoSimMode() ? 30 : 300,
        delay: isAutoSimMode() ? rank * 10 : rank * 180
      })

      const cardY = podiumBase - ph - 90
      const card = this.add.rectangle(x, cardY, 160, 160, 0x0d0d1f, 0.8)
      card.setStrokeStyle(4, pColor, 0.8)
      card.setScale(0)

      this.tweens.add({
        targets: card,
        scaleX: 1, scaleY: 1,
        duration: isAutoSimMode() ? 30 : 350,
        delay: isAutoSimMode() ? rank * 12 + 12 : rank * 200 + 250,
        ease: 'Back.easeOut'
      })

      const emoji = this.add.text(x, cardY - 40, player.emoji, { fontSize: '48px' }).setOrigin(0.5).setAlpha(0)
      const nameT = this.add.text(x, cardY + 15, player.name, {
        fontSize: '20px', fontFamily: 'Fredoka, Arial Black', color: '#ffffff'
      }).setOrigin(0.5).setAlpha(0)
      const scoreT = this.add.text(x, cardY + 45, `${player.score} pts  🌟${player.trophies}`, {
        fontSize: '18px', fontFamily: 'Fredoka, Arial Black', color: '#FFD700'
      }).setOrigin(0.5).setAlpha(0)
      const brickT = player.bricksCollected > 0
        ? this.add.text(x, cardY + 68, `🧱 x${player.bricksCollected}`, {
            fontSize: '14px', fontFamily: 'Fredoka, Arial', color: '#aa8866'
          }).setOrigin(0.5).setAlpha(0)
        : null
      const medal = this.add.text(x, cardY - 95, medals[rank], { fontSize: '42px' }).setOrigin(0.5).setAlpha(0)

      this.tweens.add({
        targets: [emoji, nameT, scoreT, medal].filter(Boolean),
        alpha: 1,
        duration: isAutoSimMode() ? 20 : 250,
        delay: isAutoSimMode() ? rank * 12 + 24 : rank * 200 + 500
      })
      if (brickT) {
        this.tweens.add({
          targets: brickT,
          alpha: 1,
          duration: 200,
          delay: isAutoSimMode() ? rank * 12 + 36 : rank * 200 + 700
        })
      }

      if (rank === 0 && !isAutoSimMode()) {
        this.tweens.add({
          targets: [card, emoji, nameT, scoreT, medal],
          y: '-=12',
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        })
      }

      this.add.text(x, podiumBase - ph / 2, String(rank + 1), {
        fontSize: '32px', fontFamily: 'Fredoka, Arial Black', color: '#000000'
      }).setAlpha(0.2).setOrigin(0.5)
    })

    this.time.delayedCall(this.d(1200), () => {
      Sfx.win()
      showConfetti(this)
      const banner = this.add.text(w / 2, 130, `🎉 ${sorted[0].name} WINS! 🎉`, {
        fontSize: '38px',
        fontFamily: 'Fredoka, Arial Black',
        color: '#FFD700',
        stroke: '#884400',
        strokeThickness: 7
      }).setOrigin(0.5).setScale(0)
      this.tweens.add({ targets: banner, scaleX: 1, scaleY: 1, duration: isAutoSimMode() ? 40 : 500, ease: 'Back.easeOut' })

      // Stats footer
      const totalRounds = state.round
      const totalBricks = state.players.reduce((s, p) => s + p.bricksCollected, 0)
      const totalStars = state.players.reduce((s, p) => s + p.trophies, 0)
      const statsLine = this.add.text(w / 2, 170, `${totalRounds} rounds  ·  ${totalStars} stars earned  ·  ${totalBricks} bricks collected`, {
        fontSize: '16px', fontFamily: 'Fredoka, Arial', color: '#8899aa'
      }).setOrigin(0.5).setAlpha(0)
      this.tweens.add({ targets: statsLine, alpha: 1, duration: 400, delay: 600 })

      if (!isAutoSimMode()) {
        for (let t = 0; t < 12; t++) {
          this.time.delayedCall(t * 300, () => {
            const fx = Phaser.Math.Between(200, w - 200)
            const fy = Phaser.Math.Between(100, h - 300)
            this.createFirework(fx, fy)
          })
        }
      }
    })

    const playAgainBtn = createButton(this, w / 2 - 180, h - 60, '🔄 PLAY AGAIN', 0x22bb55, 0x1a8844)
    playAgainBtn.on('pointerdown', () => {
      this.cameras.main.flash(300, 255, 255, 255)
      this.time.delayedCall(300, () => this.scene.start('SetupScene'))
    })

    const menuBtn = createButton(this, w / 2 + 180, h - 60, '🏠 MAIN MENU', 0x5566ff, 0x3344cc)
    menuBtn.on('pointerdown', () => {
      this.cameras.main.flash(300, 255, 255, 255)
      this.time.delayedCall(300, () => this.scene.start('MenuScene'))
    })

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.scene.start('SetupScene')
    })
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('MenuScene')
    })
  }

  private createFirework(x: number, y: number) {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]
    const color = Phaser.Utils.Array.GetRandom(colors)
    
    const particles = this.add.particles(x, y, TEXTURE_KEYS.particleYellow, {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      lifespan: 800,
      gravityY: 100,
      tint: color,
      blendMode: 'ADD',
      quantity: 40
    })
    
    this.time.delayedCall(800, () => particles.destroy())
    this.cameras.main.flash(100, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, true)
  }
}
