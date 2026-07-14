import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { createDimmer, createPanel, paintStage } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { isAutoSimMode } from '../systems/gameFlags'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

export class MenuScene extends Phaser.Scene {
  private howToPlayOpen = false
  constructor() { super('MenuScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height

    paintStage(this)
    addStarfieldBackdrop(this, 0.48)
    addAmbientMotes(this, 24)
    this.createParallaxStars()

    const spotlight = this.add.ellipse(w / 2, 150, 720, 220, COLORS.gold, 0.07).setDepth(0)
    this.tweens.add({
      targets: spotlight,
      alpha: 0.12,
      scaleX: 1.06,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const titleContainer = this.add.container(w / 2, 148)

    if (this.textures.exists(TEXTURE_KEYS.kenneyTrophy)) {
      const leftTrophy = this.add.image(-310, 8, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(48, 48).setAlpha(0.9)
      const rightTrophy = this.add.image(310, 8, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(48, 48).setAlpha(0.9)
      titleContainer.add([leftTrophy, rightTrophy])
      this.tweens.add({
        targets: [leftTrophy, rightTrophy],
        y: '-=8',
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
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

    this.tweens.add({
      targets: titleContainer,
      y: 158,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.add.text(w / 2, 232, 'Roll · Learn · Win the party', {
      fontSize: '22px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5).setAlpha(0.85)

    const startGlow = this.add.ellipse(w / 2, 380, 420, 100, COLORS.mint, 0.12)
    this.tweens.add({
      targets: startGlow,
      alpha: 0.05,
      scaleX: 1.08,
      duration: 1100,
      yoyo: true,
      repeat: -1,
    })

    const startBtn = createButton(this, w / 2, 380, '▶  ENTER PARTY', 0x2ad46a, 0x1fad55, 400, 72)
    startBtn.on('pointerdown', () => this.goSetup())

    const howBtn = createButton(this, w / 2, 468, 'HOW TO PLAY', 0x3d8fff, 0x2a6fd4, 360, 56)
    howBtn.on('pointerdown', () => this.showHowToPlay())

    // Atmospheric tile chips — preview the board language without cluttering the CTA
    const chips = [
      { emoji: '📖', color: COLORS.sky },
      { emoji: '✏️', color: COLORS.warning },
      { emoji: '⭐', color: COLORS.gold },
      { emoji: '❓', color: 0xaa66ff },
      { emoji: '🕹️', color: 0xff66aa },
      { emoji: '🔄', color: COLORS.teal },
    ]
    const chipY = 560
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
      this.tweens.add({
        targets: wrap,
        y: chipY - 6,
        duration: 1800 + i * 120,
        yoyo: true,
        repeat: -1,
        delay: 600 + i * 90,
        ease: 'Sine.easeInOut',
      })
    })

    if (isAutoSimMode()) {
      this.scene.start('SetupScene')
    }

    this.add.text(w / 2, h - 28, 'v2.0  ·  Phaser 3', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
    }).setOrigin(0.5)

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.howToPlayOpen) return
      this.showHowToPlay()
    })
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.howToPlayOpen) return
      this.goSetup()
    })

    this.cameras.main.fadeIn(420, 7, 11, 20)

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

  private goSetup() {
    this.cameras.main.fadeOut(380, 0, 0, 0)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('SetupScene')
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

  showHowToPlay() {
    if (this.howToPlayOpen) return
    this.howToPlayOpen = true
    const w = this.scale.width
    const h = this.scale.height

    const root = this.add.container(0, 0).setDepth(80)
    const overlay = createDimmer(this, 0.58)
    overlay.setDepth(79)

    const panel = createPanel(this, {
      x: w / 2,
      y: h / 2,
      width: 820,
      height: 520,
      border: COLORS.gold,
      borderAlpha: 0.45,
      headerColor: COLORS.goldDeep,
      headerHeight: 48,
      title: 'HOW TO PLAY',
      titleColor: hexColor(COLORS.gold),
      animateIn: true,
      depth: 80,
    })

    const instrText = this.add.text(w / 2, h / 2 - 168, 'Take turns rolling the dice and moving around the board.', {
      fontSize: '17px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
      align: 'center',
    }).setOrigin(0.5).setDepth(81)

    const tileItems = [
      { emoji: '📖', label: 'Vocab', desc: 'Answer a vocabulary question (+10)', color: COLORS.sky },
      { emoji: '✏️', label: 'Grammar', desc: 'Fix a grammar problem (+10)', color: COLORS.warning },
      { emoji: '⭐', label: 'Bonus', desc: 'Earn 5 bonus points automatically!', color: COLORS.gold },
      { emoji: '❓', label: 'Mystery', desc: 'Random surprise effect!', color: 0xaa66ff },
      { emoji: '🕹️', label: 'Minigame', desc: 'Everyone plays, winner gets +15', color: 0xff66aa },
      { emoji: '🔄', label: 'Swap', desc: 'Trade board positions with a player', color: COLORS.teal },
    ]

    const cols = 2
    const itemW = 360
    const itemH = 54
    const gridX = w / 2 - itemW - 12
    const gridStartY = h / 2 - 118
    const tileObjects: Phaser.GameObjects.GameObject[] = []

    tileItems.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = gridX + col * (itemW + 24)
      const y = gridStartY + row * (itemH + 12)

      const g = this.add.graphics().setDepth(81)
      g.fillStyle(item.color, 0.12)
      g.fillRoundedRect(x, y, itemW, itemH, 10)
      g.lineStyle(1.5, item.color, 0.55)
      g.strokeRoundedRect(x, y, itemW, itemH, 10)

      const emojiT = this.add.text(x + 14, y + itemH / 2, item.emoji, { fontSize: '22px' }).setOrigin(0, 0.5).setDepth(81)
      const labelT = this.add.text(x + 50, y + itemH / 2 - 9, item.label, {
        fontSize: '15px', fontFamily: FONT.display, color: '#f2f7ff',
      }).setOrigin(0, 0.5).setDepth(81)
      const descT = this.add.text(x + 50, y + itemH / 2 + 11, item.desc, {
        fontSize: '12px', fontFamily: FONT.body, color: '#8fa6bf',
      }).setOrigin(0, 0.5).setDepth(81)
      tileObjects.push(g, emojiT, labelT, descT)
    })

    const winText = this.add.text(w / 2, h / 2 + 178, 'Most points win — round count is set in setup. Solo play works too.', {
      fontSize: '16px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
      stroke: '#3a2800',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(81)

    const closeBtn = createButton(this, w / 2, h / 2 + 228, 'CLOSE', COLORS.danger, 0xb83232, 200, 48)
    closeBtn.setDepth(81)

    root.add([panel, instrText, ...tileObjects, winText, closeBtn])

    const destroy = () => {
      if (!this.howToPlayOpen) return
      this.howToPlayOpen = false
      this.input.keyboard?.off('keydown-ESC', onEsc)
      overlay.destroy()
      root.destroy(true)
    }
    const onEsc = () => destroy()
    closeBtn.on('pointerdown', destroy)
    overlay.on('pointerdown', destroy)
    this.input.keyboard?.on('keydown-ESC', onEsc)
  }
}
