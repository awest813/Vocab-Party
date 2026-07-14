import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { createDimmer, createPanel } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

export class PauseScene extends Phaser.Scene {
  private helpOpen = false
  private closeHelp: (() => void) | null = null
  constructor() {
    super('PauseScene')
  }

  create() {
    const w = this.scale.width
    const h = this.scale.height

    createDimmer(this, 0.62)

    const panel = createPanel(this, {
      x: w / 2,
      y: h / 2,
      width: 420,
      height: 340,
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

    const resumeBtn = createButton(this, 0, -30, 'RESUME', COLORS.mint, 0x2aa866, 300, 52)
    resumeBtn.on('pointerdown', () => {
      this.scene.resume('BoardScene')
      this.scene.stop()
    })

    const quitBtn = createButton(this, 0, 40, 'QUIT TO MENU', COLORS.danger, 0xb83232, 300, 52)
    quitBtn.on('pointerdown', () => {
      this.scene.stop('BoardScene')
      this.scene.start('MenuScene')
    })

    const helpBtn = createButton(this, 0, 110, 'HOW TO PLAY', COLORS.skyDeep, 0x1e5a96, 300, 52)
    helpBtn.on('pointerdown', () => this.showHelp(resumeBtn, quitBtn, helpBtn))

    panel.add([resumeBtn, quitBtn, helpBtn])

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.helpOpen) {
        this.closeHelp?.()
        return
      }
      this.scene.resume('BoardScene')
      this.scene.stop()
    })
  }

  private showHelp(...hide: Phaser.GameObjects.Container[]) {
    if (this.helpOpen) return
    this.helpOpen = true
    hide.forEach(o => o.setVisible(false))
    const w = this.scale.width
    const h = this.scale.height

    const rules = [
      'Roll the dice to move around the board',
      'Land on tiles to answer vocab/grammar questions',
      'Collect Stars (20 coins) to earn trophies',
      'Use items: Dash, Swap, Warp, Shield, and more',
      'Buy shops to collect rent from passing players',
      'Battle when two players land on the same tile',
      'First to 5 trophies wins — points break ties',
    ]

    const helpPanel = createPanel(this, {
      x: w / 2,
      y: h / 2,
      width: 640,
      height: 400,
      border: COLORS.gold,
      borderAlpha: 0.45,
      headerColor: COLORS.goldDeep,
      headerHeight: 48,
      title: 'HOW TO PLAY',
      titleColor: hexColor(COLORS.gold),
      depth: 70,
      animateIn: true,
    })

    const texts = rules.map((rule, i) =>
      this.add.text(0, -130 + i * 36, `•  ${rule}`, {
        fontSize: '16px',
        fontFamily: FONT.body,
        color: hexColor(COLORS.mist),
      }).setOrigin(0.5)
    )

    const closeBtn = createButton(this, 0, 162, 'CLOSE', COLORS.danger, 0xb83232, 180, 46)
    const close = () => {
      if (!this.helpOpen) return
      this.helpOpen = false
      this.closeHelp = null
      helpPanel.destroy(true)
      hide.forEach(o => o.setVisible(true))
    }
    this.closeHelp = close
    closeBtn.on('pointerdown', close)

    helpPanel.add([...texts, closeBtn])
  }
}
