import Phaser from 'phaser'
import type { CpuLevel } from '../systems/CpuPolicy'
import { GameState, Player, TileType, createInitialState } from '../systems/GameState'
import { rollBlockDie } from '../systems/DiceSystem'
import { BOARD_COLS, BOARD_ROWS, BOARD_PATH } from '../systems/BoardLayout'
import { createButton } from '../ui/Button'
import { PlayerHUD } from '../ui/PlayerHUD'
import { showConfetti } from '../ui/Confetti'
import { addStarfieldBackdrop } from '../ui/Starfield'
import { playCoinBurst } from '../ui/CoinBurst'
import { TILE_TEXTURE_KEY, PLAYER_TEXTURE_KEYS, DICE_TEXTURE_KEYS } from '../systems/SpriteFactory'
import { cpuBoardQuestionResolve, cpuRollDelayMs } from '../systems/CpuPolicy'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import type { QuestionResolution } from './QuestionScene'

const TILE_SIZE = 56
const DEFAULT_ROUNDS_PER_GAME = 10

const TILE_TYPES: TileType[] = [
  'shop','vocab','grammar','bonus','star','grammar','minigame','vocab','brick','mystery','vocab','shop',
  'vocab','grammar','shop','minigame','grammar','star','bonus','mystery','brick','vocab','grammar','swap',
  'bonus','vocab','shop','grammar','mystery','brick','vocab','minigame','grammar','star','bonus','vocab',
]

const TILE_LABELS: Record<TileType, string> = {
  vocab: '📖',
  grammar: '✏️',
  bonus: '⭐',
  mystery: '❓',
  minigame: '🕹️',
  swap: '🔄',
  start: '🏠',
  shop: '🏪',
  star: '🌟',
  brick: '🧱'
}

const STAR_COST_COINS = 20
const SHOP_PRICE_COINS = 8
const SHOP_RENT_COINS = 3
const SHOP_OWNER_INCOME = 2
const SHOP_PORTFOLIO_RENT_STEP = 2
const SHOP_PORTFOLIO_INCOME_STEP = 1
const BRICKS_FOR_BUILD_BONUS = 4
const BUILD_BONUS_SCORE = 6
const QUESTION_BASE_POINTS = 10
const QUESTION_BASE_COINS = 3
const QUESTION_STREAK_THRESHOLD = 3
const QUESTION_STREAK_BONUS_COINS = 4

const PLAYER_NAMES = ['Alex', 'Blake', 'Casey', 'Dana']
const PLAYER_EMOJIS = ['🔴', '🔵', '🟢', '🟡']

export class BoardScene extends Phaser.Scene {
  private state!: GameState
  private path!: {col: number, row: number}[]
  private roundsPerGame = DEFAULT_ROUNDS_PER_GAME
  private boardOriginX!: number
  private boardOriginY!: number
  private playerTokens!: Phaser.GameObjects.Container[]
  private hud!: PlayerHUD
  private rollBtn!: Phaser.GameObjects.Container
  private statusText!: Phaser.GameObjects.Text
  private tileHintText?: Phaser.GameObjects.Text
  private diceSprite!: Phaser.GameObjects.Image
  private rolling = false
  private roundText!: Phaser.GameObjects.Text
  private turnGlow?: Phaser.GameObjects.Arc
  private turnGlowTween?: Phaser.Tweens.Tween
  /** Tile index → owner player id (Fortune Street–style shops). */
  private shopOwners: Record<number, number> = {}

  private d(ms: number) {
    return scaleAutoSimDelay(ms)
  }

  constructor() { super('BoardScene') }

  private getTileTypeAt(tileIndex: number): TileType {
    return tileIndex === 0 ? 'start' : TILE_TYPES[tileIndex % TILE_TYPES.length]
  }

  private countOwnedShops(ownerId: number): number {
    return Object.values(this.shopOwners).filter(id => id === ownerId).length
  }

