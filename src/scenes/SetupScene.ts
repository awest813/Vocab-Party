import Phaser from 'phaser'
import { createButton } from '../ui/Button'

const MAX_PLAYERS = 4
const MIN_PLAYERS = 2

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

export class SetupScene extends Phaser.Scene {
  private playerCount = 4
  private rows: InputRow[] = []
  private activeRow = -1
  private countText!: Phaser.GameObjects.Text
  private minusBtn!: Phaser.GameObjects.Container
  private plusBtn!: Phaser.GameObjects.Container
  private startBtn!: Phaser.GameObjects.Container
  private rowContainers: Phaser.GameObjects.Container[] = []

  constructor() { super('SetupScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height

    this.add.rectangle(0, 0, w, h, 0x1a1a2e).setOrigin(0)

    // Title
    this.add.text(w / 2, 60, '🎉 VOCAB PARTY', {
      fontSize: '52px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#cc6600',
      strokeThickness: 7
    }).setOrigin(0.5)

    this.add.text(w / 2, 120, 'Player Setup', {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#aaddff',
      stroke: '#003366',
      strokeThickness: 3
    }).setOrigin(0.5)

    // Player count control
    this.add.text(w / 2, 190, 'Number of Players', {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#ffffff'
    }).setOrigin(0.5)

    this.minusBtn = createButton(this, w / 2 - 70, 235, '−', 0x554488, 0x332266, 50, 44)
    this.minusBtn.on('pointerdown', () => this.changeCount(-1))

    this.countText = this.add.text(w / 2, 235, String(this.playerCount), {
      fontSize: '32px',
      fontFamily: 'Arial Black',
      color: '#FFD700'
    }).setOrigin(0.5)

    this.plusBtn = createButton(this, w / 2 + 70, 235, '+', 0x554488, 0x332266, 50, 44)
    this.plusBtn.on('pointerdown', () => this.changeCount(1))

    // Name rows
    this.add.text(w / 2, 290, 'Enter player names (click a box to type)', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaaacc'
    }).setOrigin(0.5)

    this.rows = []
    this.rowContainers = []
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.buildRow(i)
    }
    this.refreshRows()

    // Start button
    this.startBtn = createButton(this, w / 2, h - 80, '▶  START GAME', 0x22bb55, 0x1a8844, 280)
    this.startBtn.on('pointerdown', () => this.startGame())

    // Keyboard input
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))

    // Tap away to deselect
    this.input.on('pointerdown', (_ptr: Phaser.Input.Pointer, objs: Phaser.GameObjects.GameObject[]) => {
      if (objs.length === 0) this.setActiveRow(-1)
    })
  }

  buildRow(index: number) {
    const w = this.scale.width
    const rowY = 345 + index * 80
    const inputW = 400
    const inputH = 52
    const inputX = w / 2 + 40

    const container = this.add.container(0, 0)
    this.rowContainers.push(container)

    // Player label
    const label = this.add.text(w / 2 - 220, rowY, `${PLAYER_EMOJIS[index]} Player ${index + 1}`, {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: PLAYER_COLORS[index]
    }).setOrigin(0, 0.5)

    // Input background
    const bg = this.add.rectangle(inputX, rowY, inputW, inputH, 0x222244)
    bg.setStrokeStyle(3, 0x445588)
    bg.setInteractive()
    bg.on('pointerdown', () => this.setActiveRow(index))

    // Name display text
    const nameText = this.add.text(inputX - inputW / 2 + 14, rowY, DEFAULT_NAMES[index], {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0, 0.5)

    // Cursor
    const cursor = this.add.text(inputX - inputW / 2 + 14, rowY, '', {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#88aaff'
    }).setOrigin(0, 0.5).setVisible(false)

    container.add([label, bg, nameText, cursor])

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
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (row.active) cursor.setVisible(!cursor.visible)
        else cursor.setVisible(false)
      }
    })
  }

  refreshRows() {
    this.rows.forEach((row, i) => {
      const enabled = i < this.playerCount
      row.label.setAlpha(enabled ? 1 : 0.3)
      row.bg.setAlpha(enabled ? 1 : 0.3)
      row.nameText.setAlpha(enabled ? 1 : 0.3)
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
      row.bg.setStrokeStyle(3, isActive ? 0xaaddff : 0x445588)
      row.bg.setFillStyle(isActive ? 0x2a3a66 : 0x222244)
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
    const inputW = 400
    const w = this.scale.width
    const inputX = w / 2 + 40
    const displayName = row.value || ' '
    row.nameText.setText(displayName)
    // Position cursor after text
    const textW = row.nameText.width
    row.cursor.setX(inputX - inputW / 2 + 14 + textW)
    row.cursor.setText('|')
  }

  startGame() {
    const names = this.rows.slice(0, this.playerCount).map((r, i) =>
      r.value.trim() || DEFAULT_NAMES[i]
    )
    const emojis = PLAYER_EMOJIS.slice(0, this.playerCount)
    this.cameras.main.flash(300, 255, 255, 255)
    this.time.delayedCall(300, () => {
      this.scene.start('BoardScene', { playerNames: names, playerEmojis: emojis })
    })
  }
}
