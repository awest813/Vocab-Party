import Phaser from 'phaser'
import { GameState, Player, TileType, createInitialState } from '../systems/GameState'
import { rollDice } from '../systems/DiceSystem'
import { createButton } from '../ui/Button'
import { PlayerHUD } from '../ui/PlayerHUD'
import { showConfetti } from '../ui/Confetti'
import { TILE_TEXTURE_KEY, PLAYER_TEXTURE_KEYS, DICE_TEXTURE_KEYS } from '../systems/SpriteFactory'

const TILE_SIZE = 56
const BOARD_COLS = 12
const BOARD_ROWS = 8
const ROUNDS_PER_GAME = 10

const TILE_TYPES: TileType[] = [
  'vocab','grammar','bonus','vocab','grammar','minigame','vocab','grammar','mystery','vocab','bonus','grammar',
  'vocab','grammar','vocab','minigame','grammar','vocab','bonus','mystery','vocab','grammar','swap','vocab',
  'bonus','vocab','grammar','vocab','mystery','grammar','vocab','minigame','grammar','vocab','bonus','vocab',
]

function buildPath(cols: number, rows: number): {col: number, row: number}[] {
  const path: {col: number, row: number}[] = []
  // Clockwise around a rectangle
  for (let c = 0; c < cols; c++) path.push({ col: c, row: 0 })
  for (let r = 1; r < rows; r++) path.push({ col: cols - 1, row: r })
  for (let c = cols - 2; c >= 0; c--) path.push({ col: c, row: rows - 1 })
  for (let r = rows - 2; r > 0; r--) path.push({ col: 0, row: r })
  return path
}

const TILE_LABELS: Record<TileType, string> = {
  vocab: '📖',
  grammar: '✏️',
  bonus: '⭐',
  mystery: '❓',
  minigame: '🕹️',
  swap: '🔄',
  start: '🏠'
}

const PLAYER_NAMES = ['Alex', 'Blake', 'Casey', 'Dana']
const PLAYER_EMOJIS = ['🔴', '🔵', '🟢', '🟡']

export class BoardScene extends Phaser.Scene {
  private state!: GameState
  private path!: {col: number, row: number}[]
  private boardOriginX!: number
  private boardOriginY!: number
  private playerTokens!: Phaser.GameObjects.Container[]
  private hud!: PlayerHUD
  private rollBtn!: Phaser.GameObjects.Container
  private statusText!: Phaser.GameObjects.Text
  private diceSprite!: Phaser.GameObjects.Image
  private rolling = false
  private roundText!: Phaser.GameObjects.Text

  constructor() { super('BoardScene') }

  create(data?: { playerNames?: string[], playerEmojis?: string[] }) {
    const w = this.scale.width
    const h = this.scale.height

    const names = data?.playerNames ?? PLAYER_NAMES
    const emojis = data?.playerEmojis ?? PLAYER_EMOJIS

    this.state = createInitialState(names, emojis)
    this.path = buildPath(BOARD_COLS, BOARD_ROWS)

    const boardW = BOARD_COLS * TILE_SIZE
    const boardH = BOARD_ROWS * TILE_SIZE
    this.boardOriginX = (w - boardW) / 2
    this.boardOriginY = (h - boardH) / 2 - 24

    this.add.rectangle(0, 0, w, h, 0x0d0d1f).setOrigin(0)
    this.drawBoard()

    this.playerTokens = this.state.players.map((p, i) => this.createToken(p, i))

    this.hud = new PlayerHUD(this, this.state)

    // Bottom control panel
    this.add.rectangle(w / 2, h - 56, w, 112, 0x12122a).setOrigin(0.5, 0.5)
    this.add.rectangle(w / 2, h - 112, w, 2, 0x334466).setOrigin(0.5, 0.5)

    this.statusText = this.add.text(w / 2 - 160, h - 56, '', {
      fontSize: '20px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#000033',
      strokeThickness: 4
    }).setOrigin(0.5)

    this.diceSprite = this.add.image(w / 2 + 80, h - 56, DICE_TEXTURE_KEYS[0]).setDisplaySize(52, 52)

    this.roundText = this.add.text(w - 16, 18, '', {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#aaddff',
      stroke: '#000033',
      strokeThickness: 4
    }).setOrigin(1, 0)

    this.rollBtn = createButton(this, w - 110, h - 56, '🎲 ROLL', 0xffcc00, 0xcc9900, 180, 56)
    this.rollBtn.on('pointerdown', () => this.handleRoll())

    this.updateStatus()
  }

