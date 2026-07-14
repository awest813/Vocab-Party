import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { paintStage } from '../ui/Panel'
import { COLORS, FONT, PLAYER_HEX, hexColor } from '../ui/Theme'
import { BOARD_PATH_LENGTH } from '../systems/BoardLayout'
import { PLAYER_TEXTURE_KEYS } from '../systems/SpriteFactory'
import type { CpuLevel } from '../systems/CpuPolicy'
import { CPU_LEVEL_LABEL, DEFAULT_CPU_LEVEL } from '../systems/CpuPolicy'
import { isAutoSimMode, getAutoSimFullMap, getAutoSimRounds, getAutoSimPlayers } from '../systems/gameFlags'

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
  private enterHandler?: () => void
  private escHandler?: () => void

  constructor() { super('SetupScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height

    paintStage(this)
    addStarfieldBackdrop(this, 0.4)
    addAmbientMotes(this, 18)

    const backBtn = createButton(this, 100, 48, '← MENU', COLORS.bgPanelAlt, 0x223048, 140, 48)
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'))

    const headerPanel = this.add.container(w / 2, 78)
    const hBg = this.add.graphics()
    hBg.fillStyle(COLORS.bgPanel, 0.78)
    hBg.fillRoundedRect(-420, -42, 840, 84, 16)
    hBg.lineStyle(2, COLORS.sky, 0.35)
    hBg.strokeRoundedRect(-420, -42, 840, 84, 16)
    const titleText = this.add.text(0, -4, 'PARTY SETUP', {
      fontSize: '44px',
      fontFamily: FONT.display,
      color: '#ffffff',
      stroke: hexColor(COLORS.skyDeep),
      strokeThickness: 7,
    }).setOrigin(0.5)
    const subtitle = this.add.text(0, 28, 'Choose players, length, and difficulty', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5)
    headerPanel.add([hBg, titleText, subtitle])

    const countY = 176
    const countPanel = this.add.container(w / 2, countY)
    const cpBg = this.add.graphics()
    cpBg.fillStyle(COLORS.bgPanelAlt, 0.9)
    cpBg.fillRoundedRect(-210, -38, 420, 76, 14)
    cpBg.lineStyle(2.5, COLORS.gold, 0.5)
    cpBg.strokeRoundedRect(-210, -38, 420, 76, 14)

    const countLabel = this.add.text(0, -22, 'PLAYER COUNT', {
      fontSize: '13px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
    }).setOrigin(0.5)

    this.minusBtn = createButton(this, -120, 12, '−', COLORS.skyDeep, 0x1e5a96, 60, 44)
    this.minusBtn.on('pointerdown', () => this.changeCount(-1))

    this.countText = this.add.text(0, 12, String(this.playerCount), {
      fontSize: '40px',
      fontFamily: FONT.display,
      color: '#ffffff',
    }).setOrigin(0.5)

    this.plusBtn = createButton(this, 120, 12, '+', COLORS.skyDeep, 0x1e5a96, 60, 44)
    this.plusBtn.on('pointerdown', () => this.changeCount(1))

    countPanel.add([cpBg, countLabel, this.minusBtn, this.countText, this.plusBtn])

    const lengthY = 268
    const lenPanel = this.add.container(w / 2, lengthY)

    const classicBtn = createButton(this, -200, 0, `CLASSIC · ${CLASSIC_ROUNDS} ROUNDS`, 0x3d8fff, 0x2a6fd4, 360, 50)
    const fullMapBtn = createButton(this, 200, 0, `FULL MAP · ${BOARD_PATH_LENGTH} ROUNDS`, 0x2a3548, 0x223048, 360, 50)
    classicBtn.on('pointerdown', () => this.setFullMapMode(false, classicBtn, fullMapBtn))
    fullMapBtn.on('pointerdown', () => this.setFullMapMode(true, classicBtn, fullMapBtn))
    this.setFullMapMode(false, classicBtn, fullMapBtn)
    lenPanel.add([classicBtn, fullMapBtn])

    this.add.text(w / 2, 312, 'Click name to type  ·  Tab to cycle  ·  Click HUMAN/CPU to change  ·  Enter to start', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: '#9eb6cc',
      stroke: '#0a1520',
      strokeThickness: 2,
    }).setOrigin(0.5)

    this.rows = []
    this.rowContainers = []
    this.cpuToggleTexts = []
    // Row band sits between the keyboard hint (~y=318) and the start button (~y=h-80).
    // Spacing tuned so 4 rows + start button fit at the 1280x720 design surface without overlap.
    const ROW_SPACING = 70
    const startY = 362
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.buildRow(i, startY, ROW_SPACING)
      this.rowContainers[i].setAlpha(0).setX(this.rowContainers[i].x - 50)
      this.tweens.add({
        targets: this.rowContainers[i],
        alpha: 1, x: '+=50',
        duration: 400, delay: 200 + i * 100,
        ease: 'Cubic.easeOut'
      })
      this.refreshCpuToggle(i)
    }
    this.refreshRows()
 
    this.startBtn = createButton(this, w / 2, h - 72, 'START PARTY', 0x2ad46a, 0x1fad55, 400, 64)
    this.startBtn.on('pointerdown', () => this.startGame())

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
  }

  setFullMapMode(fullMap: boolean, classicBtn: Phaser.GameObjects.Container, fullMapBtn: Phaser.GameObjects.Container) {
    this.fullMapMode = fullMap
    const setFill = (btn: Phaser.GameObjects.Container, color: number) => {
      const fn = (btn as any).setFillColor as ((c: number) => void) | undefined
      fn?.(color)
    }
    setFill(classicBtn, fullMap ? 0x2a3548 : 0x3d8fff)
    setFill(fullMapBtn, fullMap ? 0x2ad46a : 0x2a3548)
    classicBtn.setAlpha(1)
    fullMapBtn.setAlpha(1)
  }

  buildRow(index: number, firstRowY: number, spacing: number = 88) {
    const w = this.scale.width
    const rowY = firstRowY + index * spacing
    const inputW = 380
    const inputH = 48
    const inputX = w / 2 + 60

    const container = this.add.container(0, 0)
    this.rowContainers.push(container)

    // Color swatch / character token preview
    const swatchColor = parseInt(PLAYER_COLORS[index].replace('#', ''), 16)
    const tokenKey = PLAYER_TEXTURE_KEYS[index]
    let swatch: Phaser.GameObjects.GameObject
    if (this.textures.exists(tokenKey)) {
      swatch = this.add.image(w / 2 - 310, rowY, tokenKey).setDisplaySize(36, 40)
    } else {
      const circle = this.add.circle(w / 2 - 310, rowY, 12, swatchColor)
      circle.setStrokeStyle(2, 0xffffff, 0.7)
      swatch = circle
    }

    const label = this.add.text(w / 2 - 288, rowY, `P${index + 1}`, {
      fontSize: '20px',
      fontFamily: FONT.display,
      color: PLAYER_COLORS[index],
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5)

    const cpuToggle = this.add.text(w / 2 - 220, rowY, 'HUMAN', {
      fontSize: '14px',
      fontFamily: FONT.display,
      color: '#9eb6cc',
      backgroundColor: '#1a2438',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
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
    bg.setStrokeStyle(2, 0x3a4f6a)
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

    container.add([swatch, label, cpuToggle, bg, nameText, cursor])

    const row: InputRow = {
      label,
      nameText,
      cursor,
      bg,
      active: false,
      value: DEFAULT_NAMES[index]
    }
    this.rows.push(row)

    // Cursor blink
    const cursorTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (row.active) cursor.setVisible(!cursor.visible)
        else cursor.setVisible(false)
      }
    })
    this.cursorTimers.push(cursorTimer)
  }

  refreshCpuToggle(index: number) {
    const t = this.cpuToggleTexts[index]
    if (!t) return
    const mode = this.cpuModeByRow[index]
    if (mode === 'off') {
      t.setText('HUMAN')
      t.setColor('#9eb6cc')
      t.setBackgroundColor('#1a2438')
    } else {
      t.setText(`CPU · ${CPU_LEVEL_LABEL[mode].toUpperCase()}`)
      t.setColor(mode === 'hard' ? '#ffe0a8' : '#b6f0d0')
      t.setBackgroundColor(mode === 'hard' ? '#3a2a18' : '#163028')
    }
  }

  refreshRows() {
    this.rows.forEach((row, i) => {
      const enabled = i < this.playerCount
      row.label.setAlpha(enabled ? 1 : 0.3)
      row.bg.setAlpha(enabled ? 1 : 0.3)
      row.nameText.setAlpha(enabled ? 1 : 0.3)
      const cpuT = this.cpuToggleTexts[i]
      if (cpuT) {
        cpuT.setAlpha(enabled ? 1 : 0.3)
        if (enabled) cpuT.setInteractive({ useHandCursor: true })
        else {
          cpuT.disableInteractive()
          this.cpuModeByRow[i] = 'off'
          this.refreshCpuToggle(i)
        }
      }
      if (!enabled && row.active) this.setActiveRow(-1)
    })
  }

  changeCount(delta: number) {
    const next = this.playerCount + delta
    if (next < MIN_PLAYERS || next > MAX_PLAYERS) return
    this.playerCount = next
    this.countText.setText(String(this.playerCount))
    this.refreshRows()
  }

  setActiveRow(index: number) {
    this.activeRow = index
    this.rows.forEach((row, i) => {
      const isActive = i === index && i < this.playerCount
      row.active = isActive
      row.bg.setStrokeStyle(2, isActive ? COLORS.sky : 0x3a4f6a)
      row.bg.setFillStyle(isActive ? COLORS.bgPanelAlt : COLORS.bgPanel)
      if (!isActive) row.cursor.setVisible(false)
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
    const inputX = w / 2 + 60
    const displayName = row.value || ' '
    row.nameText.setText(displayName)
    // Position cursor after text
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
          playerCpuLevels
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
