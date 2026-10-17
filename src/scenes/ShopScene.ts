import Phaser from 'phaser'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import { unlock } from '../systems/Achievements'
import { generateDiceTextures, generatePlayerTextures, goldenPreviewKey } from '../systems/SpriteFactory'
import { buy, equip, getTickets, isEquipped, isOwned, UNLOCKS, type UnlockItem, type UnlockKind } from '../systems/Unlocks'
import { createButton, setButtonEnabled, setButtonFill } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { addVignette, paintStage } from '../ui/Panel'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { COLORS, FONT, hexColor } from '../ui/Theme'

const TABS: { kind: UnlockKind; label: string }[] = [
  { kind: 'dice', label: '🎲 Dice' },
  { kind: 'golden', label: '✨ Characters' },
  { kind: 'confetti', label: '🎉 Confetti' },
  { kind: 'music', label: '🎵 Music' },
]

const CARD_W = 268
const CARD_H = 210

/** Party Shop: spend Party Tickets (earned by playing) on cosmetic unlocks. */
export class ShopScene extends Phaser.Scene {
  private tab: UnlockKind = 'dice'
  private grid?: Phaser.GameObjects.Container
  private ticketText!: Phaser.GameObjects.Text
  private tabButtons: Phaser.GameObjects.Container[] = []

