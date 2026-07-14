import Phaser from 'phaser'
import { createButton } from '../ui/Button'
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

    this.add.rectangle(0, 0, w, h, 0x000000, 0.6).setOrigin(0)

    const panel = this.add.container(w / 2, h / 2)
    const cardTex = TEXTURE_KEYS.kenneyCardBlue
    const hasCard = this.textures.exists(cardTex)
    const bg = hasCard
      ? this.add.image(0, 0, cardTex).setDisplaySize(420, 380).setAlpha(0.88)
      : this.add.rectangle(0, 0, 420, 380, 0x1a2a4a, 0.9)
    if (!hasCard) (bg as Phaser.GameObjects.Rectangle).setStrokeStyle(4, 0x4488ff, 0.6)

    const title = this.add.text(0, -140, '⏸️ PAUSED', {
      fontSize: '40px',
      fontFamily: 'Fredoka, Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5)

    const resume = () => {
      if (this.modalOpen) return
      Sfx.uiClick()
      this.scene.resume('BoardScene')
      this.scene.stop()
    }

    const resumeBtn = createButton(this, 0, -50, 'RESUME', 0x22bb55, 0x1a8844, 300, 52)
    resumeBtn.on('pointerdown', resume)

    const settingsBtn = createButton(this, 0, 15, '⚙️ SETTINGS', 0x334466, 0x223355, 300, 50)
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

    const helpBtn = createButton(this, 0, 75, 'HOW TO PLAY', 0x4488ff, 0x224488, 300, 50)
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

    const quitBtn = createButton(this, 0, 140, 'QUIT TO MENU', 0xaa2222, 0x881111, 300, 50)
    quitBtn.on('pointerdown', () => {
      if (this.modalOpen) return
      Sfx.uiClick()
      Sfx.stopMusic()
      this.scene.stop('BoardScene')
      this.scene.start('MenuScene')
    })

    panel.add([bg, title, resumeBtn, settingsBtn, helpBtn, quitBtn])
    panel.setScale(0.85).setAlpha(0)
    this.tweens.add({
      targets: panel,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 280,
      ease: 'Back.easeOut',
    })

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.modalOpen) {
        this.closeModal?.()
        return
      }
      resume()
    })
  }
}
