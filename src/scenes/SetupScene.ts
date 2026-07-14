import Phaser from 'phaser'
import { createButton, setButtonEnabled, setButtonFill } from '../ui/Button'
import { addAmbientMotes, addStarfieldBackdrop, driftStarfield } from '../ui/Starfield'
import { addVignette, createInsetPlate, paintStage } from '../ui/Panel'
import { COLORS, FONT, PLAYER_HEX, hexColor } from '../ui/Theme'
import { BOARD_PATH_LENGTH } from '../systems/BoardLayout'
import { PLAYER_TEXTURE_KEYS } from '../systems/SpriteFactory'
import type { CpuLevel } from '../systems/CpuPolicy'
import { CPU_LEVEL_LABEL, DEFAULT_CPU_LEVEL } from '../systems/CpuPolicy'
import { isAutoSimMode, getAutoSimFullMap, getAutoSimRounds, getAutoSimPlayers } from '../systems/gameFlags'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'

const MAX_PLAYERS = 4
const MIN_PLAYERS = 1

const DEFAULT_NAMES = ['Alex', 'Blake', 'Casey', 'Dana']
const PLAYER_EMOJIS = ['🔴', '🔵', '🟢', '🟡']
const PLAYER_COLORS = [...PLAYER_HEX]

interface InputRow {
  label: Phaser.GameObjects.Text
  nameText: Phaser.GameObjects.Text
  cursor: Phaser.GameObjects.Text
  bg: Phaser.GameObjects.Rectangle
  ring: Phaser.GameObjects.Graphics
  active: boolean
  value: string
}

const CLASSIC_ROUNDS = 10

type CpuSlotMode = 'off' | CpuLevel

export class SetupScene extends Phaser.Scene {
  private playerCount = 4
  /** Per-slot: human, or CPU at a difficulty level. Only first `playerCount` entries matter. */
  private cpuModeByRow: CpuSlotMode[] = ['off', 'off', 'off', 'off']
  private cpuToggleTexts: Phaser.GameObjects.Text[] = []
  /** When true, game lasts one lap per player (rounds = tiles on the track). */
  private fullMapMode = false
  private rows: InputRow[] = []
  private activeRow = -1
  private countText!: Phaser.GameObjects.Text
  private minusBtn!: Phaser.GameObjects.Container
  private plusBtn!: Phaser.GameObjects.Container
  private startBtn!: Phaser.GameObjects.Container
  private rowContainers: Phaser.GameObjects.Container[] = []
  private cursorTimers: Phaser.Time.TimerEvent[] = []

  constructor() { super('SetupScene') }

