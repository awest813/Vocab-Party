import Phaser from 'phaser'
import { CPU_LEVEL_LABEL, DEFAULT_CPU_LEVEL, type CpuLevel } from '../systems/CpuPolicy'
import { getSettings, isTouchPreferred, setSettings, shouldReduceMotion, WORD_LEVEL_LABEL, WORD_LEVEL_ORDER } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import { createButton, setButtonLabel } from '../ui/Button'
import { addVignette, paintStage } from '../ui/Panel'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { getPersonalBests, MINIGAMES } from '../minigames/registry'
import type { MinigameDef } from '../minigames/types'
import type { MinigameSceneData } from './MinigameScene'

const COLS = 7
const CARD_W = 170
const CARD_H = 150
const GAP = 10

/** Free-play menu: practice any minigame solo and chase personal bests. */
type ArcadeMode = 'solo' | CpuLevel
const MODE_ORDER: ArcadeMode[] = ['solo', 'easy', 'normal', 'hard']

export class ArcadeScene extends Phaser.Scene {
  private mode: ArcadeMode = 'solo'
  private cursor = 0
  private cards: { c: Phaser.GameObjects.Container; def: MinigameDef; draw: (hover: boolean) => void }[] = []

  constructor() { super('ArcadeScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height
    const reduce = shouldReduceMotion()
    const touch = isTouchPreferred(this.sys.game)
    this.cards = []

    paintStage(this)
    addStarfieldBackdrop(this, 0.45)
    addVignette(this, 0.55, -4)
    if (!reduce) addAmbientMotes(this, 20)
    Sfx.startMusic('menu')
    this.cameras.main.fadeIn(260, 7, 11, 20)

    this.add.text(w / 2, 56, '🕹️ MINIGAME ARCADE', {
      fontSize: '46px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      stroke: hexColor(COLORS.goldDeep), strokeThickness: 8,
    }).setOrigin(0.5)
    const bests = getPersonalBests()
    const played = MINIGAMES.filter(m => (bests[m.id] ?? 0) > 0).length
    this.add.text(w / 2, 102, `Practice any game solo · beat the CPU tiers · ${played}/${MINIGAMES.length} games with a best score`, {
      fontSize: '17px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5)

    const back = createButton(this, 86, 50, '◀ MENU', COLORS.bgPanelAlt, COLORS.chromeDeep, 140, 50)
    back.on('pointerdown', () => this.leave())

    const modeLabel = () => this.mode === 'solo' ? '👤 Solo practice' : `🤖 vs 3 CPUs · ${CPU_LEVEL_LABEL[this.mode]}`
    const modeBtn = createButton(this, w - 150, 50, modeLabel(), COLORS.bgPanelAlt, COLORS.chromeDeep, 260, 50)
    const cycleMode = () => {
      this.mode = MODE_ORDER[(MODE_ORDER.indexOf(this.mode) + 1) % MODE_ORDER.length]
      setButtonLabel(modeBtn, modeLabel())
      Sfx.uiToggle()
    }
    modeBtn.on('pointerdown', cycleMode)

    const levelLabel = () => `🎓 ${WORD_LEVEL_LABEL[getSettings().wordLevel]}`
    const levelBtn = createButton(this, w - 150, 104, levelLabel(), COLORS.bgPanelAlt, COLORS.chromeDeep, 200, 38)
    const cycleLevel = () => {
      const cur = getSettings().wordLevel
      setSettings({ wordLevel: WORD_LEVEL_ORDER[(WORD_LEVEL_ORDER.indexOf(cur) + 1) % WORD_LEVEL_ORDER.length] })
      setButtonLabel(levelBtn, levelLabel())
      Sfx.uiToggle()
    }
    levelBtn.on('pointerdown', cycleLevel)

    const rows = Math.ceil(MINIGAMES.length / COLS)
    const gridW = COLS * CARD_W + (COLS - 1) * GAP
    const top = 140
    MINIGAMES.forEach((def, i) => {
      const row = Math.floor(i / COLS)
      const inRow = row === rows - 1 ? MINIGAMES.length - row * COLS : COLS
      const rowW = inRow * CARD_W + (inRow - 1) * GAP
      const col = i % COLS
      const x = w / 2 - rowW / 2 + CARD_W / 2 + col * (CARD_W + GAP)
      const y = top + CARD_H / 2 + row * (CARD_H + GAP)
      void gridW
      this.cards.push(this.makeCard(def, x, y, bests[def.id] ?? 0, i))
    })

    this.add.text(w / 2, h - 26, touch ? 'Tap a game to play · tap the mode button to face CPUs' : 'Arrows choose · Enter plays · M solo / vs CPUs · L word level · Esc returns to menu', {
      fontSize: '14px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
    }).setOrigin(0.5)

    const onKey = (ev: KeyboardEvent) => {
      const n = this.cards.length
      switch (ev.code) {
        case 'ArrowRight': this.moveCursor((this.cursor + 1) % n); break
        case 'ArrowLeft': this.moveCursor((this.cursor - 1 + n) % n); break
        case 'ArrowDown': this.moveCursor(Math.min(n - 1, this.cursor + COLS)); break
        case 'ArrowUp': this.moveCursor(Math.max(0, this.cursor - COLS)); break
        case 'Enter':
        case 'Space': this.play(this.cards[this.cursor].def); break
        case 'Escape': this.leave(); break
        case 'KeyM': cycleMode(); break
        case 'KeyL': cycleLevel(); break
        default: return
      }
      ev.preventDefault()
    }
    this.input.keyboard?.on('keydown', onKey)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey))
    if (!touch) this.moveCursor(Math.min(this.cursor, this.cards.length - 1))
  }

  private makeCard(def: MinigameDef, x: number, y: number, best: number, index: number) {
    const c = this.add.container(x, y)
    const g = this.add.graphics()
    const draw = (hover: boolean) => {
      g.clear()
      g.fillStyle(0x000000, 0.4)
      g.fillRoundedRect(-CARD_W / 2 + 3, -CARD_H / 2 + 7, CARD_W, CARD_H, 18)
      g.fillStyle(hover ? 0x1c2a46 : COLORS.bgPanel, 0.97)
      g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18)
      g.fillStyle(def.accent, 0.95)
      g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 8, { tl: 18, tr: 18, bl: 0, br: 0 })
      g.lineStyle(hover ? 4 : 2, hover ? 0xffe066 : def.accent, hover ? 1 : 0.5)
      g.strokeRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, CARD_W - 2, CARD_H - 2, 18)
    }
    draw(false)
    c.add(g)
    c.add(this.add.text(-CARD_W / 2 + 12, -38, def.icon, { fontSize: '30px' }).setOrigin(0, 0.5))
    c.add(this.add.text(-CARD_W / 2 + 54, -38, def.title, {
      fontSize: '16px', fontFamily: FONT.display, color: '#ffffff', wordWrap: { width: CARD_W - 62 },
    }).setOrigin(0, 0.5))
    c.add(this.add.text(-CARD_W / 2 + 12, 4, def.category.toUpperCase(), {
      fontSize: '11px', fontFamily: FONT.display, color: hexColor(def.accent),
    }).setOrigin(0, 0.5))
    c.add(this.add.text(-CARD_W / 2 + 12, 20, def.tagline, {
      fontSize: '11px', fontFamily: FONT.body, color: hexColor(COLORS.mist), wordWrap: { width: CARD_W - 24 },
    }).setOrigin(0, 0))
    const medal = best >= def.cpu.hard[1] ? '🥇' : best >= def.cpu.normal[1] ? '🥈' : best >= def.cpu.easy[1] ? '🥉' : ''
    c.add(this.add.text(CARD_W / 2 - 10, 4, best > 0 ? `${medal} ${best}` : 'NEW', {
      fontSize: '12px', fontFamily: FONT.display, color: best > 0 ? hexColor(COLORS.gold) : '#44ff88',
    }).setOrigin(1, 0.5))

    const hit = this.add.rectangle(0, 0, CARD_W, CARD_H, 0, 0.001).setInteractive({ useHandCursor: true })
    hit.on('pointerover', () => this.moveCursor(index))
    hit.on('pointerdown', () => this.play(def))
    c.add(hit)
    if (!shouldReduceMotion()) {
      c.setAlpha(0).setScale(0.9)
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 260, delay: 60 + index * 30, ease: 'Back.easeOut' })
    }
    return { c, def, draw }
  }

  private moveCursor(i: number) {
    if (i === this.cursor && this.cards[i]?.c.getData('hot')) return
    this.cards.forEach((card, j) => {
      const on = j === i
      card.draw(on)
      card.c.setData('hot', on)
      card.c.setDepth(on ? 2 : 1)
      if (!shouldReduceMotion()) this.tweens.add({ targets: card.c, scale: on ? 1.05 : 1, duration: 120 })
    })
    if (i !== this.cursor) Sfx.uiHover()
    this.cursor = i
  }

  private play(def: MinigameDef) {
    Sfx.uiClick()
    const you = { id: 0, name: 'You', characterIndex: 0, color: COLORS.player[0], isCpu: false, cpuLevel: DEFAULT_CPU_LEVEL }
    if (this.mode === 'solo') {
      const data: MinigameSceneData = { mode: 'practice', gameId: def.id, participants: [you] }
      this.scene.start('MinigameScene', data)
      return
    }
    const level = this.mode
    const rivals = ['Blake', 'Casey', 'Dana'].map((name, i) => ({
      id: i + 1, name, characterIndex: i + 1, color: COLORS.player[i + 1], isCpu: true, cpuLevel: level,
    }))
    const data: MinigameSceneData = {
      mode: 'party',
      gameId: def.id,
      participants: [you, ...rivals],
      stakes: `Arcade match vs ${CPU_LEVEL_LABEL[level]} CPUs`,
      onComplete: () => this.scene.start('ArcadeScene'),
    }
    this.scene.start('MinigameScene', data)
  }

  private leave() {
    this.scene.start('MenuScene')
  }
}
