import Phaser from 'phaser'
import { EXTERNAL_ASSETS, TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import {
  generateDiceTextures,
  generatePlayerTextures,
  generateTileTextures,
} from '../systems/SpriteFactory'
import { paintStage } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene') }

  preload() {
    const w = this.scale.width
    const h = this.scale.height

    paintStage(this)

    const titleText = this.add.text(w / 2, h / 2 - 90, 'VOCAB PARTY', {
      fontSize: '52px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
      stroke: hexColor(COLORS.goldDeep),
      strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: titleText,
      alpha: 1,
      y: h / 2 - 108,
      duration: 480,
      ease: 'Cubic.easeOut',
    })

    this.add.text(w / 2, h / 2 - 48, 'Getting the party ready…', {
      fontSize: '16px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5)

    // Loading bar
    const barW = 440
    const barBg = this.add.graphics()
    barBg.fillStyle(COLORS.bgPanel, 0.95)
    barBg.fillRoundedRect(w / 2 - barW / 2, h / 2 + 8, barW, 28, 10)
    barBg.lineStyle(2, COLORS.sky, 0.4)
    barBg.strokeRoundedRect(w / 2 - barW / 2, h / 2 + 8, barW, 28, 10)

    const barFill = this.add.graphics()
    const statusText = this.add.text(w / 2, h / 2 + 58, 'Loading assets…', {
      fontSize: '15px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
    }).setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      barFill.clear()
      const fillW = Math.max(8, (barW - 8) * value)
      barFill.fillStyle(COLORS.teal, 1)
      barFill.fillRoundedRect(w / 2 - barW / 2 + 4, h / 2 + 12, fillW, 20, 8)
      barFill.fillStyle(0xffffff, 0.18)
      barFill.fillRoundedRect(w / 2 - barW / 2 + 6, h / 2 + 14, fillW - 4, 8, 4)
    })

    this.load.on('complete', () => {
      statusText.setText('Ready!')
      barFill.clear()
      barFill.fillStyle(COLORS.mint, 1)
      barFill.fillRoundedRect(w / 2 - barW / 2 + 4, h / 2 + 12, barW - 8, 20, 8)
    })

    this.load.on('loaderror', (file: any) => console.error('PreloadScene: Load error on', file.src))

    this.load.json('vocab', 'data/vocab.json')
    this.load.json('grammar', 'data/grammar.json')

    this.load.image(TEXTURE_KEYS.starfield, EXTERNAL_ASSETS.starfield)
    this.load.image(TEXTURE_KEYS.particleYellow, EXTERNAL_ASSETS.particleYellow)
    this.load.image(TEXTURE_KEYS.particleRed, EXTERNAL_ASSETS.particleRed)
    this.load.image(TEXTURE_KEYS.particleBlue, EXTERNAL_ASSETS.particleBlue)
    this.load.image(TEXTURE_KEYS.particleSquare, EXTERNAL_ASSETS.particleSquare)
    this.load.image(TEXTURE_KEYS.particleWhite, EXTERNAL_ASSETS.particleWhite)
    this.load.image(TEXTURE_KEYS.particleGreen, EXTERNAL_ASSETS.particleGreen)
    this.load.image(TEXTURE_KEYS.flame1, EXTERNAL_ASSETS.flame1)
    this.load.image(TEXTURE_KEYS.flame2, EXTERNAL_ASSETS.flame2)
    this.load.image(TEXTURE_KEYS.muzzleflash, EXTERNAL_ASSETS.muzzleflash)
    this.load.image(TEXTURE_KEYS.gem, EXTERNAL_ASSETS.gem)
    this.load.image(TEXTURE_KEYS.diamond, EXTERNAL_ASSETS.diamond)
    this.load.image(TEXTURE_KEYS.orbRed, EXTERNAL_ASSETS.orbRed)
    this.load.image(TEXTURE_KEYS.orbBlue, EXTERNAL_ASSETS.orbBlue)
    this.load.image(TEXTURE_KEYS.firstaid, EXTERNAL_ASSETS.firstaid)
    this.load.image(TEXTURE_KEYS.starSmall, EXTERNAL_ASSETS.starSmall)
    this.load.image(TEXTURE_KEYS.skySpace3, EXTERNAL_ASSETS.skySpace3)
    this.load.image(TEXTURE_KEYS.skyNebula, EXTERNAL_ASSETS.skyNebula)
    this.load.spritesheet(TEXTURE_KEYS.coin, EXTERNAL_ASSETS.coinSheet, {
      frameWidth: 16,
      frameHeight: 16,
    })
    this.load.image(TEXTURE_KEYS.kenneyStar, EXTERNAL_ASSETS.kenneyStar)
    this.load.image(TEXTURE_KEYS.kenneyTrophy, EXTERNAL_ASSETS.kenneyTrophy)
    this.load.image(TEXTURE_KEYS.kenneyCart, EXTERNAL_ASSETS.kenneyCart)
    this.load.image(TEXTURE_KEYS.kenneyGamepad, EXTERNAL_ASSETS.kenneyGamepad)
    this.load.image(TEXTURE_KEYS.kenneyQuestion, EXTERNAL_ASSETS.kenneyQuestion)
    this.load.image(TEXTURE_KEYS.kenneyHome, EXTERNAL_ASSETS.kenneyHome)
    this.load.image(TEXTURE_KEYS.kenneyReturn, EXTERNAL_ASSETS.kenneyReturn)
    this.load.image(TEXTURE_KEYS.kenneyCardRed, EXTERNAL_ASSETS.kenneyCardRed)
    this.load.image(TEXTURE_KEYS.kenneyCardBlue, EXTERNAL_ASSETS.kenneyCardBlue)
    this.load.image(TEXTURE_KEYS.kenneyCardGreen, EXTERNAL_ASSETS.kenneyCardGreen)
    this.load.image(TEXTURE_KEYS.charPhaserDude, EXTERNAL_ASSETS.charPhaserDude)
    this.load.image(TEXTURE_KEYS.charMushroom, EXTERNAL_ASSETS.charMushroom)
    this.load.image(TEXTURE_KEYS.charBunny, EXTERNAL_ASSETS.charBunny)
    this.load.image(TEXTURE_KEYS.charMaster, EXTERNAL_ASSETS.charMaster)
    this.load.image(TEXTURE_KEYS.charRanger, EXTERNAL_ASSETS.charRanger)
    this.load.image(TEXTURE_KEYS.charRogue, EXTERNAL_ASSETS.charRogue)
    this.load.image(TEXTURE_KEYS.charWarrior, EXTERNAL_ASSETS.charWarrior)
    this.load.image(TEXTURE_KEYS.charWizard, EXTERNAL_ASSETS.charWizard)
  }

  create() {
    generateDiceTextures(this)
    generatePlayerTextures(this)
    generateTileTextures(this)

    this.cameras.main.fadeIn(360, 7, 11, 20)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.cameras.main.fadeOut(420, 7, 11, 20)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('MenuScene')
      })
    })
  }
}
