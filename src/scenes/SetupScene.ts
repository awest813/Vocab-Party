import Phaser from 'phaser'
import { createButton, setButtonEnabled } from '../ui/Button'
import { addAmbientMotes, addStarfieldBackdrop, driftStarfield } from '../ui/Starfield'
import { addVignette, createInsetPlate, paintStage } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { BOARD_PATH_LENGTH } from '../systems/BoardLayout'
import { CHARACTER_COUNT } from '../systems/GameState'
import {
  CHARACTER_DEFS,
  CHARACTER_COUNT as SPRITE_CHARACTER_COUNT,
  characterDef,
  characterShortName,
  characterTextureKey,
} from '../systems/SpriteFactory'
import type { CpuLevel } from '../systems/CpuPolicy'
import { CPU_LEVEL_LABEL, DEFAULT_CPU_LEVEL } from '../systems/CpuPolicy'
import { isAutoSimMode, getAutoSimFullMap, getAutoSimRounds, getAutoSimPlayers } from '../systems/gameFlags'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'

const MAX_PLAYERS = 4
const MIN_PLAYERS = 1

const DEFAULT_NAMES = ['Alex', 'Blake', 'Casey', 'Dana']

type MapPresetId = 'quick' | 'classic' | 'full'

interface MapPreset {
  id: MapPresetId
  rounds: number
  label: string
  blurb: string
}

const MAP_PRESETS: MapPreset[] = [
  { id: 'quick', rounds: 5, label: 'QUICK', blurb: '5 rounds · short party' },
  { id: 'classic', rounds: 10, label: 'CLASSIC', blurb: '10 rounds · standard' },
  { id: 'full', rounds: BOARD_PATH_LENGTH, label: 'FULL MAP', blurb: `${BOARD_PATH_LENGTH} rounds · full lap` },
]

interface InputRow {
  label: Phaser.GameObjects.Text
  charName: Phaser.GameObjects.Text
  cycleHint: Phaser.GameObjects.Text
  nameText: Phaser.GameObjects.Text
  cursor: Phaser.GameObjects.Text
  bg: Phaser.GameObjects.Rectangle
  ring: Phaser.GameObjects.Graphics
  token: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
  tokenHit: Phaser.GameObjects.Arc
  active: boolean
  value: string
}

type CpuSlotMode = 'off' | CpuLevel

export class SetupScene extends Phaser.Scene {
  private playerCount = 4
  private cpuModeByRow: CpuSlotMode[] = ['off', 'off', 'off', 'off']
  private cpuToggleTexts: Phaser.GameObjects.Text[] = []
  /** Selected character index per roster slot (into CHARACTER_DEFS). */
  private characterByRow: number[] = [0, 1, 2, 3]
  private mapPreset: MapPresetId = 'classic'
  private mapCards: {
    id: MapPresetId
    root: Phaser.GameObjects.Container
    frame: Phaser.GameObjects.Graphics
    width: number
    height: number
  }[] = []
  private rows: InputRow[] = []
  private activeRow = -1
  private countText!: Phaser.GameObjects.Text
  private minusBtn!: Phaser.GameObjects.Container
  private plusBtn!: Phaser.GameObjects.Container
  private startBtn!: Phaser.GameObjects.Container
  private rowContainers: Phaser.GameObjects.Container[] = []
  private cursorTimers: Phaser.Time.TimerEvent[] = []
  private leaving = false

  constructor() { super('SetupScene') }