  private describeTile(tileIndex: number, type: TileType): string {
    switch (type) {
      case 'start':
        return `Tile ${tileIndex}: START — pass by for +5 coins, land for +3 score/+3 coins.`
      case 'bonus':
        return `Tile ${tileIndex}: BONUS — instant +5 score and +4 coins.`
      case 'vocab':
      case 'grammar':
        return `Tile ${tileIndex}: ${type.toUpperCase()} — answer fast for bonus points and Speed Surge.`
      case 'minigame':
        return `Tile ${tileIndex}: MINIGAME — winner gains +15 score and +5 coins.`
      case 'mystery':
        return `Tile ${tileIndex}: MYSTERY — random event: jackpots, steals, boosts, or extra roll.`
      case 'swap':
        return `Tile ${tileIndex}: SWAP — randomly trade positions with another player.`
      case 'shop': {
        const ownerId = this.shopOwners[tileIndex]
        if (ownerId === undefined) {
          return `Tile ${tileIndex}: SHOP — buy for ${SHOP_PRICE_COINS} coins.`
        }
        const owner = this.state.players.find(p => p.id === ownerId)
        const owned = this.countOwnedShops(ownerId)
        return `Tile ${tileIndex}: SHOP — owned by ${owner?.name ?? 'Unknown'} (${owned} total).`
      }
      case 'star':
        return `Tile ${tileIndex}: STAR — spend ${STAR_COST_COINS} coins for a trophy (+12 score).`
      case 'brick':
        return `Tile ${tileIndex}: BRICK — gather pieces; every ${BRICKS_FOR_BUILD_BONUS} gives +${BUILD_BONUS_SCORE} score.`
      default:
        return `Tile ${tileIndex}: ${type.toUpperCase()}`
    }
  }

  private getCoinLeader(excludeId?: number): Player | undefined {
    const candidates = this.state.players.filter(p => p.id !== excludeId)
    if (candidates.length === 0) return undefined
    return [...candidates].sort((a, b) => b.coins - a.coins)[0]
  }

