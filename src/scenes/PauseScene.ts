import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { createDimmer, createPanel } from '../ui/Panel'
import { COLORS } from '../ui/Theme'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { openHowToPlay } from '../ui/HowToPlay'
import { openSettingsPanel } from '../ui/SettingsPanel'
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

    Sfx.pause()
    createDimmer(this, 0.62)

    const panel = createPanel(this, {
      x: w / 2,
      y: h / 2,
      width: 420,
      height: 400,
      border: COLORS.sky,
      borderAlpha: 0.5,
      headerColor: COLORS.skyDeep,
      headerHeight: 52,
      title: 'PAUSED',
      titleColor: '#ffffff',
      depth: 60,
      animateIn: true,
    })

    if (this.textures.exists(TEXTURE_KEYS.kenneyCardBlue)) {
      panel.add(
        this.add.image(0, 16, TEXTURE_KEYS.kenneyCardBlue)
          .setDisplaySize(280, 200)
          .setAlpha(0.08)
      )
    }

    const resume = () => {
      if (this.modalOpen) return
      this.scene.resume('BoardScene')
      this.scene.stop()
    }

    const resumeBtn = createButton(this, 0, -70, 'RESUME', COLORS.party, COLORS.partyDeep, 300, 52)
    resumeBtn.on('pointerdown', resume)

    const settingsBtn = createButton(this, 0, -5, 'SETTINGS', COLORS.bgPanelAlt, COLORS.chromeDeep, 300, 50)
    settingsBtn.on('pointerdown', () => {
      if (this.modalOpen) return
      this.modalOpen = true
      panel.setVisible(false)
      this.closeModal = openSettingsPanel(this, {
        onClose: () => {
          this.modalOpen = false
          this.closeModal = null
          panel.setVisible(true)
        },
      })
    })

    const helpBtn = createButton(this, 0, 55, 'HOW TO PLAY', COLORS.skyDeep, COLORS.skyBtnDeep, 300, 50)
    helpBtn.on('pointerdown', () => {
      if (this.modalOpen) return
      this.modalOpen = true
      panel.setVisible(false)
      this.closeModal = openHowToPlay(this, {
        mode: 'rules',
        onClose: () => {
          this.modalOpen = false
          this.closeModal = null
          panel.setVisible(true)
        },
      })
    })

    const quitBtn = createButton(this, 0, 120, 'QUIT TO MENU', COLORS.danger, COLORS.dangerDeep, 300, 50)
    quitBtn.on('pointerdown', () => {
      if (this.modalOpen) return
      Sfx.stopMusic()
      this.scene.stop('BoardScene')
      this.scene.start('MenuScene')
    })

    panel.add([resumeBtn, settingsBtn, helpBtn, quitBtn])

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.modalOpen) {
        this.closeModal?.()
        return
      }
      resume()
    })
  }
}