  drawBoard() {
    const path = this.path
    path.forEach((cell, i) => {
      const type: TileType = i === 0 ? 'start' : TILE_TYPES[i % TILE_TYPES.length]
      const x = this.boardOriginX + cell.col * TILE_SIZE + TILE_SIZE / 2
      const y = this.boardOriginY + cell.row * TILE_SIZE + TILE_SIZE / 2

      const img = this.add.image(x, y, TILE_TEXTURE_KEY(type))
      img.setDisplaySize(TILE_SIZE - 4, TILE_SIZE - 4)
      img.setInteractive()
      img.on('pointerover', () => img.setAlpha(0.8))
      img.on('pointerout', () => img.setAlpha(1))

      this.add.text(x, y + 2, TILE_LABELS[type], { fontSize: '20px' }).setOrigin(0.5)

      this.add.text(x - TILE_SIZE / 2 + 6, y - TILE_SIZE / 2 + 4, String(i), {
        fontSize: '9px',
        color: '#ffffff'
      }).setAlpha(0.7)
    })

    const cx = this.boardOriginX + BOARD_COLS * TILE_SIZE / 2
    const cy = this.boardOriginY + BOARD_ROWS * TILE_SIZE / 2
    this.add.text(cx, cy - 20, '🎉 VOCAB', { fontSize: '28px', fontFamily: 'Arial Black' }).setOrigin(0.5)
    this.add.text(cx, cy + 20, 'PARTY', { fontSize: '28px', fontFamily: 'Arial Black', color: '#FFD700' }).setOrigin(0.5)
  }

  createToken(player: Player, index: number): Phaser.GameObjects.Container {
    const {x, y} = this.getTileXY(0)
    const offsets = [{x:-10,y:-10},{x:10,y:-10},{x:-10,y:10},{x:10,y:10}]
    const offset = offsets[index]
    const container = this.add.container(x + offset.x, y + offset.y)
    const sprite = this.add.image(0, 0, PLAYER_TEXTURE_KEYS[index]).setDisplaySize(28, 28)
    const label = this.add.text(0, 0, player.emoji, { fontSize: '12px' }).setOrigin(0.5)
    container.add([sprite, label])
    container.setDepth(10)
    return container
  }

  getTileXY(index: number): {x: number, y: number} {
    const cell = this.path[index % this.path.length]
    return {
      x: this.boardOriginX + cell.col * TILE_SIZE + TILE_SIZE / 2,
      y: this.boardOriginY + cell.row * TILE_SIZE + TILE_SIZE / 2
    }
  }

  updateStatus() {
    const p = this.state.players[this.state.currentPlayer]
    this.statusText.setText(`${p.emoji} ${p.name}'s Turn`)
    this.roundText.setText(`Round ${this.state.round} / ${ROUNDS_PER_GAME}`)
    this.hud.update(this.state)
  }

  async handleRoll() {
    if (this.rolling) return
    this.rolling = true
    this.rollBtn.setAlpha(0.5)

    const player = this.state.players[this.state.currentPlayer]

    // Dramatic dice roll animation
    this.time.addEvent({
      delay: 80,
      repeat: 14,
      callback: () => {
        const face = Phaser.Math.Between(1, 6)
        this.diceSprite.setTexture(DICE_TEXTURE_KEYS[face - 1])
        this.cameras.main.shake(50, 0.003)
      }
    })

    await new Promise<void>(res => this.time.delayedCall(1300, res))

    const result = rollDice()
    this.diceSprite.setTexture(DICE_TEXTURE_KEYS[result - 1])
    this.statusText.setText(`${player.emoji} ${player.name} rolled a ${result}!`)

    this.tweens.add({
      targets: this.diceSprite,
      scaleX: 1.5, scaleY: 1.5,
      duration: 150,
      yoyo: true,
      ease: 'Back.easeOut'
    })

    await new Promise<void>(res => this.time.delayedCall(600, res))

    await this.movePlayer(this.state.currentPlayer, result)
  }

  async movePlayer(playerIndex: number, steps: number) {
    const player = this.state.players[playerIndex]
    const token = this.playerTokens[playerIndex]
    const offsets = [{x:-10,y:-10},{x:10,y:-10},{x:-10,y:10},{x:10,y:10}]
    const off = offsets[playerIndex]

    for (let s = 0; s < steps; s++) {
      player.position = (player.position + 1) % this.path.length
      const {x, y} = this.getTileXY(player.position)
      await new Promise<void>(res => {
        this.tweens.add({
          targets: token,
          x: x + off.x,
          y: y + off.y,
          duration: 180,
          ease: 'Back.easeOut',
          onComplete: () => res()
        })
      })
    }

    this.cameras.main.shake(100, 0.005)
    this.tweens.add({
      targets: token,
      scaleX: 1.4, scaleY: 0.7,
      duration: 80,
      yoyo: true
    })

    await new Promise<void>(res => this.time.delayedCall(300, res))
    this.landOnTile(playerIndex)
  }