  create(data?: {
    playerNames?: string[]
    playerEmojis?: string[]
    roundsPerGame?: number
    playerCpu?: boolean[]
    playerCpuLevels?: CpuLevel[]
  }) {
    const w = this.scale.width
    const h = this.scale.height

    const names = data?.playerNames ?? PLAYER_NAMES
    const emojis = data?.playerEmojis ?? PLAYER_EMOJIS
    this.roundsPerGame = data?.roundsPerGame ?? DEFAULT_ROUNDS_PER_GAME
    const cpuFlags = data?.playerCpu ?? names.map(() => false)
    const cpuLevels = data?.playerCpuLevels

    this.state = createInitialState(names, emojis, cpuFlags, cpuLevels)
    this.path = BOARD_PATH

    const boardW = BOARD_COLS * TILE_SIZE
    const boardH = BOARD_ROWS * TILE_SIZE
    this.boardOriginX = (w - boardW) / 2
    this.boardOriginY = (h - boardH) / 2 - 24

    this.drawBackdrop(w, h)
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

    const rollKeyHandler = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'KeyR') {
        ev.preventDefault()
        this.tryRollFromKeyboard()
      }
    }
    this.input.keyboard?.on('keydown', rollKeyHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', rollKeyHandler)
    })

    this.updateStatus()
    this.maybeScheduleCpuTurn()
  }

  /** Roll the die from keyboard when it is the human's turn (board scene active, not mid-roll). */
  private tryRollFromKeyboard() {
    if (this.scene.isPaused() || this.rolling) return
    if (this.state.players[this.state.currentPlayer]?.isCpu) return
    this.handleRoll()
  }

  /** After status updates, CPU players roll automatically after a short beat. */
  private maybeScheduleCpuTurn() {
    if (this.scene.isPaused() || this.rolling) return
    const p = this.state.players[this.state.currentPlayer]
    if (!p?.isCpu) return
    this.rollBtn.setAlpha(0.42)
    this.time.delayedCall(this.d(cpuRollDelayMs(Phaser.Math, p.cpuLevel)), () => {
      if (!this.scene.isActive() || this.scene.isPaused() || this.rolling) return
      if (!this.state.players[this.state.currentPlayer]?.isCpu) return
      this.handleRoll(true)
    })
  }

  drawBackdrop(w: number, h: number) {
    this.add.rectangle(0, 0, w, h, 0x080814).setOrigin(0)
    addStarfieldBackdrop(this, 0.38)
    for (let i = 0; i < 48; i++) {
      const sx = Phaser.Math.Between(8, w - 8)
      const sy = Phaser.Math.Between(8, h - 140)
      const a = Phaser.Math.FloatBetween(0.08, 0.22)
      this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xaaccff, a).setDepth(-5)
    }
  }

  drawBoard() {
    const boardW = BOARD_COLS * TILE_SIZE
    const boardH = BOARD_ROWS * TILE_SIZE
    const pad = 18
    const frameW = boardW + pad * 2
    const frameH = boardH + pad * 2
    const fx = this.boardOriginX - pad
    const fy = this.boardOriginY - pad

    this.add.rectangle(fx + frameW / 2, fy + frameH / 2, frameW + 14, frameH + 14, 0x2a1810).setDepth(-3)
    this.add.rectangle(fx + frameW / 2, fy + frameH / 2, frameW + 6, frameH + 6, 0x4a3020).setDepth(-3)
    const felt = this.add.rectangle(fx + frameW / 2, fy + frameH / 2, frameW, frameH, 0x0e2418)
    felt.setStrokeStyle(4, 0x1f4d32, 1).setDepth(-2)

    const pathSet = new Set(this.path.map(p => `${p.col},${p.row}`))
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (pathSet.has(`${col},${row}`)) continue
        const x = this.boardOriginX + col * TILE_SIZE + TILE_SIZE / 2
        const y = this.boardOriginY + row * TILE_SIZE + TILE_SIZE / 2
        this.add.rectangle(x, y, TILE_SIZE - 6, TILE_SIZE - 6, 0x07160f, 0.92).setDepth(-1)
      }
    }

    const path = this.path
    path.forEach((cell, i) => {
      const type = this.getTileTypeAt(i)
      const x = this.boardOriginX + cell.col * TILE_SIZE + TILE_SIZE / 2
      const y = this.boardOriginY + cell.row * TILE_SIZE + TILE_SIZE / 2

      const img = this.add.image(x, y, TILE_TEXTURE_KEY(type))
      img.setDisplaySize(TILE_SIZE - 4, TILE_SIZE - 4)
      img.setDepth(0)
      img.setInteractive()
      img.on('pointerover', () => {
        img.setAlpha(0.8)
        this.tileHintText?.setText(this.describeTile(i, type))
      })
      img.on('pointerout', () => {
        img.setAlpha(1)
        this.tileHintText?.setText('Hover a tile to inspect its effect.')
      })

      this.add.text(x, y + 2, TILE_LABELS[type], { fontSize: '20px' }).setOrigin(0.5).setDepth(1)

      this.add.text(x - TILE_SIZE / 2 + 6, y - TILE_SIZE / 2 + 4, String(i), {
        fontSize: '9px',
        color: '#ffffff'
      }).setAlpha(0.7).setDepth(1)
    })

    const cx = this.boardOriginX + BOARD_COLS * TILE_SIZE / 2
    const cy = this.boardOriginY + BOARD_ROWS * TILE_SIZE / 2
    const titlePanel = this.add.rectangle(cx, cy, 220, 88, 0x0a1520, 0.88)
    titlePanel.setStrokeStyle(2, 0x335577, 0.9).setDepth(2)
    this.add.text(cx, cy - 18, '🎉 VOCAB', {
      fontSize: '26px',
      fontFamily: 'Arial Black',
      color: '#e8f4ff',
      stroke: '#102040',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(3)
    this.add.text(cx, cy + 18, 'PARTY', {
      fontSize: '26px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#553300',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(3)

    this.tileHintText = this.add.text(cx, this.boardOriginY + BOARD_ROWS * TILE_SIZE + 14, 'Hover a tile to inspect its effect.', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#bbd7ff'
    }).setOrigin(0.5, 0).setDepth(3)
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
    const cpuTag = p.isCpu ? ' 🤖' : ''
    const momentum: string[] = []
    if (p.answerStreak >= 2) momentum.push(`🧠x${p.answerStreak}`)
    if (p.speedBoostTurns > 0) momentum.push(`💨x${p.speedBoostTurns}`)
    const momentumTag = momentum.length > 0 ? ` · ${momentum.join(' ')}` : ''
    this.statusText.setText(`${p.emoji} ${p.name}'s Turn${cpuTag}${momentumTag}`)
    this.roundText.setText(`Round ${this.state.round} / ${this.roundsPerGame}`)
    this.hud.update(this.state)

    if (p.isCpu && !this.rolling) {
      this.rollBtn.setAlpha(0.42)
    } else if (!this.rolling) {
      this.rollBtn.setAlpha(1)
    }

    this.turnGlowTween?.stop()
    this.turnGlow?.destroy()

    const pos = p.position
    const { x, y } = this.getTileXY(pos)
    this.turnGlow = this.add.circle(x, y, TILE_SIZE * 0.48)
    this.turnGlow.setStrokeStyle(4, 0xffe066, 0.95)
    this.turnGlow.setFillStyle(0xffcc33, 0.12)
    this.turnGlow.setDepth(4)
    this.turnGlowTween = this.tweens.add({
      targets: this.turnGlow,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: isAutoSimMode() ? 40 : 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.maybeScheduleCpuTurn()
  }

  /** @param isCpuInvocation - must be true when the automated CPU triggers the roll */
  async handleRoll(isCpuInvocation = false) {
    if (this.rolling) return
    const cur = this.state.players[this.state.currentPlayer]
    if (cur.isCpu !== isCpuInvocation) return
    this.rolling = true
    this.rollBtn.setAlpha(0.5)

    const player = this.state.players[this.state.currentPlayer]

    // Dramatic dice roll animation
    this.time.addEvent({
      delay: isAutoSimMode() ? 12 : 80,
      repeat: 14,
      callback: () => {
        const face = Phaser.Math.Between(1, 3)
        this.diceSprite.setTexture(DICE_TEXTURE_KEYS[face - 1])
        this.cameras.main.shake(50, 0.003)
      }
    })

    await new Promise<void>(res => this.time.delayedCall(this.d(1300), res))

    let result = rollBlockDie()
    const hadSpeedBoost = player.speedBoostTurns > 0
    if (hadSpeedBoost) {
      result = Math.min(3, result + 1)
      player.speedBoostTurns = Math.max(0, player.speedBoostTurns - 1)
    }
    this.diceSprite.setTexture(DICE_TEXTURE_KEYS[result - 1])
    const surgeText = hadSpeedBoost ? ' + 💨 Speed Surge' : ''
    this.statusText.setText(`${player.emoji} ${player.name} rolled ${result} (block die: 1–3)${surgeText}!`)

    this.tweens.add({
      targets: this.diceSprite,
      scaleX: 1.5, scaleY: 1.5,
      duration: isAutoSimMode() ? 24 : 150,
      yoyo: true,
      ease: 'Back.easeOut'
    })

    await new Promise<void>(res => this.time.delayedCall(this.d(600), res))

    await this.movePlayer(this.state.currentPlayer, result)
  }

  async movePlayer(playerIndex: number, steps: number) {
    const player = this.state.players[playerIndex]
    const token = this.playerTokens[playerIndex]
    const offsets = [{x:-10,y:-10},{x:10,y:-10},{x:-10,y:10},{x:10,y:10}]
    const off = offsets[playerIndex]

    for (let s = 0; s < steps; s++) {
      const prev = player.position
      player.position = (player.position + 1) % this.path.length
      if (prev > 0 && player.position === 0) {
        player.coins += 5
        this.showFloatyText(player, '+5 Lap Coins!', '#ffcc66')
      }
      const {x, y} = this.getTileXY(player.position)
      await new Promise<void>(res => {
        this.tweens.add({
          targets: token,
          x: x + off.x,
          y: y + off.y,
          duration: isAutoSimMode() ? 28 : 180,
          ease: 'Back.easeOut',
          onComplete: () => res()
        })
      })
    }

    this.cameras.main.shake(100, 0.005)
    this.tweens.add({
      targets: token,
      scaleX: 1.4, scaleY: 0.7,
      duration: isAutoSimMode() ? 16 : 80,
      yoyo: true
    })

    await new Promise<void>(res => this.time.delayedCall(this.d(300), res))
    this.landOnTile(playerIndex)
  }

  landOnTile(playerIndex: number) {
    const player = this.state.players[playerIndex]
    const tileIndex = player.position
    const type = this.getTileTypeAt(tileIndex)

    this.statusText.setText(`${player.emoji} ${player.name} landed on ${TILE_LABELS[type]} ${type.toUpperCase()}!`)

    this.time.delayedCall(this.d(700), () => {
      switch (type) {
        case 'start':
          player.score += 3
          player.coins += 3
          this.showFloatyText(player, '+3 Bonus & coins!', '#FFD700')
          this.endTurn()
          break
        case 'bonus':
          player.score += 5
          player.coins += 4
          this.showFloatyText(player, '+5 pts +4 coins!', '#FFD700')
          showConfetti(this)
          this.endTurn()
          break
        case 'vocab':
        case 'grammar':
          this.scene.launch('QuestionScene', {
            type,
            playerIndex,
            state: this.state,
            ...(player.isCpu ? { cpuResolve: cpuBoardQuestionResolve(Phaser.Math, player.cpuLevel) } : {}),
            onComplete: (result: QuestionResolution) => {
              this.scene.stop('QuestionScene')
              this.scene.resume()
              if (result.correct) {
                player.answerStreak += 1
                const streakBonusCoins = player.answerStreak % QUESTION_STREAK_THRESHOLD === 0
                  ? QUESTION_STREAK_BONUS_COINS
                  : 0
                const scoreGain = QUESTION_BASE_POINTS + result.timeBonus
                const coinGain = QUESTION_BASE_COINS + Math.floor(result.timeBonus / 2) + streakBonusCoins
                player.score += scoreGain
                player.coins += coinGain
                if (result.speedSurge) {
                  player.speedBoostTurns += 1
                }

                const parts = [`+${scoreGain} pts +${coinGain} coins!`]
                if (streakBonusCoins > 0) parts.push('🧠 Streak bonus!')
                if (result.speedSurge) parts.push('💨 Surge ready!')
                this.showFloatyText(player, parts.join(' '), '#44ff88')
                showConfetti(this)
              } else {
                const lostStreak = player.answerStreak
                player.answerStreak = 0
                const missMsg = lostStreak >= 2 ? `Missed! Streak reset (${lostStreak})` : 'Missed!'
                this.showFloatyText(player, missMsg, '#ff4444')
              }
              this.time.delayedCall(this.d(600), () => this.endTurn())
            }
          })
          this.scene.pause()
          break
        case 'minigame':
          this.scene.launch('MinigameScene', {
            state: this.state,
            cpuMode: player.isCpu,
            cpuLevel: player.cpuLevel,
            onComplete: (winnerId: number) => {
              this.scene.stop('MinigameScene')
              this.scene.resume()
              if (winnerId >= 0) {
                const w = this.state.players[winnerId]
                w.score += 15
                w.coins += 5
                this.showFloatyText(w, '+15 pts +5 coins!', '#ff88ff')
                showConfetti(this)
              }
              this.time.delayedCall(this.d(600), () => this.endTurn())
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
        case 'shop':
          this.handleShop(player, playerIndex, tileIndex)
          break
        case 'star':
          this.handleStarShop(player)
          break
        case 'brick':
          this.handleBrickCollect(player)
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
    if (msg.includes('+')) {
      playCoinBurst(this, tokenPos.x, tokenPos.y - 8)
    }
    this.tweens.add({
      targets: txt,
      y: tokenPos.y - 80,
      alpha: 0,
      duration: isAutoSimMode() ? 80 : 1200,
      onComplete: () => txt.destroy()
    })
  }

  handleShop(player: Player, playerIndex: number, tileIndex: number) {
    const ownerId = this.shopOwners[tileIndex]

    if (ownerId === undefined) {
      if (player.coins >= SHOP_PRICE_COINS) {
        player.coins -= SHOP_PRICE_COINS
        this.shopOwners[tileIndex] = player.id
        this.statusText.setText(`🏪 ${player.name} bought this shop!`)
        this.showFloatyText(player, `-${SHOP_PRICE_COINS} 🪙 · You own it!`, '#ffaa66')
      } else {
        this.statusText.setText(`🏪 Too pricey! Need ${SHOP_PRICE_COINS} coins.`)
        this.showFloatyText(player, 'Window shopping…', '#aaaaaa')
      }
      this.time.delayedCall(this.d(1200), () => this.endTurn())
      return
    }

    if (ownerId === player.id) {
      const owned = this.countOwnedShops(player.id)
      const portfolioBonus = Math.max(0, owned - 1) * SHOP_PORTFOLIO_INCOME_STEP
      const payout = SHOP_OWNER_INCOME + portfolioBonus
      player.coins += payout
      this.statusText.setText(`🏪 Your shop pays out!`)
      this.showFloatyText(player, `+${payout} shop income (${owned} owned)!`, '#88ffaa')
      this.time.delayedCall(this.d(1200), () => this.endTurn())
      return
    }

    const owner = this.state.players.find(p => p.id === ownerId)
    if (!owner) {
      this.time.delayedCall(this.d(800), () => this.endTurn())
      return
    }
    const owned = this.countOwnedShops(ownerId)
    const rent = SHOP_RENT_COINS + Math.max(0, owned - 1) * SHOP_PORTFOLIO_RENT_STEP
    const pay = Math.min(player.coins, rent)
    player.coins -= pay
    owner.coins += pay
    this.statusText.setText(`🏪 Rent to ${owner.name}! (${owned} shops)`)
    this.showFloatyText(player, `-${pay} rent`, '#ff8888')
    this.showFloatyText(owner, `+${pay} rent!`, '#88ff88')
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  handleStarShop(player: Player) {
    if (player.coins >= STAR_COST_COINS) {
      player.coins -= STAR_COST_COINS
      player.trophies += 1
      player.score += 12
      this.statusText.setText(`🌟 ${player.name} got a Star Trophy!`)
      this.showFloatyText(player, 'Star Trophy! +12 pts', '#ffee44')
      showConfetti(this)
    } else {
      player.coins += 2
      this.statusText.setText(`🌟 Save up! Stars cost ${STAR_COST_COINS} coins.`)
      this.showFloatyText(player, '+2 pity coins', '#aaccff')
    }
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  handleBrickCollect(player: Player) {
    player.bricksCollected += 1
    player.coins += 1
    const n = player.bricksCollected
    let msg = '+1 brick · +1 coin'
    if (n % BRICKS_FOR_BUILD_BONUS === 0) {
      player.score += BUILD_BONUS_SCORE
      msg = `Build bonus! +${BUILD_BONUS_SCORE} pts`
      this.statusText.setText(`🧱 ${player.name} built a set!`)
      showConfetti(this)
    } else {
      this.statusText.setText(`🧱 Brick ${n} collected!`)
    }
    this.showFloatyText(player, msg, '#ff9966')
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  handleMystery(player: Player) {
    const effects: { color: string; extraRoll?: boolean; apply: () => string }[] = [
      {
        color: '#FFD700',
        apply: () => {
          player.score += 8
          player.coins += 3
          return '⭐ Mystery jackpot! +8 score +3 coins!'
        }
      },
      {
        color: '#ff4444',
        apply: () => {
          player.score = Math.max(0, player.score - 5)
          return '😱 Oops! -5 score.'
        }
      },
      {
        color: '#ffdd88',
        apply: () => {
          player.coins += 10
          return '🪙 Coin shower! +10 coins!'
        }
      },
      {
        color: '#88aaff',
        extraRoll: true,
        apply: () => '🎲 Extra Roll!'
      },
      {
        color: '#88ffaa',
        apply: () => {
          const leader = this.getCoinLeader(player.id)
          if (!leader) return '🥷 No one to rob in solo mode.'
          const steal = Math.min(4, leader.coins)
          if (steal <= 0) return `🥷 ${leader.name} had no coins to steal.`
          leader.coins -= steal
          player.coins += steal
          this.showFloatyText(leader, `-${steal} coins`, '#ff8888')
          return `🥷 Heist! Stole ${steal} from ${leader.name}.`
        }
      },
      {
        color: '#ff9966',
        apply: () => {
          player.bricksCollected += 2
          player.coins += 2
          return '🧱 Supply cache! +2 bricks and +2 coins.'
        }
      },
      {
        color: '#aaccff',
        apply: () => {
          const owned = this.countOwnedShops(player.id)
          const rebate = Math.min(8, owned * 2)
          if (rebate <= 0) return '🏪 Tax rebate fizzled (no shops owned).'
          player.coins += rebate
          return `🏪 Shop rebate! +${rebate} coins.`
        }
      }
    ]
    const effect = Phaser.Utils.Array.GetRandom(effects)
    const message = effect.apply()
    this.statusText.setText(message)
    this.showFloatyText(player, message, effect.color)

    if (effect.extraRoll) {
      this.time.delayedCall(this.d(1200), () => {
        this.rolling = false
        this.rollBtn.setAlpha(1)
        const cpu = this.state.players[this.state.currentPlayer]?.isCpu ?? false
        this.handleRoll(cpu)
      })
      return
    }
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  handleSwap(player: Player, playerIndex: number) {
    const others = this.state.players.filter((_, i) => i !== playerIndex)
    if (others.length === 0) {
      this.statusText.setText('🔄 No one to swap with in a solo game.')
      this.showFloatyText(player, 'Solo — no swap!', '#aaaaaa')
      this.time.delayedCall(this.d(1200), () => this.endTurn())
      return
    }
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
    const swapDur = isAutoSimMode() ? 60 : 500
    this.tweens.add({ targets: this.playerTokens[playerIndex], x: p1.x + o1.x, y: p1.y + o1.y, duration: swapDur })
    this.tweens.add({ targets: this.playerTokens[targetIndex], x: p2.x + o2.x, y: p2.y + o2.y, duration: swapDur })

    this.statusText.setText(`🔄 ${player.name} & ${target.name} swapped!`)
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  endTurn() {
    this.scene.resume()
    this.rolling = false
    this.rollBtn.setAlpha(1)

    this.state.turn++
    const totalTurns = this.state.players.length * this.roundsPerGame
    if (this.state.turn >= totalTurns) {
      this.time.delayedCall(this.d(500), () => {
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
