import Phaser from 'phaser'
import { EXTERNAL_ASSETS, TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import {
  generateDiceTextures,
  generatePlayerTextures,
  generateTileTextures,
} from '../systems/SpriteFactory'
import { paintStage } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { isAutoSimMode } from '../systems/gameFlags'
import { generateFxTextures } from '../systems/ProceduralFx'
import { setLexiconFromCache } from '../systems/WordLists'
import { createButton } from '../ui/Button'

export class PreloadScene extends Phaser.Scene {
  private loadFailed = false
  private missingImages: string[] = []

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
      if (this.loadFailed) return
      statusText.setText('Ready!')
      barFill.clear()
      barFill.fillStyle(COLORS.mint, 1)
      barFill.fillRoundedRect(w / 2 - barW / 2 + 4, h / 2 + 12, barW - 8, 20, 8)
    })

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      // Only the question banks are essential: the lexicon has a built-in fallback and a missing
      // image gets a blank placeholder, so neither should stop the game.
      if (file.type !== 'json' || file.key === 'lexicon') {
        this.missingImages.push(file.key)
        return
      }
      this.loadFailed = true
      console.error('PreloadScene: Load error on', file.src)
      statusText.setText('Load failed — check your connection and refresh.')
      statusText.setColor(hexColor(COLORS.danger))
    })

    this.load.json('vocab', 'data/vocab.json')
    this.load.json('grammar', 'data/grammar.json')
    this.load.json('lexicon', 'data/lexicon.json')

    this.load.image(TEXTURE_KEYS.kenneyStar, EXTERNAL_ASSETS.kenneyStar)
    this.load.image(TEXTURE_KEYS.kenneyTrophy, EXTERNAL_ASSETS.kenneyTrophy)
    this.load.image(TEXTURE_KEYS.kenneyCart, EXTERNAL_ASSETS.kenneyCart)
    this.load.image(TEXTURE_KEYS.kenneyGamepad, EXTERNAL_ASSETS.kenneyGamepad)
    this.load.image(TEXTURE_KEYS.kenneyQuestion, EXTERNAL_ASSETS.kenneyQuestion)
    this.load.image(TEXTURE_KEYS.kenneyHome, EXTERNAL_ASSETS.kenneyHome)
    this.load.image(TEXTURE_KEYS.kenneyReturn, EXTERNAL_ASSETS.kenneyReturn)
    this.load.image(TEXTURE_KEYS.kenneyDie1, EXTERNAL_ASSETS.kenneyDie1)
    this.load.image(TEXTURE_KEYS.kenneyDie2, EXTERNAL_ASSETS.kenneyDie2)
    this.load.image(TEXTURE_KEYS.kenneyDie3, EXTERNAL_ASSETS.kenneyDie3)
    this.load.image(TEXTURE_KEYS.kenneyDie4, EXTERNAL_ASSETS.kenneyDie4)
    this.load.image(TEXTURE_KEYS.kenneyDie5, EXTERNAL_ASSETS.kenneyDie5)
    this.load.image(TEXTURE_KEYS.kenneyDie6, EXTERNAL_ASSETS.kenneyDie6)
    this.load.image(TEXTURE_KEYS.kenneyCardRed, EXTERNAL_ASSETS.kenneyCardRed)
    this.load.image(TEXTURE_KEYS.kenneyCardBlue, EXTERNAL_ASSETS.kenneyCardBlue)
    this.load.image(TEXTURE_KEYS.kenneyCardGreen, EXTERNAL_ASSETS.kenneyCardGreen)
    this.load.image(TEXTURE_KEYS.kenneyCardHearts, EXTERNAL_ASSETS.kenneyCardHearts)
    this.load.image(TEXTURE_KEYS.kenneyCardClubs, EXTERNAL_ASSETS.kenneyCardClubs)
    this.load.image(TEXTURE_KEYS.kenneyCardDiamonds, EXTERNAL_ASSETS.kenneyCardDiamonds)
    this.load.image(TEXTURE_KEYS.charRanger, EXTERNAL_ASSETS.charRanger)
    this.load.image(TEXTURE_KEYS.charRogue, EXTERNAL_ASSETS.charRogue)
    this.load.image(TEXTURE_KEYS.charWarrior, EXTERNAL_ASSETS.charWarrior)
    this.load.image(TEXTURE_KEYS.charWizard, EXTERNAL_ASSETS.charWizard)
  }

  private questionDataReady(): boolean {
    const vocab = this.cache.json.get('vocab')?.questions
    const grammar = this.cache.json.get('grammar')?.questions
    return Array.isArray(vocab) && vocab.length > 0 && Array.isArray(grammar) && grammar.length > 0
  }

  create() {
    if (this.loadFailed || !this.questionDataReady()) {
      this.showLoadError()
      return
    }

    for (const key of this.missingImages) {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, document.createElement('canvas'))
    }
    generateFxTextures(this)
    generateDiceTextures(this)
    generatePlayerTextures(this)
    generateTileTextures(this)
    // Lets teacher word lists auto-fill definitions, synonyms and sentences for words the game knows.
    setLexiconFromCache(this.cache)

    this.cameras.main.fadeIn(isAutoSimMode() ? 40 : 360, 7, 11, 20)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.cameras.main.fadeOut(isAutoSimMode() ? 40 : 420, 7, 11, 20)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('MenuScene')
      })
    })
  }

  private showLoadError() {
    const w = this.scale.width
    const h = this.scale.height
    // Replace the loading UI entirely so the error isn't drawn over a half-full bar.
    this.tweens.killAll()
    this.children.removeAll(true)
    paintStage(this)
    this.add.text(w / 2, h / 2 - 60, 'Could not load the game', {
      fontSize: '28px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.danger),
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5)
    this.add.text(w / 2, h / 2 - 10, 'The word lists didn’t download. Check your internet connection and try again.', {
      fontSize: '16px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5)
    const retry = createButton(this, w / 2, h / 2 + 70, '↻  TRY AGAIN', COLORS.party, COLORS.partyDeep, 240, 54)
    retry.on('pointerdown', () => window.location.reload())
    this.input.keyboard?.once('keydown-ENTER', () => window.location.reload())
  }
}