  landOnTile(playerIndex: number) {
    const player = this.state.players[playerIndex]
    const tileIndex = player.position
    const type: TileType = tileIndex === 0 ? 'start' : TILE_TYPES[tileIndex % TILE_TYPES.length]

    this.statusText.setText(`${player.emoji} ${player.name} landed on ${TILE_LABELS[type]} ${type.toUpperCase()}!`)

    this.time.delayedCall(700, () => {
      switch (type) {
        case 'start':
          player.score += 3
          this.showFloatyText(player, '+3 Bonus!', '#FFD700')
          this.endTurn()
          break
        case 'bonus':
          player.score += 5
          this.showFloatyText(player, '+5 Points!', '#FFD700')
          showConfetti(this)
          this.endTurn()
          break
        case 'vocab':
        case 'grammar':
          this.scene.launch('QuestionScene', {
            type,
            playerIndex,
            state: this.state,
            onComplete: (correct: boolean) => {
              this.scene.stop('QuestionScene')
              if (correct) {
                player.score += 10
                this.showFloatyText(player, '+10 Points!', '#44ff88')
                showConfetti(this)
              } else {
                this.showFloatyText(player, 'Missed!', '#ff4444')
              }
              this.time.delayedCall(600, () => this.endTurn())
            }
          })
          this.scene.pause()
          break
        case 'minigame':
          this.scene.launch('MinigameScene', {
            state: this.state,
            onComplete: (winnerId: number) => {
              this.scene.stop('MinigameScene')
              if (winnerId >= 0) {
                this.state.players[winnerId].score += 15
                this.showFloatyText(this.state.players[winnerId], '+15 Minigame Win!', '#ff88ff')
                showConfetti(this)
              }
              this.time.delayedCall(600, () => this.endTurn())
            }
          })
          this.scene.pause()
          break
        case 'mystery':
          this.handleMystery(player)
          break
        case 'swap':
          this.handleSwap(player, playerIndex)
          break
        default:
          this.endTurn()
      }
    })
  }

  showFloatyText(player: Player, msg: string, color: string) {
    const playerIndex = this.state.players.indexOf(player)
    const tokenPos = this.playerTokens[playerIndex]
    const txt = this.add.text(tokenPos.x, tokenPos.y - 20, msg, {
      fontSize: '24px',
      fontFamily: 'Arial Black',
      color,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(20)
    this.tweens.add({
      targets: txt,
      y: tokenPos.y - 80,
      alpha: 0,
      duration: 1200,
      onComplete: () => txt.destroy()
    })
  }

  handleMystery(player: Player) {
    const effects = [
      { msg: '⭐ +8 Mystery Bonus!', color: '#FFD700', fn: () => { player.score += 8 } },
      { msg: '😱 -5 Oops!', color: '#ff4444', fn: () => { player.score = Math.max(0, player.score - 5) } },
      { msg: '🎲 Extra Roll!', color: '#88aaff', fn: () => { this.time.delayedCall(1400, () => this.handleRoll()) } },
    ]
    const effect = Phaser.Utils.Array.GetRandom(effects)
    effect.fn()
    this.statusText.setText(effect.msg)
    this.showFloatyText(player, effect.msg, effect.color)
    this.time.delayedCall(1200, () => this.endTurn())
  }

  handleSwap(player: Player, playerIndex: number) {
    const others = this.state.players.filter((_, i) => i !== playerIndex)
    const target = Phaser.Utils.Array.GetRandom(others)
    const targetIndex = this.state.players.indexOf(target)

    const tmpPos = player.position
    player.position = target.position
    target.position = tmpPos

    const offsets = [{x:-10,y:-10},{x:10,y:-10},{x:-10,y:10},{x:10,y:10}]
    const p1 = this.getTileXY(player.position)
    const p2 = this.getTileXY(target.position)
    const o1 = offsets[playerIndex]
    const o2 = offsets[targetIndex]
    this.tweens.add({ targets: this.playerTokens[playerIndex], x: p1.x + o1.x, y: p1.y + o1.y, duration: 500 })
    this.tweens.add({ targets: this.playerTokens[targetIndex], x: p2.x + o2.x, y: p2.y + o2.y, duration: 500 })

    this.statusText.setText(`🔄 ${player.name} & ${target.name} swapped!`)
    this.time.delayedCall(1200, () => this.endTurn())
  }

  endTurn() {
    this.scene.resume()
    this.rolling = false
    this.rollBtn.setAlpha(1)

    this.state.turn++
    const totalTurns = this.state.players.length * ROUNDS_PER_GAME
    if (this.state.turn >= totalTurns) {
      this.time.delayedCall(500, () => {
        this.scene.start('ResultsScene', { state: this.state })
      })
      return
    }

    this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length
    if (this.state.currentPlayer === 0) {
      this.state.round++
    }
    this.updateStatus()
  }
}