  constructor() { super('ShopScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height
    this.tab = 'dice'
    this.grid = undefined
    this.tabButtons = []

    paintStage(this)
    addStarfieldBackdrop(this, 0.45)
    addVignette(this, 0.55, -4)
    if (!shouldReduceMotion()) addAmbientMotes(this, 18)
    Sfx.startMusic('menu')
    this.cameras.main.fadeIn(260, 7, 11, 20)

    this.add.text(w / 2, 54, '🎟️ PARTY SHOP', {
      fontSize: '46px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      stroke: hexColor(COLORS.goldDeep), strokeThickness: 8,
    }).setOrigin(0.5)
    this.add.text(w / 2, 98, 'Earn tickets by finishing parties, winning Arcade medals and unlocking achievements', {
      fontSize: '16px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5)

    const back = createButton(this, 86, 50, '◀ MENU', COLORS.bgPanelAlt, COLORS.chromeDeep, 140, 50)
    back.on('pointerdown', () => this.leave())

    const wallet = this.add.graphics()
    wallet.fillStyle(COLORS.bgPanelAlt, 1)
    wallet.fillRoundedRect(w - 236, 26, 200, 50, 14)
    wallet.lineStyle(2.5, COLORS.gold, 0.7)
    wallet.strokeRoundedRect(w - 236, 26, 200, 50, 14)
    this.ticketText = this.add.text(w - 136, 51, '', {
      fontSize: '24px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
    }).setOrigin(0.5)
    this.refreshWallet()

    TABS.forEach((t, i) => {
      const btn = createButton(this, w / 2 + (i - 1.5) * 220, 150, t.label, COLORS.bgPanelAlt, COLORS.chromeDeep, 200, 46)
      btn.on('pointerdown', () => this.setTab(t.kind))
      this.tabButtons.push(btn)
    })

    const touch = isTouchPreferred(this.sys.game)
    this.add.text(w / 2, h - 18, touch ? 'Tap an item to buy or equip it' : '1–4 switch tabs · click an item to buy or equip · Esc back', {
      fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
    }).setOrigin(0.5, 1)

    const onKey = (ev: KeyboardEvent) => {
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(ev.code)
      if (idx >= 0) this.setTab(TABS[idx].kind)
      else if (ev.code === 'Escape') this.leave()
    }
    this.input.keyboard?.on('keydown', onKey)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey))

    this.setTab('dice')
  }

  private leave() {
    Sfx.uiClick()
    this.scene.start('MenuScene')
  }

  private refreshWallet() {
    this.ticketText.setText(`🎟️ ${getTickets()}`)
  }

  private setTab(kind: UnlockKind) {
    this.tab = kind
    TABS.forEach((t, i) => setButtonFill(this.tabButtons[i], t.kind === kind ? COLORS.skyDeep : COLORS.bgPanelAlt))
    this.renderGrid()
  }

  private renderGrid() {
    this.grid?.destroy()
    const w = this.scale.width
    const items = UNLOCKS.filter(u => u.kind === this.tab)
    const cols = 4
    const gap = 16
    const rows = Math.ceil(items.length / cols)
    const top = rows > 1 ? 196 : 240
    this.grid = this.add.container(0, 0)
    items.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, items.length - row * cols)
      const x = w / 2 + (col - (inRow - 1) / 2) * (CARD_W + gap)
      const y = top + row * (CARD_H + gap) + CARD_H / 2
      this.grid!.add(this.buildCard(item, x, y))
    })
  }

  private buildCard(item: UnlockItem, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y)
    const owned = isOwned(item.id)
    const equipped = isEquipped(item.id)
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.35)
    g.fillRoundedRect(-CARD_W / 2 + 3, -CARD_H / 2 + 5, CARD_W, CARD_H, 16)
    g.fillStyle(COLORS.bgPanel, 0.96)
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16)
    g.lineStyle(3, equipped ? COLORS.party : owned ? COLORS.sky : COLORS.gold, equipped ? 1 : 0.55)
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16)
    c.add(g)

    c.add(this.preview(item, 0, -CARD_H / 2 + 54))
    c.add(this.add.text(0, 6, item.name, {
      fontSize: '19px', fontFamily: FONT.display, color: '#ffffff',
    }).setOrigin(0.5))
    c.add(this.add.text(0, 32, item.desc, {
      fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mist), align: 'center', wordWrap: { width: CARD_W - 28 },
    }).setOrigin(0.5, 0))

    const label = equipped
      ? (item.kind === 'golden' ? '✓ ON  (tap to remove)' : '✓ EQUIPPED')
      : owned ? (item.kind === 'golden' ? 'WEAR' : 'EQUIP') : `🎟️ ${item.cost}`
    const affordable = getTickets() >= item.cost
    const fill = equipped ? COLORS.partyDeep : owned ? COLORS.skyDeep : affordable ? COLORS.warning : COLORS.chrome
    const btn = createButton(this, 0, CARD_H / 2 - 30, label, fill, fill, CARD_W - 40, 42)
    if (!owned && !affordable) setButtonEnabled(btn, false)
    btn.on('pointerdown', () => this.activate(item))
    c.add(btn)
    return c
  }

  /** Small live preview: the die face, a golden token, the confetti icon or a music note. */
  private preview(item: UnlockItem, x: number, y: number): Phaser.GameObjects.GameObject {
    if (item.dice) {
      const d = item.dice
      const g = this.add.graphics({ x, y })
      g.fillStyle(d.dark, 1)
      g.fillRoundedRect(-30, -26, 60, 60, 12)
      g.fillStyle(d.face, 1)
      g.fillRoundedRect(-30, -30, 60, 60, 12)
      g.fillStyle(d.pip, 1)
      for (const [px, py] of [[-14, -14], [14, -14], [0, 0], [-14, 14], [14, 14]]) g.fillCircle(px, py, 5)
      return g
    }
    if (item.character !== undefined) {
      return this.add.image(x, y, goldenPreviewKey(this, item.character)).setDisplaySize(64, 84)
    }
    return this.add.text(x, y, item.icon, { fontSize: '52px' }).setOrigin(0.5)
  }

  private activate(item: UnlockItem) {
    const purchased = !isOwned(item.id)
    if (purchased) {
      const result = buy(item.id)
      if (result !== 'ok') {
        Sfx.clunk()
        return
      }
      Sfx.purchase()
      showConfetti(this, this.scale.width / 2, 200)
      unlock('shop_first')
      if (item.kind === 'golden') unlock('golden_one')
    } else {
      equip(item.id)
      Sfx.uiToggle()
    }
    // Textures are shared game-wide, so the board, HUD and setup pick the new look up immediately.
    if (item.kind === 'dice') generateDiceTextures(this)
    if (item.kind === 'golden') generatePlayerTextures(this)
    if (item.kind === 'music' && item.track && isEquipped(item.id)) Sfx.startMusic(item.track)
    if (item.kind === 'confetti' && isEquipped(item.id) && !purchased) showConfetti(this, this.scale.width / 2, 220)
    this.refreshWallet()
    this.renderGrid()
  }
}
