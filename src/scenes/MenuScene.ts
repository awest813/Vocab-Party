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
import { describeSave, readSave } from '../systems/SaveGame'
import { getTickets } from '../systems/Unlocks'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { TILE_COLORS } from '../systems/SpriteFactory'
import { getActiveList } from '../systems/WordLists'

const TILE_PREVIEW_EMOJI: Record<string, string> = {
  vocab: '📖', grammar: '✏️', bonus: '⭐', star: '🏆', mystery: '❓', minigame: '🕹️', swap: '🔄',
}

export class MenuScene extends Phaser.Scene {
  private modalOpen = false
  private closeModal: (() => void) | null = null

  constructor() { super('MenuScene') }

  create() {
    if (isAutoSimMode()) {
      this.scene.start('SetupScene')
      return
    }

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

    Sfx.startMusic('menu')

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
      const leftTrophy = this.add.image(-372, 6, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(52, 52).setAlpha(0.92)
      const rightTrophy = this.add.image(372, 6, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(52, 52).setAlpha(0.92)
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

    const tagline = this.add.text(w / 2, 242, 'Roll · Learn · Win the party', {
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

    this.createTilePreviewRow(w / 2, 292, reduce)

    const startGlow = this.add.ellipse(w / 2, readSave() ? 352 : 368, 440, 110, COLORS.mint, 0.14).setDepth(4)
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

    // With an autosave, CONTINUE takes the hero slot and the rest of the stack shifts down.
    const save = readSave()
    const shift = save ? 64 : 0
    const ctas: Phaser.GameObjects.Container[] = []
    let continueSub: Phaser.GameObjects.Text | undefined
    const goContinue = () => {
      if (this.modalOpen || leaving || !save) return
      leaving = true
      this.cameras.main.fadeOut(380, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('BoardScene', { resume: save })
      })
    }
    if (save) {
      const contBtn = createButton(this, w / 2, 352, '▶  CONTINUE PARTY', COLORS.party, COLORS.partyDeep, 420, 64)
      contBtn.setDepth(6)
      contBtn.on('pointerdown', goContinue)
      ctas.push(contBtn)
      continueSub = this.add.text(w / 2, 394, describeSave(save), {
        fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
      }).setOrigin(0.5).setDepth(6)
    }

    const startBtn = createButton(this, w / 2, 368 + shift + (save ? 16 : 0), save ? '✚  NEW PARTY' : '▶  ENTER PARTY',
      save ? COLORS.skyBtn : COLORS.party, save ? COLORS.skyBtnDeep : COLORS.partyDeep, save ? 360 : 420, save ? 56 : 74)
    startBtn.setDepth(6)
    startBtn.on('pointerdown', goSetup)
    ctas.push(startBtn)

    const goArcade = () => {
      if (this.modalOpen || leaving) return
      leaving = true
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('ArcadeScene')
      })
    }
    const arcadeBtn = createButton(this, w / 2, 456 + shift, '🕹️  MINIGAME ARCADE', COLORS.warning, 0xd9800f, 360, 60)
    arcadeBtn.setDepth(6)
    arcadeBtn.on('pointerdown', goArcade)

    // Four-across utility row: How to Play · Word Book · Word Lists · Settings.
    const howBtn = createButton(this, w / 2 - 282, 532 + shift, 'HOW TO PLAY', COLORS.skyBtn, COLORS.skyBtnDeep, 176, 52)
    howBtn.setDepth(6)
    howBtn.on('pointerdown', () => this.openHowTo())

    // Settings live on the ⚙ button (top right); this slot is the Party Shop.
    const shopBtn = createButton(this, w / 2 + 282, 532 + shift, `🎟️ SHOP · ${getTickets()}`, COLORS.gold, COLORS.goldDeep, 176, 52)
    shopBtn.setDepth(6)
    const goShop = () => {
      if (this.modalOpen || leaving) return
      leaving = true
      this.scene.start('ShopScene')
    }
    shopBtn.on('pointerdown', goShop)

    const bookBtn = createButton(this, w / 2 - 94, 532 + shift, '📖 WORD BOOK', COLORS.mint, 0x2fb56a, 176, 52)
    bookBtn.setDepth(6)
    const goBook = () => {
      if (this.modalOpen || leaving) return
      leaving = true
      this.scene.start('WordBookScene')
    }
    bookBtn.on('pointerdown', goBook)

    const active = getActiveList()
    const listsBtn = createButton(this, w / 2 + 94, 532 + shift, '📝 WORD LISTS', COLORS.teal, COLORS.tealDeep, 176, 52)
    listsBtn.setDepth(6)
    const goLists = () => {
      if (this.modalOpen || leaving) return
      leaving = true
      this.scene.start('WordListScene', { returnTo: 'MenuScene' })
    }
    listsBtn.on('pointerdown', goLists)
    const listsSub = this.add.text(w / 2 + 94, 532 + shift + 36, active ? `Active: ${active.name}` : 'For teachers', {
      fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5, 0).setDepth(6).setAlpha(0)
    this.tweens.add({ targets: listsSub, alpha: 0.85, duration: reduce ? 0 : 400, delay: reduce ? 0 : 900 })

    // Stagger CTA entrance
    if (continueSub) continueSub.setAlpha(0)
    if (continueSub) this.tweens.add({ targets: continueSub, alpha: 1, duration: reduce ? 0 : 400, delay: reduce ? 0 : 300 })
    ;[...ctas, arcadeBtn, howBtn, bookBtn, listsBtn, shopBtn].forEach((btn, i) => {
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
      ? `Tap ${save ? 'CONTINUE PARTY' : 'ENTER PARTY'} to begin`
      : save ? 'Enter = Continue  ·  N = New party  ·  A = Arcade  ·  L = Word Lists  ·  P = Shop  ·  ? = Help' : 'Enter = Start  ·  A = Arcade  ·  W = Word Book  ·  L = Word Lists  ·  P = Shop  ·  ? = Help', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
      align: 'center',
      wordWrap: { width: 900 },
    }).setOrigin(0.5).setDepth(6).setAlpha(0)

    const version = this.add.text(w / 2, h - 22, `v${__APP_VERSION__}  ·  Art: Kenney & Quaternius (CC0)`, {
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

    const onEsc = () => {
      if (this.modalOpen) {
        this.closeModal?.()
        return
      }
    }
    const openHowToFromKeyboard = (ev: KeyboardEvent) => {
      if (this.modalOpen) return
      if (ev.key === '?' || ev.code === 'Slash') this.openHowTo()
    }
    const onHelpKey = () => {
      if (!this.modalOpen) this.openHowTo()
    }
    this.input.keyboard?.on('keydown-ESC', onEsc)
    const onEnterKey = () => (save ? goContinue() : goSetup())
    this.input.keyboard?.on('keydown-ENTER', onEnterKey)
    this.input.keyboard?.on('keydown-N', goSetup)
    this.input.keyboard?.on('keydown-W', goBook)
    this.input.keyboard?.on('keydown-P', goShop)
    this.input.keyboard?.on('keydown-A', goArcade)
    this.input.keyboard?.on('keydown-L', goLists)
    this.input.keyboard?.on('keydown', openHowToFromKeyboard)
    this.input.keyboard?.on('keydown-H', onHelpKey)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', onEsc)
      this.input.keyboard?.off('keydown-ENTER', onEnterKey)
      this.input.keyboard?.off('keydown-N', goSetup)
      this.input.keyboard?.off('keydown-W', goBook)
      this.input.keyboard?.off('keydown-P', goShop)
      this.input.keyboard?.off('keydown-A', goArcade)
      this.input.keyboard?.off('keydown-L', goLists)
      this.input.keyboard?.off('keydown', openHowToFromKeyboard)
      this.input.keyboard?.off('keydown-H', onHelpKey)
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
    })
  }

  private createTilePreviewRow(cx: number, cy: number, reduce: boolean) {
    const previewTypes = ['vocab', 'grammar', 'star', 'minigame', 'mystery', 'swap'] as const
    const spacing = 72
    const startX = cx - ((previewTypes.length - 1) * spacing) / 2

    previewTypes.forEach((type, i) => {
      const x = startX + i * spacing
      const chip = this.add.container(x, cy).setDepth(5).setAlpha(0).setScale(0.85)
      const color = TILE_COLORS[type]
      const bg = this.add.graphics()
      bg.fillStyle(0x000000, 0.28)
      bg.fillRoundedRect(-28, -24, 56, 48, 10)
      bg.fillStyle(color, 0.92)
      bg.fillRoundedRect(-26, -26, 52, 44, 10)
      bg.lineStyle(2, 0xffffff, 0.45)
      bg.strokeRoundedRect(-26, -26, 52, 44, 10)
      chip.add(bg)

      // Same glyphs as the board so the menu previews the real tiles.
      chip.add(this.add.text(0, -4, TILE_PREVIEW_EMOJI[type] ?? '?', {
        fontSize: '24px',
      }).setOrigin(0.5))

      chip.y += 12
      this.tweens.add({
        targets: chip,
        alpha: 1,
        y: cy,
        scaleX: 1,
        scaleY: 1,
        duration: reduce ? 0 : 360,
        delay: reduce ? 0 : 320 + i * 55,
        ease: 'Back.easeOut',
      })

      if (!reduce) {
        this.tweens.add({
          targets: chip,
          y: cy - 6,
          duration: 1400 + i * 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
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
