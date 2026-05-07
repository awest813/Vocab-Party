import Phaser from 'phaser'
import { BUNDLED_GAME_ASSETS, EXTERNAL_ASSETS, TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import {
  PLAYER_TEXTURE_KEYS,
  TILE_TEXTURE_KEY,
  BOARD_TILE_TYPES,
  generateDiceTextures,
  generatePlayerTextures,
  generateTileTextures,
  DICE_TEXTURE_KEYS,
} from '../systems/SpriteFactory'

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene') }

  preload() {
    const w = this.scale.width
    const h = this.scale.height

    // Loading bar background
    this.add.rectangle(w / 2, h / 2, 400, 24, 0x333355)
      .setStrokeStyle(3, 0xffffff)
    const bar = this.add.rectangle(w / 2 - 200, h / 2, 0, 20, 0x88aaff)
    bar.setOrigin(0, 0.5)

    const titleText = this.add.text(w / 2, h / 2 - 60, 'VOCAB PARTY', {
      fontSize: '48px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#3333aa',
      strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, h / 2 + 40, 'Loading...', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#aaaacc'
    }).setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      bar.width = 400 * value
    })
    
    this.load.on('complete', () => console.log('PreloadScene: Loader complete'))
    this.load.on('loaderror', (file: any) => console.error('PreloadScene: Load error on', file.src))

    // Bounce title
    this.tweens.add({
      targets: titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Load JSON data
    this.load.json('vocab', 'data/vocab.json')
    this.load.json('grammar', 'data/grammar.json')

    // Phaser 3 official examples asset mirror (samme/phaser3-examples-assets)
    this.load.image(TEXTURE_KEYS.starfield, EXTERNAL_ASSETS.starfield)
    this.load.image(TEXTURE_KEYS.particleYellow, EXTERNAL_ASSETS.particleYellow)
    this.load.image(TEXTURE_KEYS.particleRed, EXTERNAL_ASSETS.particleRed)
    this.load.image(TEXTURE_KEYS.particleBlue, EXTERNAL_ASSETS.particleBlue)
    this.load.image(TEXTURE_KEYS.particleSquare, EXTERNAL_ASSETS.particleSquare)
    this.load.image(TEXTURE_KEYS.gem, EXTERNAL_ASSETS.gem)
    this.load.image(TEXTURE_KEYS.starSmall, EXTERNAL_ASSETS.starSmall)
    this.load.spritesheet(TEXTURE_KEYS.coin, EXTERNAL_ASSETS.coinSheet, {
      frameWidth: 16,
      frameHeight: 16
    })

    // Dice and Tiles are generated procedurally in SpriteFactory

    BUNDLED_GAME_ASSETS.quaterniusPlayers.forEach((path, i) => {
      this.load.image(PLAYER_TEXTURE_KEYS[i], path)
    })
    // We now use procedural generation for all tiles in SpriteFactory to ensure a premium look
    // and avoid 404/WebGL texture conflicts.
  }

  create() {
    console.log('PreloadScene: create() started')
    try {
      generateDiceTextures(this)
      console.log('PreloadScene: Dice textures generated')
      generatePlayerTextures(this)
      console.log('PreloadScene: Player textures generated')
      generateTileTextures(this)
      console.log('PreloadScene: Tile textures generated')
      
      console.log('PreloadScene: Starting MenuScene...')
      this.scene.start('MenuScene')
    } catch (e) {
      console.error('PreloadScene: Error in create()', e)
    }
  }
}
