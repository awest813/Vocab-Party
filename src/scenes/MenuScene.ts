import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { paintStage } from '../ui/Panel'
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
    addStarfieldBackdrop(this, 0.48)
    if (!reduce) addAmbientMotes(this, 24)
    if (!reduce) this.createParallaxStars()

    Sfx.startMusic()

    const spotlight = this.add.ellipse(w / 2, 150, 720, 220, COLORS.gold, 0.07).setDepth(0)
    if (!reduce) {
      this.tweens.add({
        targets: spotlight,
        alpha: 0.12,
        scaleX: 1.06,
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    const titleContainer = this.add.container(w / 2, 148)

    if (this.textures.exists(TEXTURE_KEYS.kenneyTrophy)) {
      const leftTrophy = this.add.image(-310, 8, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(48, 48).setAlpha(0.9)
      const rightTrophy = this.add.image(310, 8, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(48, 48).setAlpha(0.9)
      titleContainer.add([leftTrophy, rightTrophy])
      if (!reduce) {
        this.tweens.add({
          targets: [leftTrophy, rightTrophy],
          y: '-=8',
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }

    const titleStroke = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '88px',
      fontFamily: FONT.display,
      color: '#fff8e1',
      stroke: '#000000',
      strokeThickness: 16,
    }).setOrigin(0.5)

    const title = this.add.text(0, 0, 'VOCAB PARTY', {
      fontSize: '88px',
      fontFamily: FONT.display,
      color: '#ffe566',
      stroke: hexColor(COLORS.goldDeep),
      strokeThickness: 6,
    }).setOrigin(0.5)

    titleContainer.add([titleStroke, title])

    if (!reduce) {
      this.tweens.add({
        targets: titleContainer,
        y: 158,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    this.add.text(w / 2, 232, 'Roll · Learn · Win the party', {
      fontSize: '22px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5).setAlpha(0.85)

    const startGlow = this.add.ellipse(w / 2, 360, 420, 100, COLORS.mint, 0.12)
    if (!reduce) {
      this.tweens.add({
        targets: startGlow,
        alpha: 0.05,
        scaleX: 1.08,
        duration: 1100,
        yoyo: true,
        repeat: -1,
      })
    }

    const goSetup = () => {
      if (this.modalOpen) return
      this.cameras.main.fadeOut(380, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('SetupScene')
      })
    }

    const startBtn = createButton(this, w / 2, 360, '▶  ENTER PARTY', COLORS.party, COLORS.partyDeep, 400, 72)
    startBtn.on('pointerdown', goSetup)

    const howBtn = createButton(this, w / 2, 445, 'HOW TO PLAY', COLORS.skyBtn, COLORS.skyBtnDeep, 360, 56)
    howBtn.on('pointerdown', () => this.openHowTo())

    const settingsBtn = createButton(this, w / 2, 515, 'SETTINGS', COLORS.bgPanelAlt, COLORS.chromeDeep, 360, 56)
    settingsBtn.on('pointerdown', () => this.openSettings())

    const gear = createButton(this, w - 56, 48, '⚙', COLORS.bgPanelAlt, COLORS.chromeDeep, 64, 52)
    gear.on('pointerdown', () => this.openSettings())

    // Atmospheric tile chips — preview the board language without cluttering the CTA
    const chips = [
      { emoji: '📖', color: COLORS.skyBtn },
      { emoji: '✏️', color: COLORS.warning },
      { emoji: '⭐', color: COLORS.gold },
      { emoji: '❓', color: 0xb45cff },
      { emoji: '🕹️', color: 0xff5cad },
      { emoji: '🔄', color: COLORS.teal },
    ]
    const chipY = 590
    const chipGap = 78
    const chipStart = w / 2 - ((chips.length - 1) * chipGap) / 2
    chips.forEach((chip, i) => {
      const x = chipStart + i * chipGap
      const wrap = this.add.container(x, chipY)
      const g = this.add.graphics()
      g.fillStyle(chip.color, 0.18)
      g.fillRoundedRect(-28, -28, 56, 56, 14)
      g.lineStyle(2, chip.color, 0.55)
      g.strokeRoundedRect(-28, -28, 56, 56, 14)
      const t = this.add.text(0, 0, chip.emoji, { fontSize: '24px' }).setOrigin(0.5)
      wrap.add([g, t])
      wrap.setAlpha(0).setY(chipY + 20)
      this.tweens.add({
        targets: wrap,
        alpha: 1,
        y: chipY,
        duration: 420,
        delay: 180 + i * 70,
        ease: 'Back.easeOut',
      })
      if (!reduce) {
        this.tweens.add({
          targets: wrap,
          y: chipY - 6,
          duration: 1800 + i * 120,
          yoyo: true,
          repeat: -1,
          delay: 600 + i * 90,
          ease: 'Sine.easeInOut',
        })
      }
    })

    this.add.text(w / 2, h - 48, touch
      ? 'Tap ENTER PARTY to begin  ·  Rotate landscape for the best view'
      : 'Enter = Start  ·  Esc closes panels  ·  ? opens How to Play', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
      align: 'center',
      wordWrap: { width: 900 },
    }).setOrigin(0.5)

    this.add.text(w / 2, h - 22, 'v2.0  ·  Phaser 3', {
      fontSize: '13px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
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

    this.cameras.main.fadeIn(420, 7, 11, 20)

    if (!reduce) {
      for (let i = 0; i < 14; i++) {
        const p = this.add.circle(
          Phaser.Math.Between(40, w - 40),
          Phaser.Math.Between(h - 80, h - 20),
          Phaser.Math.FloatBetween(1.5, 3),
          COLORS.gold,
          0.7
        )
        this.tweens.add({
          targets: p,
          y: '-=180',
          alpha: 0,
          duration: Phaser.Math.Between(2200, 4800),
          repeat: -1,
          delay: Phaser.Math.Between(0, 4000),
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