  create() {
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

    // Brand-forward header with nested depth
    const headerPanel = this.add.container(w / 2, 72).setDepth(5)
    const hShadow = this.add.graphics()
    hShadow.fillStyle(0x000000, 0.35)
    hShadow.fillRoundedRect(-430, -40, 860, 88, 18)
    const hBg = this.add.graphics()
    hBg.fillStyle(COLORS.bgPanel, 0.88)
    hBg.fillRoundedRect(-424, -46, 848, 92, 18)
    hBg.fillStyle(COLORS.skyDeep, 0.55)
    hBg.fillRoundedRect(-424, -46, 848, 8, { tl: 18, tr: 18, bl: 0, br: 0 })
    hBg.lineStyle(2.5, COLORS.gold, 0.4)
    hBg.strokeRoundedRect(-424, -46, 848, 92, 18)
    hBg.fillStyle(0xffffff, 0.06)
    hBg.fillRoundedRect(-414, -38, 828, 22, 8)

    const titleText = this.add.text(0, -10, 'PARTY SETUP', {
      fontSize: '42px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5)
    const subtitle = this.add.text(0, 24, 'Players · map length · human or CPU', {
      fontSize: '15px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5)
    headerPanel.add([hShadow, hBg, titleText, subtitle])
    if (!reduce) {
      headerPanel.setAlpha(0).setY(90)
      this.tweens.add({
        targets: headerPanel,
        alpha: 1,
        y: 72,
        duration: 420,
        ease: 'Cubic.easeOut',
      })
    }

    // Options band: player count + map length
    const optionsY = 188
    createInsetPlate(this, w / 2, optionsY, 980, 118, {
      fill: COLORS.bgPanel,
      fillAlpha: 0.78,
      border: COLORS.sky,
      borderAlpha: 0.28,
      radius: 16,
    }).setDepth(3)

    const countPanel = this.add.container(w / 2 - 250, optionsY).setDepth(4)
    const cpBg = this.add.graphics()
    cpBg.fillStyle(COLORS.bgPanelAlt, 0.92)
    cpBg.fillRoundedRect(-190, -42, 380, 84, 14)
    cpBg.lineStyle(2.5, COLORS.gold, 0.55)
    cpBg.strokeRoundedRect(-190, -42, 380, 84, 14)

    const countLabel = this.add.text(0, -24, 'PLAYER COUNT', {
      fontSize: '13px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
    }).setOrigin(0.5)

    this.minusBtn = createButton(this, -110, 14, '−', COLORS.skyDeep, COLORS.skyBtnDeep, 60, 44)
    this.minusBtn.on('pointerdown', () => this.changeCount(-1))

    this.countText = this.add.text(0, 14, String(this.playerCount), {
      fontSize: '40px',
      fontFamily: FONT.display,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5)

    this.plusBtn = createButton(this, 110, 14, '+', COLORS.skyDeep, COLORS.skyBtnDeep, 60, 44)
    this.plusBtn.on('pointerdown', () => this.changeCount(1))

    countPanel.add([cpBg, countLabel, this.minusBtn, this.countText, this.plusBtn])

    const lenPanel = this.add.container(w / 2 + 220, optionsY).setDepth(4)
    const mapLabel = this.add.text(0, -36, 'MAP LENGTH', {
      fontSize: '13px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
    }).setOrigin(0.5)

    const classicBtn = createButton(this, -150, 10, `CLASSIC · ${CLASSIC_ROUNDS}`, COLORS.skyBtn, COLORS.skyBtnDeep, 220, 48)
    const fullMapBtn = createButton(this, 150, 10, `FULL MAP · ${BOARD_PATH_LENGTH}`, COLORS.chrome, COLORS.chromeDeep, 220, 48)
    classicBtn.on('pointerdown', () => this.setFullMapMode(false, classicBtn, fullMapBtn))
    fullMapBtn.on('pointerdown', () => this.setFullMapMode(true, classicBtn, fullMapBtn))
    this.setFullMapMode(false, classicBtn, fullMapBtn)
    lenPanel.add([mapLabel, classicBtn, fullMapBtn])

    // Roster plate
    const rosterTop = 278
    const rosterH = 300
    createInsetPlate(this, w / 2, rosterTop + rosterH / 2 - 20, 980, rosterH, {
      fill: COLORS.bgPanel,
      fillAlpha: 0.72,
      border: COLORS.strokeSoft,
      borderAlpha: 0.14,
      radius: 16,
    }).setDepth(3)

    this.add.text(w / 2, rosterTop + 4, 'ROSTER', {
      fontSize: '14px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.teal),
    }).setOrigin(0.5).setDepth(4)

    this.add.text(w / 2, rosterTop + 26, touch
      ? 'Tap a name to edit  ·  Tap HUMAN/CPU to cycle  ·  Tap START'
      : 'Click name to type  ·  Tab to cycle  ·  Click HUMAN/CPU to change  ·  Enter to start', {
      fontSize: '13px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
      align: 'center',
      wordWrap: { width: 900 },
    }).setOrigin(0.5).setDepth(4)

    this.rows = []
    this.rowContainers = []
    this.cpuToggleTexts = []
    const ROW_SPACING = 58
    const startY = rosterTop + 68
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.buildRow(i, startY, ROW_SPACING)
      this.refreshCpuToggle(i)
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

    const startGlow = this.add.ellipse(w / 2, h - 64, 420, 90, COLORS.mint, 0.12).setDepth(4)
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

    this.startBtn = createButton(this, w / 2, h - 64, '▶  START PARTY', COLORS.party, COLORS.partyDeep, 420, 64)
    this.startBtn.setDepth(8)
    this.startBtn.on('pointerdown', () => this.startGame())
    if (!reduce) {
      this.startBtn.setAlpha(0)
      this.startBtn.y += 16
      this.tweens.add({
        targets: this.startBtn,
        alpha: 1,
        y: '-=16',
        duration: 420,
        delay: 480,
        ease: 'Back.easeOut',
      })
    }

    if (isAutoSimMode()) {
      this.playerCount = getAutoSimPlayers()
      this.countText.setText(String(this.playerCount))
      this.fullMapMode = getAutoSimFullMap()
      this.cpuModeByRow = ['normal', 'normal', 'normal', 'normal']
      for (let i = 0; i < MAX_PLAYERS; i++) this.refreshCpuToggle(i)
      this.refreshRows()
      const requested = getAutoSimRounds()
      const rounds = requested ?? (this.fullMapMode ? BOARD_PATH_LENGTH : 5)
      this.time.delayedCall(80, () => this.startGameWithRounds(rounds))
    }

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))
    this.input.keyboard?.on('keydown-ENTER', () => { if (this.activeRow < 0) this.startGame() })
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
      this.input.keyboard?.off('keydown-ESC')
      this.cursorTimers.forEach(t => t.destroy())
      this.cursorTimers = []
    })

    this.cameras.main.fadeIn(360, 7, 11, 20)
  }

  setFullMapMode(fullMap: boolean, classicBtn: Phaser.GameObjects.Container, fullMapBtn: Phaser.GameObjects.Container) {
    this.fullMapMode = fullMap
    setButtonFill(classicBtn, fullMap ? COLORS.chrome : COLORS.skyBtn)
    setButtonFill(fullMapBtn, fullMap ? COLORS.party : COLORS.chrome)
    classicBtn.setAlpha(1)
    fullMapBtn.setAlpha(1)
  }

  buildRow(index: number, firstRowY: number, spacing: number = 88) {
    const w = this.scale.width
    const rowY = firstRowY + index * spacing
    const inputW = 380
    const inputH = 46
    const inputX = w / 2 + 70

    const container = this.add.container(0, 0).setDepth(5)
    this.rowContainers.push(container)

    // Soft row plate
    const rowPlate = this.add.graphics()
    rowPlate.fillStyle(COLORS.bgDeep, 0.28)
    rowPlate.fillRoundedRect(w / 2 - 460, rowY - 24, 920, 48, 12)
    rowPlate.lineStyle(1, COLORS.strokeSoft, 0.08)
    rowPlate.strokeRoundedRect(w / 2 - 460, rowY - 24, 920, 48, 12)

    const swatchColor = parseInt(PLAYER_COLORS[index].replace('#', ''), 16)
    const tokenKey = PLAYER_TEXTURE_KEYS[index]
    const tokenX = w / 2 - 400

    const ring = this.add.graphics()
    ring.lineStyle(3, swatchColor, 0.55)
    ring.strokeCircle(tokenX, rowY, 22)
    ring.fillStyle(swatchColor, 0.12)
    ring.fillCircle(tokenX, rowY, 20)

    let swatch: Phaser.GameObjects.GameObject
    if (this.textures.exists(tokenKey)) {
      swatch = this.add.image(tokenX, rowY, tokenKey).setDisplaySize(34, 38)
    } else {
      const circle = this.add.circle(tokenX, rowY, 12, swatchColor)
      circle.setStrokeStyle(2, 0xffffff, 0.7)
      swatch = circle
    }

    const label = this.add.text(tokenX + 34, rowY, `P${index + 1}`, {
      fontSize: '20px',
      fontFamily: FONT.display,
      color: PLAYER_COLORS[index],
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5)

    const cpuToggle = this.add.text(w / 2 - 250, rowY, 'HUMAN', {
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
      fontSize: '22px',
      fontFamily: FONT.body,
      color: '#ffffff',
    }).setOrigin(0, 0.5)

    const cursor = this.add.text(inputX - inputW / 2 + 14, rowY, '', {
      fontSize: '22px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.sky),
    }).setOrigin(0, 0.5).setVisible(false)

    container.add([rowPlate, ring, swatch, label, cpuToggle, bg, nameText, cursor])

    const row: InputRow = {
      label,
      nameText,
      cursor,
      bg,
      ring,
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
      row.bg.setAlpha(childAlpha)
      row.nameText.setAlpha(childAlpha)
      row.ring.setAlpha(enabled ? 1 : 0.25)
      if (enabled) row.bg.setInteractive()
      else row.bg.disableInteractive()
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
      // Keep entrance tweens intact — only snap alpha when not mid-intro
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
      const swatchColor = parseInt(PLAYER_COLORS[i].replace('#', ''), 16)
      row.ring.clear()
      row.ring.lineStyle(isActive ? 4 : 3, swatchColor, isActive ? 0.9 : 0.55)
      const tokenX = this.scale.width / 2 - 400
      const rowY = row.bg.y
      row.ring.strokeCircle(tokenX, rowY, 22)
      row.ring.fillStyle(swatchColor, isActive ? 0.22 : 0.12)
      row.ring.fillCircle(tokenX, rowY, 20)
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
    const inputW = 380
    const w = this.scale.width
    const inputX = w / 2 + 70
    const displayName = row.value || ' '
    row.nameText.setText(displayName)
    const textW = row.nameText.width
    row.cursor.setX(inputX - inputW / 2 + 14 + textW)
    row.cursor.setText('|')
  }

  startGame() {
    const roundsPerGame = this.fullMapMode ? BOARD_PATH_LENGTH : CLASSIC_ROUNDS
    this.startGameWithRounds(roundsPerGame)
  }

  private startGameWithRounds(roundsPerGame: number) {
    const names = this.rows.slice(0, this.playerCount).map((r, i) =>
      r.value.trim() || DEFAULT_NAMES[i]
    )
    const emojis = PLAYER_EMOJIS.slice(0, this.playerCount)
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
