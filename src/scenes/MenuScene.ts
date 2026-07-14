import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { addAmbientMotes, addStarfieldBackdrop, driftStarfield } from '../ui/Starfield'
import { addFloorGlow, addVignette, paintStage } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { openHowToPlay } from '../ui/HowToPlay'
import { openSettingsPanel } from '../ui/SettingsPanel'
import { isAutoSimMode } from '../systems/gameFlags'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

export class MenuScene extends Phaser.Scene {
  private modalOpen = false
  private closeModal: (() => void) | null = null

  constructor() { super('MenuScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height
    const touch = isTouchPreferred(this.sys.game)
    const reduce = shouldReduceMotion()

    paintStage(this)
    const stars = addStarfieldBackdrop(this, 0.52)
    driftStarfield(this, stars, reduce)
    addVignette(this, 0.62, -4)
    if (!reduce) addAmbientMotes(this, 28)
    if (!reduce) this.createParallaxStars()

    Sfx.startMusic()

    // Soft gold key-light behind the brand
    const spotlight = this.add.ellipse(w / 2, 168, 780, 260, COLORS.gold, 0.08).setDepth(0)
    if (!reduce) {
      this.tweens.add({
        targets: spotlight,
        alpha: 0.14,
        scaleX: 1.05,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Stage platform under the brand — gives the hero a grounded plane
    const stage = this.add.graphics().setDepth(1)
    stage.fillStyle(0x000000, 0.28)
    stage.fillEllipse(w / 2 + 4, 248, 560, 48)
    stage.fillStyle(COLORS.bgPanel, 0.55)
    stage.fillEllipse(w / 2, 242, 540, 40)
    stage.lineStyle(2, COLORS.gold, 0.28)
    stage.strokeEllipse(w / 2, 242, 540, 40)
    addFloorGlow(this, w / 2, 250, 560, COLORS.gold, 0.12)

    const titleContainer = this.add.container(w / 2, 142).setDepth(5)
    titleContainer.setAlpha(0).setY(162)

    if (this.textures.exists(TEXTURE_KEYS.kenneyTrophy)) {
      const leftTrophy = this.add.image(-300, 10, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(52, 52).setAlpha(0.92)
      const rightTrophy = this.add.image(300, 10, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(52, 52).setAlpha(0.92)
      titleContainer.add([leftTrophy, rightTrophy])
      if (!reduce) {
        this.tweens.add({
          targets: [leftTrophy, rightTrophy],
          y: '-=10',
          angle: { from: -4, to: 4 },
          duration: 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }

    // Deep shadow pass for brand weight
    const titleShadow = this.add.text(3, 5, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: FONT.display,
      color: '#000000',
    }).setOrigin(0.5).setAlpha(0.45)

    const titleStroke = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: FONT.display,
      color: '#fff8e1',
      stroke: '#000000',
      strokeThickness: 18,
    }).setOrigin(0.5)

    const title = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: FONT.display,
      color: '#ffe566',
      stroke: hexColor(COLORS.goldDeep),
      strokeThickness: 6,
    }).setOrigin(0.5)

    // Soft sheen highlight on brand
    const sheen = this.add.text(0, -2, 'VOCAB PARTY', {
      fontSize: '92px',
      fontFamily: FONT.display,
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.12)

    titleContainer.add([titleShadow, titleStroke, title, sheen])

    this.tweens.add({
      targets: titleContainer,
      alpha: 1,
      y: 142,
      duration: reduce ? 0 : 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (reduce) return
        this.tweens.add({
          targets: titleContainer,
          y: 152,
          duration: 2400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      },
    })

    const tagline = this.add.text(w / 2, 228, 'Roll · Learn · Win the party', {
      fontSize: '22px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5).setAlpha(0).setDepth(5)

    this.tweens.add({
      targets: tagline,
      alpha: 0.9,
      duration: reduce ? 0 : 480,
      delay: reduce ? 0 : 220,
      ease: 'Cubic.easeOut',
    })

    const startGlow = this.add.ellipse(w / 2, 368, 440, 110, COLORS.mint, 0.14).setDepth(4)
    if (!reduce) {
      this.tweens.add({
        targets: startGlow,
        alpha: 0.05,
        scaleX: 1.1,
        duration: 1200,
        yoyo: true,
        repeat: -1,
      })
    }

    let leaving = false
    const goSetup = () => {
      if (this.modalOpen || leaving) return
      leaving = true
      this.cameras.main.fadeOut(380, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('SetupScene')
      })
    }

    const startBtn = createButton(this, w / 2, 368, '▶  ENTER PARTY', COLORS.party, COLORS.partyDeep, 420, 74)
    startBtn.setDepth(6)
    startBtn.on('pointerdown', goSetup)

    const howBtn = createButton(this, w / 2, 458, 'HOW TO PLAY', COLORS.skyBtn, COLORS.skyBtnDeep, 360, 56)
    howBtn.setDepth(6)
    howBtn.on('pointerdown', () => this.openHowTo())

    const settingsBtn = createButton(this, w / 2, 530, 'SETTINGS', COLORS.bgPanelAlt, COLORS.chromeDeep, 360, 56)
    settingsBtn.setDepth(6)
    settingsBtn.on('pointerdown', () => this.openSettings())

    // Stagger CTA entrance
    ;[startBtn, howBtn, settingsBtn].forEach((btn, i) => {
      btn.setAlpha(0)
      btn.y += 18
      this.tweens.add({
        targets: btn,
        alpha: 1,
        y: '-=18',
        duration: reduce ? 0 : 420,
        delay: reduce ? 0 : 280 + i * 90,
        ease: 'Back.easeOut',
      })
    })

    const gear = createButton(this, w - 56, 48, '⚙', COLORS.bgPanelAlt, COLORS.chromeDeep, 64, 52)
    gear.setDepth(8)
    gear.on('pointerdown', () => this.openSettings())

    const hint = this.add.text(w / 2, h - 48, touch
      ? 'Tap ENTER PARTY to begin  ·  Rotate landscape for the best view'
      : 'Enter = Start  ·  Esc closes panels  ·  ? opens How to Play', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
      align: 'center',
      wordWrap: { width: 900 },
    }).setOrigin(0.5).setDepth(6).setAlpha(0)

    const version = this.add.text(w / 2, h - 22, 'v2.0  ·  Phaser 3', {
      fontSize: '13px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
    }).setOrigin(0.5).setDepth(6).setAlpha(0)

    this.tweens.add({
      targets: [hint, version],
      alpha: 1,
      duration: reduce ? 0 : 500,
      delay: reduce ? 0 : 700,
    })

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

    this.cameras.main.fadeIn(420, 7, 11, 20)

    if (!reduce) {
      for (let i = 0; i < 16; i++) {
        const p = this.add.circle(
          Phaser.Math.Between(40, w - 40),
          Phaser.Math.Between(h - 80, h - 20),
          Phaser.Math.FloatBetween(1.5, 3.2),
          COLORS.gold,
          0.7
        ).setDepth(2)
        this.tweens.add({
          targets: p,
          y: '-=200',
          alpha: 0,
          duration: Phaser.Math.Between(2400, 5000),
          repeat: -1,
          delay: Phaser.Math.Between(0, 4200),
        })
      }
    }
  }

  private openHowTo() {
    if (this.modalOpen) return
    this.modalOpen = true
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
      { count: 70, size: [1, 2], speed: 0.04, alpha: 0.28 },
      { count: 36, size: [2, 3], speed: 0.09, alpha: 0.55 },
      { count: 14, size: [3, 4.5], speed: 0.16, alpha: 0.85 },
    ]

    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        const x = Phaser.Math.Between(0, w)
        const y = Phaser.Math.Between(0, h)
        const s = Phaser.Math.FloatBetween(layer.size[0], layer.size[1])
        const star = this.add.circle(x, y, s, 0xffffff, layer.alpha).setDepth(-6)

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
