import Phaser from 'phaser'
import { EXTERNAL_ASSETS, TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import {
  generateDiceTextures,
  generatePlayerTextures,
  generateTileTextures,
} from '../systems/SpriteFactory'

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene') }

  preload() {
    const w = this.scale.width
    const h = this.scale.height

    // Dark loading backdrop
    this.add.rectangle(w / 2, h / 2, w, h, 0x030312)

    // Animated title
    const titleText = this.add.text(w / 2, h / 2 - 80, 'VOCAB PARTY', {
      fontSize: '52px',
      fontFamily: 'Fredoka, Arial Black, Arial',
      color: '#ffffff',
      stroke: '#3333aa',
      strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({ targets: titleText, alpha: 1, y: h / 2 - 100, duration: 500, ease: 'Cubic.easeOut' })

    // Loading bar with glow
    const barBg = this.add.rectangle(w / 2, h / 2 + 20, 420, 28, 0x111133).setStrokeStyle(2, 0x4488ff, 0.4)
    const barFill = this.add.rectangle(w / 2 - 210, h / 2 + 20, 0, 22, 0x4488ff).setOrigin(0, 0.5)
    const barGlow = this.add.rectangle(w / 2 - 210, h / 2 + 20, 0, 28, 0x4488ff, 0.2).setOrigin(0, 0.5)

    const statusText = this.add.text(w / 2, h / 2 + 60, 'Loading assets...', {
      fontSize: '16px',
      fontFamily: 'Fredoka, Arial',
      color: '#6688aa'
    }).setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      barFill.width = 416 * value
      barGlow.width = 416 * value
    })

    this.load.on('complete', () => {
      statusText.setText('Ready!')
      this.tweens.add({
        targets: barFill,
        fillColor: 0x44ff88,
        duration: 200
      })
    })

    this.load.on('loaderror', (file: any) => console.error('PreloadScene: Load error on', file.src))

    // Load JSON data
    this.load.json('vocab', 'data/vocab.json')
    this.load.json('grammar', 'data/grammar.json')

    // External assets
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
      frameHeight: 16
    })
    // Kenney game icons
    this.load.image(TEXTURE_KEYS.kenneyStar, EXTERNAL_ASSETS.kenneyStar)
    this.load.image(TEXTURE_KEYS.kenneyTrophy, EXTERNAL_ASSETS.kenneyTrophy)
    this.load.image(TEXTURE_KEYS.kenneyCart, EXTERNAL_ASSETS.kenneyCart)
    this.load.image(TEXTURE_KEYS.kenneyGamepad, EXTERNAL_ASSETS.kenneyGamepad)
    this.load.image(TEXTURE_KEYS.kenneyQuestion, EXTERNAL_ASSETS.kenneyQuestion)
    this.load.image(TEXTURE_KEYS.kenneyHome, EXTERNAL_ASSETS.kenneyHome)
    this.load.image(TEXTURE_KEYS.kenneyReturn, EXTERNAL_ASSETS.kenneyReturn)
    // Kenney card backs
    this.load.image(TEXTURE_KEYS.kenneyCardRed, EXTERNAL_ASSETS.kenneyCardRed)
    this.load.image(TEXTURE_KEYS.kenneyCardBlue, EXTERNAL_ASSETS.kenneyCardBlue)
    this.load.image(TEXTURE_KEYS.kenneyCardGreen, EXTERNAL_ASSETS.kenneyCardGreen)
    // Character sprites
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

    this.cameras.main.fadeIn(400, 3, 3, 18)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.cameras.main.fadeOut(500, 3, 3, 18)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('MenuScene')
      })
    })
  }
}