  create() {
    if (CHARACTER_COUNT !== SPRITE_CHARACTER_COUNT || CHARACTER_DEFS.length !== CHARACTER_COUNT) {
      console.error('[SetupScene] CHARACTER_COUNT mismatch — roster textures may desync')
    }
    const w = this.scale.width
    const h = this.scale.height
    const reduce = shouldReduceMotion()
    const touch = isTouchPreferred(this.sys.game)

    paintStage(this)
    const stars = addStarfieldBackdrop(this, 0.42)
    driftStarfield(this, stars, reduce)
    addVignette(this, 0.5, -4)
    if (!reduce) addAmbientMotes(this, 18)
    Sfx.startMusic()

    const backBtn = createButton(this, 100, 48, '← MENU', COLORS.bgPanelAlt, COLORS.chromeDeep, 140, 48)
    backBtn.setDepth(10)
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'))

    const headerPanel = this.add.container(w / 2, 58).setDepth(5)
    const hShadow = this.add.graphics()
    hShadow.fillStyle(0x000000, 0.35)
    hShadow.fillRoundedRect(-430, -34, 860, 72, 16)
    const hBg = this.add.graphics()
    hBg.fillStyle(COLORS.bgPanel, 0.9)
    hBg.fillRoundedRect(-424, -40, 848, 78, 16)
    hBg.fillStyle(COLORS.skyDeep, 0.55)
    hBg.fillRoundedRect(-424, -40, 848, 7, { tl: 16, tr: 16, bl: 0, br: 0 })
    hBg.lineStyle(2.5, COLORS.gold, 0.4)
    hBg.strokeRoundedRect(-424, -40, 848, 78, 16)

    const titleText = this.add.text(0, -8, 'PARTY SETUP', {
      fontSize: '36px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5)
    const subtitle = this.add.text(0, 20, 'Pick characters · choose map length · set CPU', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5)
    headerPanel.add([hShadow, hBg, titleText, subtitle])

    // ——— Player count + map presets ———
    const optionsY = 148
    createInsetPlate(this, w / 2, optionsY, 1000, 132, {
      fill: COLORS.bgPanel,
      fillAlpha: 0.78,
      border: COLORS.sky,
      borderAlpha: 0.28,
      radius: 16,
    }).setDepth(3)

    const countPanel = this.add.container(w / 2 - 360, optionsY).setDepth(4)
    const cpBg = this.add.graphics()
    cpBg.fillStyle(COLORS.bgPanelAlt, 0.92)
    cpBg.fillRoundedRect(-110, -48, 220, 96, 14)
    cpBg.lineStyle(2.5, COLORS.gold, 0.55)
    cpBg.strokeRoundedRect(-110, -48, 220, 96, 14)

    const countLabel = this.add.text(0, -30, 'PLAYERS', {
      fontSize: '12px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
    }).setOrigin(0.5)

    this.minusBtn = createButton(this, -62, 14, '−', COLORS.skyDeep, COLORS.skyBtnDeep, 52, 42)
    this.minusBtn.on('pointerdown', () => this.changeCount(-1))

    this.countText = this.add.text(0, 14, String(this.playerCount), {
      fontSize: '36px',
      fontFamily: FONT.display,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5)

    this.plusBtn = createButton(this, 62, 14, '+', COLORS.skyDeep, COLORS.skyBtnDeep, 52, 42)
    this.plusBtn.on('pointerdown', () => this.changeCount(1))

    countPanel.add([cpBg, countLabel, this.minusBtn, this.countText, this.plusBtn])

    this.add.text(w / 2 + 80, optionsY - 48, 'MAP LENGTH', {
      fontSize: '12px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
    }).setOrigin(0.5).setDepth(4)

    this.mapCards = []
    const cardW = 168
    const cardGap = 12
    const cardsStartX = w / 2 - 40
    MAP_PRESETS.forEach((preset, i) => {
      const x = cardsStartX + i * (cardW + cardGap)
      const card = this.buildMapCard(preset, x, optionsY + 10, cardW, 78)
      this.mapCards.push(card)
    })
    this.refreshMapCards()

    // ——— Roster ———
    const rosterTop = 238
    const rosterH = 330
    createInsetPlate(this, w / 2, rosterTop + rosterH / 2 - 16, 1000, rosterH, {
      fill: COLORS.bgPanel,
      fillAlpha: 0.72,
      border: COLORS.strokeSoft,
      borderAlpha: 0.14,
      radius: 16,
    }).setDepth(3)

    this.add.text(w / 2, rosterTop + 2, 'ROSTER', {
      fontSize: '14px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.teal),
    }).setOrigin(0.5).setDepth(4)

    this.add.text(w / 2, rosterTop + 24, touch
      ? 'Tap portrait or name tag to change character  ·  Tap START'
      : 'Click portrait to change character  ·  1–3 pick map  ·  Enter to start', {
      fontSize: '13px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
      align: 'center',
      wordWrap: { width: 920 },
    }).setOrigin(0.5).setDepth(4)

    this.rows = []
    this.rowContainers = []
    this.cpuToggleTexts = []
    const ROW_SPACING = 62
    const startY = rosterTop + 66
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.buildRow(i, startY, ROW_SPACING)
      this.refreshCpuToggle(i)
      this.refreshCharacterVisual(i)
    }
    this.refreshRows()
    this.refreshCountButtons()

    for (let i = 0; i < MAX_PLAYERS; i++) {
      const row = this.rowContainers[i]
      const targetAlpha = i < this.playerCount ? 1 : 0.45
      row.setAlpha(0).setX(row.x - 40)
      this.tweens.add({
        targets: row,
        alpha: targetAlpha,
        x: '+=40',
        duration: reduce ? 0 : 380,
        delay: reduce ? 0 : 160 + i * 80,
        ease: 'Cubic.easeOut',
      })
    }

    const startGlow = this.add.ellipse(w / 2, h - 52, 420, 80, COLORS.mint, 0.12).setDepth(4)
    if (!reduce) {
      this.tweens.add({
        targets: startGlow,
        alpha: 0.05,
        scaleX: 1.08,
        duration: 1100,
        yoyo: true,
        repeat: -1,
      })
    }

    this.startBtn = createButton(this, w / 2, h - 52, '▶  START PARTY', COLORS.party, COLORS.partyDeep, 420, 60)
    this.startBtn.setDepth(8)
    this.startBtn.on('pointerdown', () => this.startGame())
    if (!reduce) {
      this.startBtn.setAlpha(0)
      this.startBtn.y += 14
      this.tweens.add({
        targets: this.startBtn,
        alpha: 1,
        y: '-=14',
        duration: 420,
        delay: 480,
        ease: 'Back.easeOut',
      })
    }

    if (isAutoSimMode()) {
      this.playerCount = getAutoSimPlayers()
      this.countText.setText(String(this.playerCount))
      this.mapPreset = getAutoSimFullMap() ? 'full' : 'classic'
      this.refreshMapCards()
      this.cpuModeByRow = ['normal', 'normal', 'normal', 'normal']
      for (let i = 0; i < MAX_PLAYERS; i++) this.refreshCpuToggle(i)
      this.refreshRows()
      this.refreshCountButtons()
      const requested = getAutoSimRounds()
      const rounds = requested ?? this.currentMapRounds()
      this.time.delayedCall(80, () => this.startGameWithRounds(rounds))
    }

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))
    this.input.keyboard?.on('keydown-ENTER', () => { if (this.activeRow < 0) this.startGame() })
    this.input.keyboard?.on('keydown-ONE', () => { if (this.activeRow < 0) this.selectMapPreset('quick') })
    this.input.keyboard?.on('keydown-TWO', () => { if (this.activeRow < 0) this.selectMapPreset('classic') })
    this.input.keyboard?.on('keydown-THREE', () => { if (this.activeRow < 0) this.selectMapPreset('full') })
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.activeRow >= 0) this.setActiveRow(-1)
      else this.scene.start('MenuScene')
    })

    this.input.on('pointerdown', (_ptr: Phaser.Input.Pointer, objs: Phaser.GameObjects.GameObject[]) => {
      if (objs.length === 0) this.setActiveRow(-1)
    })

    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown')
      this.input.keyboard?.off('keydown-ENTER')
      this.input.keyboard?.off('keydown-ONE')
      this.input.keyboard?.off('keydown-TWO')
      this.input.keyboard?.off('keydown-THREE')
      this.input.keyboard?.off('keydown-ESC')
      this.cursorTimers.forEach(t => t.destroy())
      this.cursorTimers = []
    })

    this.cameras.main.fadeIn(360, 7, 11, 20)
  }

  private currentMapRounds(): number {
    return MAP_PRESETS.find(p => p.id === this.mapPreset)?.rounds ?? 10
  }

  private selectMapPreset(id: MapPresetId) {
    if (this.leaving || this.mapPreset === id) return
    this.mapPreset = id
    this.refreshMapCards()
    Sfx.uiToggle()
  }

  private buildMapCard(preset: MapPreset, x: number, y: number, width: number, height: number) {
    const root = this.add.container(x, y).setDepth(5)
    const frame = this.add.graphics()
    root.add(frame)

    const preview = this.add.graphics()
    this.drawMapPreview(preview, preset.id, 0, -8)
    root.add(preview)

    const title = this.add.text(0, 12, preset.label, {
      fontSize: '15px',
      fontFamily: FONT.display,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5)
    const blurb = this.add.text(0, 30, preset.blurb, {
      fontSize: '11px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5)
    root.add([title, blurb])

    const hit = this.add.rectangle(0, 0, width, height, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => this.selectMapPreset(preset.id))
    hit.on('pointerover', () => {
      if (this.mapPreset !== preset.id) root.setScale(1.04)
    })
    hit.on('pointerout', () => root.setScale(1))
    root.add(hit)

    return { id: preset.id, root, frame, width, height }
  }

  private drawMapPreview(g: Phaser.GameObjects.Graphics, id: MapPresetId, ox: number, oy: number) {
    g.clear()
    const dots =
      id === 'quick' ? 5 :
      id === 'classic' ? 8 :
      12
    const span = id === 'full' ? 120 : id === 'classic' ? 100 : 72
    const startX = ox - span / 2
    for (let i = 0; i < dots; i++) {
      const t = dots <= 1 ? 0.5 : i / (dots - 1)
      const x = startX + t * span
      const y = oy + Math.sin(t * Math.PI * (id === 'full' ? 2 : 1)) * (id === 'full' ? 10 : 6)
      const isEnd = i === 0 || i === dots - 1
      g.fillStyle(isEnd ? COLORS.party : (id === 'full' ? COLORS.gold : COLORS.sky), isEnd ? 1 : 0.85)
      g.fillCircle(x, y, isEnd ? 4.5 : 3)
      if (i < dots - 1) {
        const t2 = i + 1 <= dots - 1 ? (i + 1) / (dots - 1) : 1
        const x2 = startX + t2 * span
        const y2 = oy + Math.sin(t2 * Math.PI * (id === 'full' ? 2 : 1)) * (id === 'full' ? 10 : 6)
        g.lineStyle(2, COLORS.strokeSoft, 0.25)
        g.lineBetween(x, y, x2, y2)
      }
    }
  }

  private refreshMapCards() {
    for (const card of this.mapCards) {
      const selected = card.id === this.mapPreset
      const w = card.width
      const h = card.height
      card.frame.clear()
      card.frame.fillStyle(0x000000, 0.25)
      card.frame.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 12)
      card.frame.fillStyle(selected ? COLORS.bgPanelAlt : COLORS.bgDeep, selected ? 0.95 : 0.72)
      card.frame.fillRoundedRect(-w / 2, -h / 2, w, h, 12)
      card.frame.lineStyle(2.5, selected ? COLORS.gold : COLORS.strokeSoft, selected ? 0.85 : 0.18)
      card.frame.strokeRoundedRect(-w / 2, -h / 2, w, h, 12)
      if (selected) {
        card.frame.fillStyle(COLORS.gold, 0.14)
        card.frame.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, 10, { tl: 10, tr: 10, bl: 0, br: 0 })
        card.frame.lineStyle(1.5, COLORS.gold, 0.35)
        card.frame.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 10)
      }
      card.root.setAlpha(selected ? 1 : 0.78)
      if (!selected) card.root.setScale(1)
    }
  }

  private takenCharacters(exceptRow = -1): Set<number> {
    const taken = new Set<number>()
    for (let i = 0; i < this.playerCount; i++) {
      if (i === exceptRow) continue
      taken.add(this.characterByRow[i])
    }
    return taken
  }

  private nextFreeCharacter(from: number, exceptRow: number): number {
    const taken = this.takenCharacters(exceptRow)
    for (let step = 1; step <= CHARACTER_DEFS.length; step++) {
      const next = (from + step) % CHARACTER_DEFS.length
      if (!taken.has(next)) return next
    }
    return from
  }

  private cycleCharacter(row: number) {
    if (this.leaving || row < 0 || row >= this.playerCount) return
    const prev = this.characterByRow[row]
    const next = this.nextFreeCharacter(prev, row)
    if (next === prev) return
    this.characterByRow[row] = next
    this.refreshCharacterVisual(row)
    const token = this.rows[row]?.token
    if (token && !shouldReduceMotion()) {
      this.tweens.killTweensOf(token)
      token.setScale(1)
      this.tweens.add({
        targets: token,
        scaleX: 1.16,
        scaleY: 1.16,
        duration: 110,
        yoyo: true,
        ease: 'Back.easeOut',
      })
    }
    Sfx.uiToggle()
  }

  private refreshCharacterVisual(index: number) {
    const row = this.rows[index]
    if (!row) return
    const ci = this.characterByRow[index]
    const def = characterDef(ci)
    const tex = characterTextureKey(ci)
    row.charName.setText(characterShortName(ci))
    row.charName.setColor(hexColor(def.color))
    // Phaser setTexture resets display size — re-apply token size every refresh.
    if (row.token instanceof Phaser.GameObjects.Image) {
      if (this.textures.exists(tex)) {
        row.token.setTexture(tex)
        row.token.setDisplaySize(36, 44)
      }
    } else {
      row.token.setFillStyle(def.color)
    }
    row.cycleHint.setX(row.charName.x + row.charName.width + 8)

    const tokenX = this.scale.width / 2 - 430
    const rowY = row.bg.y
    row.ring.clear()
    row.ring.lineStyle(row.active ? 4 : 3, def.color, row.active ? 0.95 : 0.6)
    row.ring.strokeCircle(tokenX, rowY, 24)
    row.ring.fillStyle(def.color, row.active ? 0.22 : 0.12)
    row.ring.fillCircle(tokenX, rowY, 22)
  }

  buildRow(index: number, firstRowY: number, spacing: number = 88) {
    const w = this.scale.width
    const rowY = firstRowY + index * spacing
    const inputW = 280
    const inputH = 44
    const inputX = w / 2 + 150

    const container = this.add.container(0, 0).setDepth(5)
    this.rowContainers.push(container)

    const rowPlate = this.add.graphics()
    rowPlate.fillStyle(COLORS.bgDeep, 0.28)
    rowPlate.fillRoundedRect(w / 2 - 480, rowY - 26, 960, 52, 12)
    rowPlate.lineStyle(1, COLORS.strokeSoft, 0.08)
    rowPlate.strokeRoundedRect(w / 2 - 480, rowY - 26, 960, 52, 12)

    const tokenX = w / 2 - 430
    const def = characterDef(this.characterByRow[index])
    const tex = characterTextureKey(this.characterByRow[index])

    const ring = this.add.graphics()
    ring.lineStyle(3, def.color, 0.6)
    ring.strokeCircle(tokenX, rowY, 24)
    ring.fillStyle(def.color, 0.12)
    ring.fillCircle(tokenX, rowY, 22)

    let token: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
    if (this.textures.exists(tex)) {
      token = this.add.image(tokenX, rowY, tex).setDisplaySize(36, 44)
    } else {
      token = this.add.circle(tokenX, rowY, 14, def.color)
      token.setStrokeStyle(2, 0xffffff, 0.7)
    }

    const label = this.add.text(tokenX + 40, rowY - 10, `P${index + 1}`, {
      fontSize: '13px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.mute),
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5)

    const charName = this.add.text(tokenX + 40, rowY + 10, characterShortName(this.characterByRow[index]), {
      fontSize: '15px',
      fontFamily: FONT.display,
      color: hexColor(def.color),
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
    charName.on('pointerdown', () => this.cycleCharacter(index))

    const cycleHint = this.add.text(tokenX + 40 + charName.width + 8, rowY + 10, '↻', {
      fontSize: '13px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.mute),
    }).setOrigin(0, 0.5).setAlpha(0.7)

    // Invisible hit over portrait for character cycling
    const tokenHit = this.add.circle(tokenX, rowY, 30, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
    tokenHit.on('pointerdown', () => this.cycleCharacter(index))
    tokenHit.on('pointerover', () => {
      if (index < this.playerCount) tokenHit.setScale(1.08)
    })
    tokenHit.on('pointerout', () => tokenHit.setScale(1))

    const cpuToggle = this.add.text(w / 2 - 150, rowY, 'HUMAN', {
      fontSize: '14px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.mist),
      backgroundColor: hexColor(COLORS.bgPanelAlt),
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0, 0.5)
    cpuToggle.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-8, -18, 168, 36),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    })
    cpuToggle.on('pointerdown', () => {
      if (index >= this.playerCount) return
      const cur = this.cpuModeByRow[index]
      if (cur === 'off') this.cpuModeByRow[index] = 'easy'
      else if (cur === 'easy') this.cpuModeByRow[index] = 'normal'
      else if (cur === 'normal') this.cpuModeByRow[index] = 'hard'
      else this.cpuModeByRow[index] = 'off'
      this.refreshCpuToggle(index)
    })
    this.cpuToggleTexts.push(cpuToggle)

    const bg = this.add.rectangle(inputX, rowY, inputW, inputH, COLORS.bgPanel)
    bg.setStrokeStyle(2, COLORS.mute)
    bg.setInteractive()
    bg.on('pointerdown', () => this.setActiveRow(index))

    const nameText = this.add.text(inputX - inputW / 2 + 14, rowY, DEFAULT_NAMES[index], {
      fontSize: '20px',
      fontFamily: FONT.body,
      color: '#ffffff',
    }).setOrigin(0, 0.5)

    const cursor = this.add.text(inputX - inputW / 2 + 14, rowY, '', {
      fontSize: '20px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.sky),
    }).setOrigin(0, 0.5).setVisible(false)

    container.add([rowPlate, ring, token, tokenHit, label, charName, cycleHint, cpuToggle, bg, nameText, cursor])

    const row: InputRow = {
      label,
      charName,
      cycleHint,
      nameText,
      cursor,
      bg,
      ring,
      token,
      tokenHit,
      active: false,
      value: DEFAULT_NAMES[index],
    }
    this.rows.push(row)

    const cursorTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (row.active) cursor.setVisible(!cursor.visible)
        else cursor.setVisible(false)
      },
    })
    this.cursorTimers.push(cursorTimer)
  }

  refreshCpuToggle(index: number) {
    const t = this.cpuToggleTexts[index]
    if (!t) return
    const mode = this.cpuModeByRow[index]
    if (mode === 'off') {
      t.setText('HUMAN')
      t.setColor(hexColor(COLORS.mist))
      t.setBackgroundColor(hexColor(COLORS.bgPanelAlt))
    } else {
      t.setText(`CPU · ${CPU_LEVEL_LABEL[mode].toUpperCase()}`)
      t.setColor(mode === 'hard' ? '#ffe0a8' : '#b6f0d0')
      t.setBackgroundColor(mode === 'hard' ? '#3a2a18' : '#163028')
    }
  }

  refreshRows() {
    this.rows.forEach((row, i) => {
      const enabled = i < this.playerCount
      const childAlpha = enabled ? 1 : 0.35
      row.label.setAlpha(childAlpha)
      row.charName.setAlpha(childAlpha)
      row.cycleHint.setAlpha(enabled ? 0.7 : 0.2)
      row.bg.setAlpha(childAlpha)
      row.nameText.setAlpha(childAlpha)
      row.ring.setAlpha(enabled ? 1 : 0.25)
      row.token.setAlpha(enabled ? 1 : 0.35)
      if (enabled) {
        row.bg.setInteractive()
        row.tokenHit.setInteractive({ useHandCursor: true })
        row.charName.setInteractive({ useHandCursor: true })
      } else {
        row.bg.disableInteractive()
        row.tokenHit.disableInteractive()
        row.charName.disableInteractive()
      }
      const cpuT = this.cpuToggleTexts[i]
      if (cpuT) {
        cpuT.setAlpha(childAlpha)
        if (enabled) {
          cpuT.setInteractive({
            useHandCursor: true,
            hitArea: new Phaser.Geom.Rectangle(-8, -18, 168, 36),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          })
        } else {
          cpuT.disableInteractive()
          this.cpuModeByRow[i] = 'off'
          this.refreshCpuToggle(i)
        }
      }
      if (!this.tweens.isTweening(this.rowContainers[i])) {
        this.rowContainers[i]?.setAlpha(enabled ? 1 : 0.45)
      }
      if (!enabled && row.active) this.setActiveRow(-1)
    })
  }

  refreshCountButtons() {
    setButtonEnabled(this.minusBtn, this.playerCount > MIN_PLAYERS)
    setButtonEnabled(this.plusBtn, this.playerCount < MAX_PLAYERS)
  }

  changeCount(delta: number) {
    const next = this.playerCount + delta
    if (next < MIN_PLAYERS || next > MAX_PLAYERS) return
    this.playerCount = next
    this.countText.setText(String(this.playerCount))
    // Ensure newly enabled slots don't collide on character
    for (let i = 0; i < this.playerCount; i++) {
      const taken = this.takenCharacters(i)
      if (taken.has(this.characterByRow[i])) {
        this.characterByRow[i] = this.nextFreeCharacter(this.characterByRow[i], i)
        this.refreshCharacterVisual(i)
      }
    }
    this.refreshRows()
    this.refreshCountButtons()
  }

  setActiveRow(index: number) {
    if (index >= 0 && index >= this.playerCount) {
      this.setActiveRow(-1)
      return
    }
    this.activeRow = index
    this.rows.forEach((row, i) => {
      const isActive = i === index && i < this.playerCount
      row.active = isActive
      row.bg.setStrokeStyle(2.5, isActive ? COLORS.sky : COLORS.mute)
      row.bg.setFillStyle(isActive ? COLORS.bgPanelAlt : COLORS.bgPanel)
      if (!isActive) row.cursor.setVisible(false)
      this.refreshCharacterVisual(i)
    })
  }

  onKey(event: KeyboardEvent) {
    if (this.activeRow < 0 || this.activeRow >= this.playerCount) return
    const row = this.rows[this.activeRow]

    if (event.key === 'Backspace') {
      row.value = row.value.slice(0, -1)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const next = (this.activeRow + 1) % this.playerCount
      this.setActiveRow(next)
      return
    } else if (event.key.length === 1 && row.value.length < 16) {
      row.value += event.key
    }

    this.updateRowDisplay(this.activeRow)
  }

  updateRowDisplay(index: number) {
    const row = this.rows[index]
    const inputW = 280
    const w = this.scale.width
    const inputX = w / 2 + 150
    const displayName = row.value || ' '
    row.nameText.setText(displayName)
    const textW = row.nameText.width
    row.cursor.setX(inputX - inputW / 2 + 14 + textW)
    row.cursor.setText('|')
  }

  startGame() {
    if (this.leaving) return
    this.startGameWithRounds(this.currentMapRounds())
  }

  private startGameWithRounds(roundsPerGame: number) {
    if (this.leaving) return
    this.leaving = true
    const names = this.rows.slice(0, this.playerCount).map((r, i) =>
      r.value.trim() || DEFAULT_NAMES[i]
    )
    const characters = this.characterByRow.slice(0, this.playerCount)
    const emojis = characters.map(ci => characterDef(ci).emoji)
    const flashMs = isAutoSimMode() ? 0 : 300
    const delayMs = isAutoSimMode() ? 0 : 300
    const advance = () => {
      const slice = this.cpuModeByRow.slice(0, this.playerCount)
      const playerCpu = slice.map(m => m !== 'off')
      const playerCpuLevels = slice.map(m => (m === 'off' ? DEFAULT_CPU_LEVEL : m))
      this.time.delayedCall(delayMs, () => {
        this.scene.start('BoardScene', {
          playerNames: names,
          playerEmojis: emojis,
          playerCharacters: characters,
          roundsPerGame,
          playerCpu,
          playerCpuLevels,
        })
      })
    }
    if (flashMs > 0) {
      this.cameras.main.fadeOut(flashMs, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, advance)
    } else {
      advance()
    }
  }
}
