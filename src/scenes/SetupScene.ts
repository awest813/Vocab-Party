import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { BOARD_PATH_LENGTH } from '../systems/BoardLayout'
import type { CpuLevel } from '../systems/CpuPolicy'
import { CPU_LEVEL_LABEL, DEFAULT_CPU_LEVEL } from '../systems/CpuPolicy'
import { isAutoSimMode } from '../systems/gameFlags'

const MAX_PLAYERS = 4
const MIN_PLAYERS = 1

const DEFAULT_NAMES = ['Alex', 'Blake', 'Casey', 'Dana']
const PLAYER_EMOJIS = ['🔴', '🔵', '🟢', '🟡']
const PLAYER_COLORS = ['#ff6666', '#6688ff', '#66dd66', '#ffdd44']

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

    // Cinematic Backdrop
    this.add.rectangle(0, 0, w, h, 0x050510).setOrigin(0)
    const ambient = this.add.graphics()
    ambient.fillGradientStyle(0x1a1a3a, 0x1a1a3a, 0x050510, 0x050510, 0.4)
    ambient.fillRect(0, 0, w, h)
    this.createStars()

    // Back button
    const backBtn = createButton(this, 100, 50, '← MENU', 0x334466, 0x223355, 140, 48)
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'))

    // Glassmorphic Header Panel
    const headerPanel = this.add.container(w / 2, 80)
    const hBg = this.add.rectangle(0, 0, 1100, 100, 0x0a1528, 0.7)
    hBg.setStrokeStyle(2, 0x4488ff, 0.3)
    const titleText = this.add.text(0, -10, '🚀 EXPEDITION SETUP', {
      fontSize: '48px', fontFamily: 'Fredoka, Arial Black', color: '#ffffff', stroke: '#4488ff', strokeThickness: 8
    }).setOrigin(0.5)
    headerPanel.add([hBg, titleText])

    // Player Count Console
    const countY = 180
    const countPanel = this.add.container(w / 2, countY)
    const cpBg = this.add.rectangle(0, 0, 400, 80, 0x1a2a4a, 0.8)
    cpBg.setStrokeStyle(3, 0xffd700, 0.5)
    
    const countLabel = this.add.text(0, -25, 'PLAYER COUNT', { fontSize: '14px', fontFamily: 'Fredoka, Arial Black', color: '#ffd700' }).setOrigin(0.5)
    
    this.minusBtn = createButton(this, -120, 10, '−', 0x554488, 0x332266, 60, 44)
    this.minusBtn.on('pointerdown', () => this.changeCount(-1))
 
    this.countText = this.add.text(0, 10, String(this.playerCount), {
      fontSize: '42px', fontFamily: 'Fredoka, Arial Black', color: '#ffffff'
    }).setOrigin(0.5)
 
    this.plusBtn = createButton(this, 120, 10, '+', 0x554488, 0x332266, 60, 44)
    this.plusBtn.on('pointerdown', () => this.changeCount(1))
    
    countPanel.add([cpBg, countLabel, this.minusBtn, this.countText, this.plusBtn])

    // Game Length Console
    const lengthY = 275
    const lenPanel = this.add.container(w / 2, lengthY)
    
    const classicBtn = createButton(this, -200, 0, `CLASSIC · ${CLASSIC_ROUNDS} ROUNDS`, 0x334466, 0x223355, 360, 50)
    const fullMapBtn = createButton(this, 200, 0, `FULL MAP · ${BOARD_PATH_LENGTH} ROUNDS`, 0x2a5533, 0x1a4422, 360, 50)
    classicBtn.on('pointerdown', () => this.setFullMapMode(false, classicBtn, fullMapBtn))
    fullMapBtn.on('pointerdown', () => this.setFullMapMode(true, classicBtn, fullMapBtn))
    this.setFullMapMode(false, classicBtn, fullMapBtn)
    lenPanel.add([classicBtn, fullMapBtn])

    // Name rows header
    this.add.text(w / 2, 318, 'Click to type · Tab/Enter to cycle · CPU: click to cycle · Enter to start · Esc to back', {
      fontSize: '15px',
      fontFamily: 'Fredoka, Arial',
      color: '#667788'
    }).setOrigin(0.5)

    this.rows = []
    this.rowContainers = []
    this.cpuToggleTexts = []
    const startY = 360
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.buildRow(i, startY)
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
 
    // Start Button
    this.startBtn = createButton(this, w / 2, h - 80, '🚀 COMMENCE EXPEDITION', 0x22bb55, 0x1a8844, 420, 64)
    this.startBtn.on('pointerdown', () => this.startGame())

    if (isAutoSimMode()) {
      this.playerCount = 4
      this.countText.setText(String(this.playerCount))
      this.fullMapMode = false
      this.cpuModeByRow = ['normal', 'normal', 'normal', 'normal']
      for (let i = 0; i < MAX_PLAYERS; i++) this.refreshCpuToggle(i)
      this.refreshRows()
      this.time.delayedCall(80, () => this.startGameWithRounds(5))
    }

    // Keyboard input
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))

    // Enter to start, Escape to go back
    this.input.keyboard?.on('keydown-ENTER', () => { if (this.activeRow < 0) this.startGame() })
    // Enter to start, Escape to deselect or go back
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.activeRow >= 0) this.setActiveRow(-1)
      else this.scene.start('MenuScene')
    })

    // Tap away to deselect
    this.input.on('pointerdown', (_ptr: Phaser.Input.Pointer, objs: Phaser.GameObjects.GameObject[]) => {
      if (objs.length === 0) this.setActiveRow(-1)
    })

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown')
      this.input.keyboard?.off('keydown-ENTER')
      this.input.keyboard?.off('keydown-ESC')
      this.cursorTimers.forEach(t => t.destroy())
      this.cursorTimers = []
    })
  }

  createStars() {
    const w = this.scale.width
    const h = this.scale.height
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, w)
      const y = Phaser.Math.Between(0, h)
      const size = Phaser.Math.FloatBetween(0.8, 2.5)
      const star = this.add.circle(x, y, size, 0xffffff, Phaser.Math.FloatBetween(0.15, 0.7))
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.05, 0.25),
        duration: Phaser.Math.Between(900, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
        ease: 'Sine.easeInOut'
      })
    }
  }

  setFullMapMode(fullMap: boolean, classicBtn: Phaser.GameObjects.Container, fullMapBtn: Phaser.GameObjects.Container) {
    this.fullMapMode = fullMap
    classicBtn.setAlpha(fullMap ? 0.55 : 1)
    fullMapBtn.setAlpha(fullMap ? 1 : 0.55)
  }

  buildRow(index: number, firstRowY: number) {
    const w = this.scale.width
    const rowY = firstRowY + index * 88
    const inputW = 380
    const inputH = 54
    const inputX = w / 2 + 60

    const container = this.add.container(0, 0)
    this.rowContainers.push(container)

    // Color swatch
    const swatchColor = parseInt(PLAYER_COLORS[index].replace('#', ''), 16)
    const swatch = this.add.rectangle(w / 2 - 240, rowY, 18, 18, swatchColor)
    swatch.setStrokeStyle(2, 0xffffff)

    // Player label
    const label = this.add.text(w / 2 - 222, rowY, `${PLAYER_EMOJIS[index]} Player ${index + 1}`, {
      fontSize: '20px',
      fontFamily: 'Fredoka, Arial Black',
      color: PLAYER_COLORS[index]
    }).setOrigin(0, 0.5)

    const cpuToggle = this.add.text(w / 2 - 88, rowY, '(CPU)', {
      fontSize: '15px',
      fontFamily: 'Fredoka, Arial',
      color: '#6699aa'
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

    // Input background
    const bg = this.add.rectangle(inputX, rowY, inputW, inputH, 0x181830)
    bg.setStrokeStyle(2, 0x334466)
    bg.setInteractive()
    bg.on('pointerdown', () => this.setActiveRow(index))

    // Name display text
    const nameText = this.add.text(inputX - inputW / 2 + 14, rowY, DEFAULT_NAMES[index], {
      fontSize: '22px',
      fontFamily: 'Fredoka, Arial',
      color: '#ffffff'
    }).setOrigin(0, 0.5)

    // Cursor
    const cursor = this.add.text(inputX - inputW / 2 + 14, rowY, '', {
      fontSize: '22px',
      fontFamily: 'Fredoka, Arial',
      color: '#88aaff'
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
      t.setText('(CPU)')
      t.setColor('#6699aa')
    } else {
      t.setText(`CPU · ${CPU_LEVEL_LABEL[mode]}`)
      t.setColor(mode === 'hard' ? '#ffcc88' : '#88ddaa')
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
      row.bg.setStrokeStyle(2, isActive ? 0x88aaff : 0x334466)
      row.bg.setFillStyle(isActive ? 0x1e2248 : 0x181830)
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
    if (flashMs > 0) this.cameras.main.fadeOut(flashMs, 0, 0, 0)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
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
    })
  }
}
