import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { addStarfieldBackdrop } from '../ui/Starfield'
import { openHowToPlay } from '../ui/HowToPlay'
import { openSettingsPanel } from '../ui/SettingsPanel'
import { isAutoSimMode } from '../systems/gameFlags'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'

export class MenuScene extends Phaser.Scene {
  private modalOpen = false
  private closeModal: (() => void) | null = null

  constructor() { super('MenuScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height
    const touch = isTouchPreferred(this.sys.game)
    const reduce = shouldReduceMotion()

    this.add.rectangle(0, 0, w, h, 0x050510).setOrigin(0)
    this.add.rectangle(0, 0, w, h, 0x1a1a2e, 0.4).setOrigin(0)

    addStarfieldBackdrop(this, 0.5)
    if (!reduce) this.createParallaxStars()

    Sfx.startMusic()

    const titleContainer = this.add.container(w / 2, 150)
    const titleGlow = this.add.ellipse(0, 0, 800, 200, 0xffd700, 0.05)
    const title = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: 'Fredoka, Arial Black, Arial',
      color: '#ffffff',
      stroke: '#FFD700',
      strokeThickness: 12,
    }).setOrigin(0.5)
    const titleOverlay = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: 'Fredoka, Arial Black, Arial',
      color: '#FFD700',
    }).setOrigin(0.5).setAlpha(0.8)
    titleContainer.add([titleGlow, title, titleOverlay])

    const badge = this.add.container(w / 2 + 320, 90)
    const bBg = this.add.polygon(0, 0, [0, -20, 100, -20, 120, 0, 100, 20, 0, 20], 0xffd700, 0.8)
    const bText = this.add.text(55, 0, 'THE PARTY', {
      fontSize: '12px', fontFamily: 'Fredoka, Arial Black', color: '#000000'
    }).setOrigin(0.5)
    badge.add([bBg, bText]).setAngle(-15)
    if (!reduce) {
      this.tweens.add({ targets: badge, angle: -10, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({
        targets: titleContainer,
        y: 162,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      this.tweens.add({ targets: titleOverlay, alpha: 0.4, duration: 1500, yoyo: true, repeat: -1 })
    }

    this.add.text(w / 2, 245, 'THE ULTIMATE COMPETITIVE LEARNING EXPERIENCE', {
      fontSize: '20px',
      fontFamily: 'Fredoka, Arial Black',
      color: '#aaddff',
      letterSpacing: 3,
    }).setOrigin(0.5).setAlpha(0.75)

    const startGlow = this.add.ellipse(w / 2, 360, 450, 120, 0x22bb55, 0.15).setDepth(0)
    if (!reduce) {
      this.tweens.add({ targets: startGlow, alpha: 0.05, scaleX: 1.1, scaleY: 1.1, duration: 1000, yoyo: true, repeat: -1 })
    }

    const goSetup = () => {
      if (this.modalOpen) return
      Sfx.uiClick()
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('SetupScene')
      })
    }

    const startBtn = createButton(this, w / 2, 360, '▶  ENTER PARTY', 0x22bb55, 0x1a8844, 400, 72)
    startBtn.on('pointerdown', goSetup)

    const howBtn = createButton(this, w / 2, 445, '❓  HOW TO PLAY', 0x5566ff, 0x3344cc, 400, 56)
    howBtn.on('pointerdown', () => this.openHowTo())

    const settingsBtn = createButton(this, w / 2, 515, '⚙️  SETTINGS', 0x334466, 0x223355, 400, 56)
    settingsBtn.on('pointerdown', () => this.openSettings())

    // Compact gear also top-right for muscle memory
    const gear = createButton(this, w - 56, 48, '⚙️', 0x2a3550, 0x1a2538, 64, 52)
    gear.on('pointerdown', () => this.openSettings())

    this.add.text(w / 2, h - 48, touch
      ? 'Tap ENTER PARTY to begin  ·  Rotate landscape for the best view'
      : 'Enter = Start  ·  Esc closes panels  ·  ? opens How to Play', {
      fontSize: '14px',
      fontFamily: 'Fredoka, Arial',
      color: '#667799',
      align: 'center',
      wordWrap: { width: 900 },
    }).setOrigin(0.5)

    this.add.text(w / 2, h - 22, 'v2.1  •  PHASER 3', {
      fontSize: '13px',
      fontFamily: 'Fredoka, Arial Black',
      color: '#445577',
    }).setOrigin(0.5)

    if (isAutoSimMode()) {
      this.scene.start('SetupScene')
      return
    }

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.modalOpen) {
        this.closeModal?.()
        return
      }
    })
    this.input.keyboard?.on('keydown-ENTER', goSetup)
    this.input.keyboard?.on('keydown-SLASH', () => {
      if (!this.modalOpen) this.openHowTo()
    })
    this.input.keyboard?.on('keydown-KeyH', () => {
      if (!this.modalOpen) this.openHowTo()
    })

    this.cameras.main.fadeIn(350, 5, 5, 16)

    if (!reduce) {
      for (let i = 0; i < 14; i++) {
        const p = this.add.text(Phaser.Math.Between(0, w), Phaser.Math.Between(h - 100, h), '✨', { fontSize: '16px' })
        this.tweens.add({
          targets: p,
          y: '-=200',
          alpha: 0,
          duration: Phaser.Math.Between(2000, 5000),
          repeat: -1,
          delay: Phaser.Math.Between(0, 5000),
        })
      }
    }
  }

  private openHowTo() {
    if (this.modalOpen) return
    this.modalOpen = true
    Sfx.uiClick()
    this.closeModal = openHowToPlay(this, {
      mode: 'tiles',
      onClose: () => {
        this.modalOpen = false
        this.closeModal = null
      },
    })
  }

  private openSettings() {
    if (this.modalOpen) return
    this.modalOpen = true
    Sfx.uiClick()
    this.closeModal = openSettingsPanel(this, {
      onClose: () => {
        this.modalOpen = false
        this.closeModal = null
      },
      onChange: (s) => {
        if (s.muted || s.musicVolume <= 0.01) Sfx.stopMusic()
        else Sfx.startMusic()
      },
    })
  }

  createParallaxStars() {
    const w = this.scale.width
    const h = this.scale.height
    const layers = [
      { count: 80, size: [1, 2], speed: 0.05, alpha: 0.3 },
      { count: 40, size: [2, 3], speed: 0.1, alpha: 0.6 },
      { count: 16, size: [3, 5], speed: 0.2, alpha: 0.9 },
    ]
    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        const x = Phaser.Math.Between(0, w)
        const y = Phaser.Math.Between(0, h)
        const s = Phaser.Math.FloatBetween(layer.size[0], layer.size[1])
        const star = this.add.circle(x, y, s, 0xffffff, layer.alpha)
        this.tweens.add({
          targets: star,
          x: `+=${w}`,
          duration: (w / layer.speed) * 10,
          repeat: -1,
          onRepeat: () => star.setX(-10),
        })
      }
    })
  }
}
