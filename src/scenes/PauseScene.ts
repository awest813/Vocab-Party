import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { addVignette, createDimmer, createPanel } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { openHowToPlay } from '../ui/HowToPlay'
import { openSettingsPanel } from '../ui/SettingsPanel'
import { shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'

export class PauseScene extends Phaser.Scene {
  private modalOpen = false
  private closeModal: (() => void) | null = null

  constructor() {
    super('PauseScene')
  }

  create() {
    const w = this.scale.width
    const h = this.scale.height
    const reduce = shouldReduceMotion()

    Sfx.pause()
    createDimmer(this, 0.68)
    addVignette(this, 0.72, 59)

    // Outer glow ring behind the pause card
    const glow = this.add.graphics().setDepth(59)
    glow.fillStyle(COLORS.sky, 0.08)
    glow.fillRoundedRect(w / 2 - 230, h / 2 - 230, 460, 460, 28)
    glow.lineStyle(2, COLORS.gold, 0.22)
    glow.strokeRoundedRect(w / 2 - 222, h / 2 - 222, 444, 444, 24)
    if (!reduce) {
      this.tweens.add({
        targets: glow,
        alpha: 0.55,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    const panel = createPanel(this, {
      x: w / 2,
      y: h / 2,
      width: 440,
      height: 440,
      fill: COLORS.bgPanel,
      fillAlpha: 0.96,
      border: COLORS.gold,
      borderAlpha: 0.42,
      headerColor: COLORS.skyDeep,
      headerHeight: 56,
      title: 'PAUSED',
      titleColor: hexColor(COLORS.gold),
      depth: 60,
      animateIn: true,
    })

    // Decorative pause bars in the header area
    const bars = this.add.graphics()
    bars.fillStyle(COLORS.gold, 0.85)
    bars.fillRoundedRect(-28, -176, 10, 28, 3)
    bars.fillRoundedRect(18, -176, 10, 28, 3)
    panel.add(bars)
    if (!reduce) {
      this.tweens.add({
        targets: bars,
        alpha: 0.45,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    if (this.textures.exists(TEXTURE_KEYS.kenneyCardBlue)) {
      panel.add(
        this.add.image(0, 20, TEXTURE_KEYS.kenneyCardBlue)
          .setDisplaySize(300, 220)
          .setAlpha(0.07)
      )
    }

    // Soft inset plate behind buttons for nested depth
    const plate = this.add.graphics()
    plate.fillStyle(COLORS.bgDeep, 0.35)
    plate.fillRoundedRect(-170, -118, 340, 268, 14)
    plate.lineStyle(1.5, COLORS.strokeSoft, 0.1)
    plate.strokeRoundedRect(-170, -118, 340, 268, 14)
    panel.add(plate)

    const resume = () => {
      if (this.modalOpen) return
      this.scene.resume('BoardScene')
      this.scene.stop()
    }

    const resumeBtn = createButton(this, 0, -72, '▶  RESUME', COLORS.party, COLORS.partyDeep, 320, 56)
    resumeBtn.on('pointerdown', resume)

    const settingsBtn = createButton(this, 0, -4, 'SETTINGS', COLORS.bgPanelAlt, COLORS.chromeDeep, 320, 50)
    settingsBtn.on('pointerdown', () => {
      if (this.modalOpen) return
      this.modalOpen = true
      panel.setVisible(false)
      glow.setVisible(false)
      this.closeModal = openSettingsPanel(this, {
        onClose: () => {
          this.modalOpen = false
          this.closeModal = null
          panel.setVisible(true)
          glow.setVisible(true)
        },
      })
    })

    const helpBtn = createButton(this, 0, 58, 'HOW TO PLAY', COLORS.skyDeep, COLORS.skyBtnDeep, 320, 50)
    helpBtn.on('pointerdown', () => {
      if (this.modalOpen) return
      this.modalOpen = true
      panel.setVisible(false)
      glow.setVisible(false)
      this.closeModal = openHowToPlay(this, {
        mode: 'rules',
        onClose: () => {
          this.modalOpen = false
          this.closeModal = null
          panel.setVisible(true)
          glow.setVisible(true)
        },
      })
    })

    const quitBtn = createButton(this, 0, 120, 'QUIT TO MENU', COLORS.danger, COLORS.dangerDeep, 320, 50)
    quitBtn.on('pointerdown', () => {
      if (this.modalOpen) return
      Sfx.stopMusic()
      this.scene.stop('BoardScene')
      this.scene.start('MenuScene')
    })

    const escHint = this.add.text(0, 178, 'Esc to resume', {
      fontSize: '13px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
    }).setOrigin(0.5)

    panel.add([resumeBtn, settingsBtn, helpBtn, quitBtn, escHint])

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.modalOpen) {
        this.closeModal?.()
        return
      }
      resume()
    })
  }
}
