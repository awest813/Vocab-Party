import Phaser from 'phaser'
import type { CpuLevel } from '../systems/CpuPolicy'
import { GameState, Player, TileType, createInitialState, ITEMS } from '../systems/GameState'
import { rollBlockDie } from '../systems/DiceSystem'
import { BOARD_COLS, BOARD_ROWS, BOARD_NODES, BoardNode } from '../systems/BoardLayout'
import { createButton } from '../ui/Button'
import { PlayerHUD } from '../ui/PlayerHUD'
import { showConfetti } from '../ui/Confetti'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { paintStage } from '../ui/Panel'
import { COLORS, DEPTH, FONT, hexColor } from '../ui/Theme'
import { playCoinBurst } from '../ui/CoinBurst'
import { TILE_TEXTURE_KEY, PLAYER_TEXTURE_KEYS, DICE_TEXTURE_KEYS } from '../systems/SpriteFactory'
import { cpuBoardQuestionResolve, cpuRollDelayMs, cpuChooseItem, cpuPolicyForLevel, cpuShouldBuyShop, cpuShouldBuyStar, cpuChooseBranch } from '../systems/CpuPolicy'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import type { QuestionResolution } from './QuestionScene'
import type { BattleResult } from './BattleScene'

const TILE_SIZE = 56
const DEFAULT_ROUNDS_PER_GAME = 10

const TILE_TYPES: TileType[] = [
  'shop','vocab','penalty','grammar','bonus','star','item_shop','minigame','vocab','brick','penalty','mystery','vocab','shop',
  'vocab','grammar','item_shop','minigame','grammar','penalty','star','bonus','mystery','brick','vocab','grammar','swap',
  'penalty','bonus','vocab','item_shop','grammar','mystery','brick','vocab','minigame','penalty','grammar','star','bonus','vocab',
]

const TILE_LABELS: Record<TileType, string> = {
  vocab: '📖',
  grammar: '✏️',
  bonus: '⭐',
  mystery: '❓',
  minigame: '🕹️',
  swap: '🔄',
  start: '🏠',
  shop:     '🏪',
  star:     '🌟',
  brick:    '🧱',
  item_shop: '🛍️',
  penalty:   '💀'
}

const STAR_COST_COINS = 20
const SHOP_PRICE_COINS = 8
const SHOP_RENT_COINS = 3
const SHOP_OWNER_INCOME = 2
const SHOP_PORTFOLIO_RENT_STEP = 2

const PLAYER_COLORS = [...COLORS.player]
const SHOP_PORTFOLIO_INCOME_STEP = 1
const BRICKS_FOR_BUILD_BONUS = 4
const BUILD_BONUS_SCORE = 6
const QUESTION_BASE_POINTS = 10
const QUESTION_BASE_COINS = 3
const QUESTION_STREAK_THRESHOLD = 3
const QUESTION_STREAK_BONUS_COINS = 4

export class BoardScene extends Phaser.Scene {
  private state!: GameState
  private nodes!: BoardNode[]
  private roundsPerGame = DEFAULT_ROUNDS_PER_GAME
  private boardOriginX!: number
  private boardOriginY!: number
  private playerTokens!: Phaser.GameObjects.Container[]
  private hud!: PlayerHUD
  private rollBtn!: Phaser.GameObjects.Container
  private itemBtn!: Phaser.GameObjects.Container
  private statusText!: Phaser.GameObjects.Text
  private tileHintText?: Phaser.GameObjects.Text
  private itemMenu?: Phaser.GameObjects.Container
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
      case 'item_shop':
        return `Tile ${tileIndex}: ITEM SHOP — buy powerful cards to use during your turn.`
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

    const names = data?.playerNames ?? ['Alex', 'Blake', 'Casey', 'Dana']
    const emojis = data?.playerEmojis ?? ['🔴', '🔵', '🟢', '🟡']
    this.roundsPerGame = data?.roundsPerGame ?? DEFAULT_ROUNDS_PER_GAME
    const cpuFlags = data?.playerCpu ?? names.map(() => false)
    const cpuLevels = data?.playerCpuLevels

    this.state = createInitialState(names, emojis, cpuFlags, cpuLevels)
    this.nodes = BOARD_NODES

    const boardW = BOARD_COLS * TILE_SIZE
    const boardH = BOARD_ROWS * TILE_SIZE
    this.boardOriginX = (w - boardW) / 2
    this.boardOriginY = (h - boardH) / 2 + 50

    this.drawBackdrop(w, h)
    this.drawBoard()

    this.playerTokens = this.state.players.map((p, i) => this.createToken(p, i))

    this.hud = new PlayerHUD(this, this.state)
    this.createPauseButton()
    this.input.keyboard?.on('keydown-ESC', () => this.pauseGame())

    // Bottom control panel
    const chrome = this.add.graphics().setDepth(DEPTH.chrome - 5)
    chrome.fillStyle(COLORS.bgPanel, 0.94)
    chrome.fillRect(0, h - 108, w, 108)
    chrome.fillStyle(COLORS.teal, 0.35)
    chrome.fillRect(0, h - 110, w, 3)
    chrome.fillStyle(0x000000, 0.25)
    chrome.fillRect(0, h - 108, w, 4)

    this.statusText = this.add.text(w / 2 - 160, h - 56, '', {
      fontSize: '20px',
      fontFamily: FONT.display,
      color: '#ffffff',
      stroke: '#000033',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.chrome)

    this.diceSprite = this.add.image(w / 2 + 80, h - 56, DICE_TEXTURE_KEYS[0]).setDisplaySize(52, 52).setDepth(DEPTH.chrome)

    this.roundText = this.add.text(w - 16, 18, '', {
      fontSize: '18px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.sky),
      stroke: '#000033',
      strokeThickness: 4,
    }).setOrigin(1, 0).setDepth(DEPTH.hud)

    this.rollBtn = createButton(this, w - 110, h - 56, 'ROLL', COLORS.gold, COLORS.goldDeep, 180, 56)
    this.rollBtn.setDepth(DEPTH.chrome)
    this.rollBtn.on('pointerdown', () => this.handleRoll())

    this.itemBtn = createButton(this, w - 300, h - 56, 'ITEMS', COLORS.teal, COLORS.tealDeep, 160, 56)
    this.itemBtn.setDepth(DEPTH.chrome)
    this.itemBtn.on('pointerdown', () => this.toggleItemMenu())

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
    paintStage(this)
    addStarfieldBackdrop(this, 0.42)
    addAmbientMotes(this, 26)
  }

  drawBoard() {
    const boardW = BOARD_COLS * TILE_SIZE
    const boardH = BOARD_ROWS * TILE_SIZE
    const pad = 24
    const frameW = boardW + pad * 2
    const frameH = boardH + pad * 2
    const fx = this.boardOriginX - pad
    const fy = this.boardOriginY - pad

    // Ornate outer frame
    const outer = this.add.rectangle(fx + frameW / 2, fy + frameH / 2, frameW + 12, frameH + 12, COLORS.bgDeep).setDepth(-3)
    outer.setStrokeStyle(4, COLORS.gold, 0.45)

    const inner = this.add.rectangle(fx + frameW / 2, fy + frameH / 2, frameW, frameH, COLORS.bgMid).setDepth(-2)
    inner.setStrokeStyle(2, COLORS.teal, 0.35)

    const felt = this.add.rectangle(fx + frameW / 2, fy + frameH / 2, boardW + 16, boardH + 16, COLORS.bgPanel)
    felt.setStrokeStyle(1, 0x3a4f6a, 0.5).setDepth(-1)

    // Decorative corner icons
    if (this.textures.exists(TEXTURE_KEYS.kenneyTrophy)) {
      let cornerIcons: string[] = [TEXTURE_KEYS.diamond, TEXTURE_KEYS.orbBlue, TEXTURE_KEYS.firstaid, TEXTURE_KEYS.orbRed]
        .filter((k) => this.textures.exists(k))
      if (cornerIcons.length === 0) {
        cornerIcons = [TEXTURE_KEYS.kenneyGamepad, TEXTURE_KEYS.kenneyStar, TEXTURE_KEYS.kenneyQuestion, TEXTURE_KEYS.kenneyCart]
      }
      const corners = [[fx + 4, fy + 4], [fx + frameW - 4, fy + 4], [fx + 4, fy + frameH - 4], [fx + frameW - 4, fy + frameH - 4]]
      corners.forEach(([cx, cy], i) => {
        this.add.image(cx, cy, cornerIcons[i % cornerIcons.length]).setDisplaySize(18, 18).setOrigin(0, 0).setDepth(0).setAlpha(0.4)
      })
    }

    const nodeSet = new Set(this.nodes.map(p => `${p.col},${p.row}`))
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (nodeSet.has(`${col},${row}`)) continue
        const x = this.boardOriginX + col * TILE_SIZE + TILE_SIZE / 2
        const y = this.boardOriginY + row * TILE_SIZE + TILE_SIZE / 2
        const cell = this.add.graphics().setDepth(-1)
        cell.fillStyle(0x0a1c14, 0.88)
        cell.fillRoundedRect(x - TILE_SIZE / 2 + 4, y - TILE_SIZE / 2 + 4, TILE_SIZE - 8, TILE_SIZE - 8, 8)
        cell.lineStyle(1, 0x1a3a28, 0.35)
        cell.strokeRoundedRect(x - TILE_SIZE / 2 + 4, y - TILE_SIZE / 2 + 4, TILE_SIZE - 8, TILE_SIZE - 8, 8)
      }
    }

    // Path underlay glow connecting tiles
    const pathGlow = this.add.graphics().setDepth(-1)
    pathGlow.lineStyle(10, COLORS.teal, 0.08)
    this.nodes.forEach((node, i) => {
      if (i === 0) return
      const prev = this.nodes[i - 1]
      const x1 = this.boardOriginX + prev.col * TILE_SIZE + TILE_SIZE / 2
      const y1 = this.boardOriginY + prev.row * TILE_SIZE + TILE_SIZE / 2
      const x2 = this.boardOriginX + node.col * TILE_SIZE + TILE_SIZE / 2
      const y2 = this.boardOriginY + node.row * TILE_SIZE + TILE_SIZE / 2
      pathGlow.lineBetween(x1, y1, x2, y2)
    })

    this.nodes.forEach((node, i) => {
      const type = this.getTileTypeAt(i)
      const x = this.boardOriginX + node.col * TILE_SIZE + TILE_SIZE / 2
      const y = this.boardOriginY + node.row * TILE_SIZE + TILE_SIZE / 2

      const img = this.add.image(x, y, TILE_TEXTURE_KEY(type))
      img.setDisplaySize(TILE_SIZE - 2, TILE_SIZE - 2)
      img.setDepth(0)
      img.setInteractive()
      img.setScale(0)

      this.tweens.add({
        targets: img,
        scaleX: (TILE_SIZE - 2) / img.width,
        scaleY: (TILE_SIZE - 2) / img.height,
        duration: 400,
        delay: i * 18,
        ease: 'Back.easeOut',
      })

      img.on('pointerover', () => {
        this.tweens.add({
          targets: img,
          scaleX: (TILE_SIZE - 2) / img.width * 1.1,
          scaleY: (TILE_SIZE - 2) / img.height * 1.1,
          duration: 100,
          ease: 'Sine.easeOut',
        })
        this.tileHintText?.setText(this.describeTile(i, type))
      })
      img.on('pointerout', () => {
        this.tweens.add({
          targets: img,
          scaleX: (TILE_SIZE - 2) / img.width,
          scaleY: (TILE_SIZE - 2) / img.height,
          duration: 100,
          ease: 'Sine.easeOut',
        })
        this.tileHintText?.setText('Hover a tile to inspect its effect.')
      })

      // Tiny index badge (readable, not competing with motif)
      this.add.text(x - TILE_SIZE / 2 + 7, y - TILE_SIZE / 2 + 5, String(i), {
        fontSize: '9px',
        fontFamily: FONT.display,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setAlpha(0.55).setDepth(1)

      if (type === 'shop' && this.shopOwners[i] !== undefined) {
        const owner = this.state.players.find(p => p.id === this.shopOwners[i])
        if (owner) {
          const ownerIdx = this.state.players.indexOf(owner)
          const ownerColor = PLAYER_COLORS[ownerIdx % PLAYER_COLORS.length]
          const dot = this.add.circle(x + TILE_SIZE / 2 - 9, y - TILE_SIZE / 2 + 9, 5, ownerColor, 1)
          dot.setDepth(2)
          dot.setStrokeStyle(1.5, 0xffffff, 0.75)
        }
      }
    })

    const cx = this.boardOriginX + BOARD_COLS * TILE_SIZE / 2
    const cy = this.boardOriginY + BOARD_ROWS * TILE_SIZE / 2
    const titlePanel = this.add.graphics().setDepth(2)
    titlePanel.fillStyle(COLORS.bgPanel, 0.9)
    titlePanel.fillRoundedRect(cx - 120, cy - 50, 240, 100, 14)
    titlePanel.lineStyle(2, COLORS.sky, 0.55)
    titlePanel.strokeRoundedRect(cx - 120, cy - 50, 240, 100, 14)

    if (this.textures.exists(TEXTURE_KEYS.kenneyStar)) {
      this.add.image(cx - 80, cy - 18, TEXTURE_KEYS.kenneyStar).setDisplaySize(20, 20).setDepth(3)
      this.add.image(cx + 80, cy - 18, TEXTURE_KEYS.kenneyStar).setDisplaySize(20, 20).setDepth(3)
    }
    this.add.text(cx, cy - 18, 'VOCAB', {
      fontSize: '28px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.frost),
      stroke: '#102040',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(3)
    this.add.text(cx, cy + 18, 'PARTY', {
      fontSize: '28px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.gold),
      stroke: '#553300',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(3)

    this.tileHintText = this.add.text(cx, this.boardOriginY + BOARD_ROWS * TILE_SIZE + 14, 'Hover a tile to inspect its effect.', {
      fontSize: '15px',
      fontFamily: FONT.body,
      color: '#d7e8ff',
      stroke: '#0a1520',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(3)
  }

  createToken(player: Player, index: number): Phaser.GameObjects.Container {
    const { x, y } = this.getTileXY(0)
    const offsets = [{ x: -12, y: -12 }, { x: 12, y: -12 }, { x: -12, y: 12 }, { x: 12, y: 12 }]
    const offset = offsets[index] ?? { x: 0, y: 0 }
    const container = this.add.container(x + offset.x, y + offset.y)

    const color = PLAYER_COLORS[index % PLAYER_COLORS.length]
    const ring = this.add.graphics()
    ring.fillStyle(0x000000, 0.2)
    ring.fillEllipse(1, 18, 34, 10)
    ring.lineStyle(3, color, 0.95)
    ring.strokeCircle(0, -2, 18)
    ring.lineStyle(1.5, 0xffffff, 0.55)
    ring.strokeCircle(0, -2, 15)

    const sprite = this.add.image(0, -4, PLAYER_TEXTURE_KEYS[index]).setDisplaySize(48, 62)

    container.add([ring, sprite])
    container.setDepth(DEPTH.tokens)

    // Idle bob
    this.tweens.add({
      targets: sprite,
      y: -7,
      duration: 900 + index * 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    return container
  }

  getTileXY(index: number): {x: number, y: number} {
    const node = this.nodes[index]
    return {
      x: this.boardOriginX + node.col * TILE_SIZE + TILE_SIZE / 2,
      y: this.boardOriginY + node.row * TILE_SIZE + TILE_SIZE / 2
    }
  }

  private showImpactText(x: number, y: number, text: string, color: string = '#ffffff') {
    const txt = this.add.text(x, y, text, {
      fontSize: '82px', fontFamily: 'Fredoka, Arial Black', color, stroke: '#000000', strokeThickness: 12
    }).setOrigin(0.5).setDepth(300).setScale(0)

    this.tweens.add({
      targets: txt,
      scaleX: 1, scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(600, () => {
          this.tweens.add({ targets: txt, alpha: 0, scaleX: 2, scaleY: 2, duration: 300, onComplete: () => txt.destroy() })
        })
      }
    })
  }

  private async showAnnouncement(msg: string, color: string = '#ffffff') {
    const w = this.scale.width
    const h = this.scale.height

    const banner = this.add.container(w / 2, -80).setDepth(DEPTH.banner)
    const g = this.add.graphics()
    const bw = Math.min(720, 40 + msg.length * 22)
    g.fillStyle(0x000000, 0.28)
    g.fillRoundedRect(-bw / 2 + 3, -42, bw, 84, 18)
    g.fillStyle(COLORS.bgPanel, 0.94)
    g.fillRoundedRect(-bw / 2, -45, bw, 84, 18)
    const accent = parseInt(color.replace('#', ''), 16) || COLORS.gold
    g.lineStyle(3, accent, 0.9)
    g.strokeRoundedRect(-bw / 2, -45, bw, 84, 18)
    g.fillStyle(accent, 0.9)
    g.fillRoundedRect(-bw / 2 + 8, -38, 6, 70, 3)

    const text = this.add.text(10, 0, msg, {
      fontSize: '36px',
      fontFamily: FONT.display,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5)

    banner.add([g, text])

    return new Promise<void>(resolve => {
      this.tweens.add({
        targets: banner,
        y: 118,
        duration: 420,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.time.delayedCall(this.d(700), () => {
            this.tweens.add({
              targets: banner,
              y: -100,
              alpha: 0,
              duration: 320,
              ease: 'Cubic.easeIn',
              onComplete: () => {
                banner.destroy()
                resolve()
              },
            })
          })
        },
      })
    })
  }

  async updateStatus() {
    const p = this.state.players[this.state.currentPlayer]
    
    if (!this.rolling) {
      await this.showAnnouncement(`${p.emoji} ${p.name.toUpperCase()}'S TURN!`, `#${PLAYER_COLORS[this.state.currentPlayer].toString(16).padStart(6, '0')}`)
    }

    const cpuTag = p.isCpu ? ' 🤖' : ''
    const momentum: string[] = []
    if (p.answerStreak >= 2) momentum.push(`🧠x${p.answerStreak}`)
    if (p.speedBoostTurns > 0) momentum.push(`💨x${p.speedBoostTurns}`)
    const momentumTag = momentum.length > 0 ? ` · ${momentum.join(' ')}` : ''
    this.statusText.setText(`${p.emoji} ${p.name}'s Turn${cpuTag}${momentumTag}`)
    this.roundText.setText(`Round ${this.state.round} / ${this.roundsPerGame}`)
    this.hud.update(this.state)

    if (p.isCpu && !this.rolling) {
      ;(this.rollBtn as any).setEnabled?.(false)
      ;(this.itemBtn as any).setEnabled?.(false)
    } else if (!this.rolling) {
      ;(this.rollBtn as any).setEnabled?.(true)
      ;(this.itemBtn as any).setEnabled?.(true)
    }

    this.turnGlowTween?.stop()
    this.turnGlow?.destroy()

    const pos = p.position
    const { x, y } = this.getTileXY(pos)
    
    this.turnGlow = this.add.circle(x, y, TILE_SIZE * 0.7, 0x44ccff, 0.15)
    this.turnGlow.setStrokeStyle(3, 0x44ccff, 0.5)
    this.turnGlow.setDepth(2)
    
    this.turnGlowTween = this.tweens.add({
      targets: this.turnGlow,
      scaleX: 1.3, scaleY: 1.3,
      alpha: 0,
      duration: 1200,
      repeat: -1
    })

    this.maybeScheduleCpuTurn()
  }

  /** @param isCpuInvocation - must be true when the automated CPU triggers the roll */
  async handleRoll(isCpuInvocation = false) {
    if (this.rolling) return
    const cur = this.state.players[this.state.currentPlayer]
    if (cur.isCpu !== isCpuInvocation) return

    // CPU Strategic Item Usage
    if (cur.isCpu && cur.inventory.length > 0) {
      const sorted = [...this.state.players].sort((a, b) => b.score - a.score)
      const rank = sorted.findIndex(p => p.id === cur.id)
      const isLast = rank === this.state.players.length - 1
      const itemToUseIdx = cpuChooseItem(
        cur.inventory, cur.coins, cur.score, cur.position, cur.trophies,
        isLast, rank, cur.cpuLevel
      )

      if (itemToUseIdx >= 0) {
        await this.useItem(this.state.currentPlayer, itemToUseIdx)
        await new Promise(r => this.time.delayedCall(this.d(1400), r))
      }
    }

    this.rolling = true
    this.rollBtn.setAlpha(0.5)
    this.itemBtn.setAlpha(0.5)
    this.closeItemMenu()

    const player = this.state.players[this.state.currentPlayer]

    // Handle forced moves (Golden Key)
    let roll = rollBlockDie()
    if (player.forcedMoveValue > 0) {
      roll = player.forcedMoveValue
      player.forcedMoveValue = 0 // consume
    }

    // Dramatic dice roll animation
    this.time.addEvent({
      delay: isAutoSimMode() ? 12 : 80,
      repeat: 14,
      callback: () => {
        const face = Phaser.Math.Between(1, 6)
        this.diceSprite.setTexture(DICE_TEXTURE_KEYS[face - 1])
        this.diceSprite.setScale(1.2 + Math.random() * 0.3)
        this.diceSprite.setAngle(Math.random() * 20 - 10)
        
        // Rolling Sparks
        if (!isAutoSimMode()) {
          const spark = this.add.particles(this.diceSprite.x, this.diceSprite.y, TEXTURE_KEYS.particleYellow, {
            speed: 100, scale: { start: 0.4, end: 0 }, lifespan: 200, quantity: 1
          })
          this.time.delayedCall(100, () => spark.destroy())
        }

        this.cameras.main.shake(50, 0.003)
      }
    })

    await new Promise<void>(res => this.time.delayedCall(this.d(1300), res))

    let result = rollBlockDie()
    const hadSpeedBoost = player.speedBoostTurns > 0
    const hadDash = player.dashActive
    if (hadDash) {
      const r2 = rollBlockDie()
      result += r2
      player.dashActive = false
    }
    if (hadSpeedBoost) {
      result = Math.min(3, result + 1)
      player.speedBoostTurns = Math.max(0, player.speedBoostTurns - 1)
    }
    this.diceSprite.setTexture(DICE_TEXTURE_KEYS[Math.min(5, result - 1)])
    const surgeText = (hadSpeedBoost ? ' + 💨 Speed Surge' : '') + (hadDash ? ' + 🏃 Dash!' : '')
    this.statusText.setText(`${player.emoji} ${player.name} rolled ${result}${hadDash ? ' (2 dice)' : ' (1-3)'}${surgeText}!`)

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
      const currentNode = this.nodes[player.position]
      const options = currentNode.next
      let chosenNextId: number

      if (options.length > 1) {
        if (player.isCpu) {
          const idx = cpuChooseBranch(player.position, options, TILE_TYPES, player.coins, player.trophies, player.cpuLevel)
          chosenNextId = options[idx]
        } else {
          chosenNextId = await this.promptForBranch(player, options)
        }
      } else {
        chosenNextId = options[0]
      }

      const prev = player.position
      player.position = chosenNextId
      if (prev > 0 && player.position === 0) {
        player.coins += 5
        this.showFloatyText(player, '+5 Lap Coins!', '#ffcc66')
      }
      const {x, y} = this.getTileXY(player.position)
      
      // Move Particles (Dust/Smoke)
      if (!isAutoSimMode()) {
        const dust = this.add.particles(token.x, token.y, TEXTURE_KEYS.particleSquare, {
          speed: 20, scale: { start: 0.4, end: 0 },
          alpha: { start: 0.5, end: 0 },
          lifespan: 300, blendMode: 'ADD', quantity: 1
        })
        this.time.delayedCall(200, () => dust.destroy())
      }

      await new Promise<void>(res => {
        this.tweens.add({
          targets: token,
          x: x + off.x,
          y: y + off.y,
          duration: isAutoSimMode() ? 28 : 180,
          ease: 'Cubic.easeOut',
          onComplete: () => res()
        })
      })
    }

    this.cameras.main.shake(100, 0.005)
    
    // Squash and stretch tile
    const tileImg = this.children.list.find(c => c instanceof Phaser.GameObjects.Image && c.x === token.x - off.x && c.y === token.y - off.y) as Phaser.GameObjects.Image
    if (tileImg) {
      this.tweens.add({
        targets: tileImg,
        scaleX: 1.2, scaleY: 0.8,
        duration: 100, yoyo: true,
        ease: 'Bounce.easeOut'
      })
    }

    this.tweens.add({
      targets: token,
      scaleX: 1.6, scaleY: 0.6,
      duration: isAutoSimMode() ? 16 : 80,
      yoyo: true,
      onComplete: () => {
        token.setScale(1)
        this.landOnTile(playerIndex)
      }
    })
  }

  private async useItem(playerIndex: number, inventoryIndex: number) {
    const player = this.state.players[playerIndex]
    const itemType = player.inventory[inventoryIndex]
    const item = ITEMS[itemType]

    this.statusText.setText(`🎒 ${player.name} used ${item.name}!`)
    this.showFloatyText(player, `Used ${item.emoji}`, '#ffffff')
    player.inventory.splice(inventoryIndex, 1)
    this.closeItemMenu()

    switch (itemType) {
      case 'dash':
        player.dashActive = true
        break
      case 'swap': {
        const others = this.state.players.filter((_, i) => i !== playerIndex)
        const target = Phaser.Utils.Array.GetRandom(others)
        const temp = player.position
        player.position = target.position
        target.position = temp
        this.updatePlayerTokens()
        this.showFloatyText(target, '🔄 SWAPPED!', '#ff88ff')
        break
      }
      case 'warp':
        player.position = Phaser.Math.Between(0, BOARD_NODES.length - 1)
        this.updatePlayerTokens()
        break
      case 'shield':
        player.shieldActive = true
        break
      case 'double_score':
        player.doubleScoreActive = true
        break
      case 'poison_dart': {
        const targetIdx = (playerIndex + 1) % this.state.players.length
        const target = this.state.players[targetIdx]
        target.coins = Math.max(0, target.coins - 8)
        this.showFloatyText(target, '🎯 Poisoned! -8 coins', '#ff4444')
        break
      }
      case 'golden_key':
        player.forcedMoveValue = 5
        this.showFloatyText(player, '🔑 Next roll: 5', '#ffee44')
        break
    }

    await new Promise(r => this.time.delayedCall(this.d(800), r))
  }

  landOnTile(playerIndex: number) {
    const player = this.state.players[playerIndex]
    const tileIndex = player.position
    const type = this.getTileTypeAt(tileIndex)
    const token = this.playerTokens[playerIndex]

    this.statusText.setText(`${player.emoji} ${player.name} landed on ${TILE_LABELS[type]} ${type.toUpperCase()}!`)

    // Landing Shockwave
    const ripple = this.add.circle(token.x, token.y, 10, 0xffffff, 0.4).setDepth(-1)
    this.tweens.add({
      targets: ripple,
      radius: 80, alpha: 0,
      duration: 500,
      onComplete: () => ripple.destroy()
    })
    this.cameras.main.shake(150, 0.002)

    // Check for collision (Battle)
    const otherOnTile = this.state.players.find((p, i) => i !== playerIndex && p.position === tileIndex)
    if (otherOnTile) {
      this.statusText.setText('⚔️ ENCOUNTER!')
      
      const vsContainer = this.add.container(this.scale.width / 2, this.scale.height / 2).setDepth(200)
      const vsBg = this.add.rectangle(0, 0, 1200, 200, 0x000000, 0.7)
      const vsText = this.add.text(0, 0, '⚔️ ENCOUNTER ⚔️', {
        fontSize: '110px', fontFamily: 'Fredoka, Arial Black', color: '#ff4444', stroke: '#ffffff', strokeThickness: 12
      }).setOrigin(0.5)
      
      vsContainer.add([vsBg, vsText])
      vsContainer.setScale(3).setAlpha(0)
      
      this.tweens.add({
        targets: vsContainer,
        scaleX: 1, scaleY: 1, alpha: 1,
        duration: 300,
        ease: 'Expo.easeOut',
        onComplete: () => {
          this.cameras.main.flash(200, 255, 0, 0)
          this.time.delayedCall(600, () => {
            this.tweens.add({ targets: vsContainer, x: -1500, duration: 300, ease: 'Cubic.easeIn', onComplete: () => vsContainer.destroy() })
            this.scene.launch('BattleScene', {
              state: this.state,
              attackerIndex: playerIndex,
              defenderIndex: this.state.players.indexOf(otherOnTile),
              onComplete: (result: BattleResult) => {
                this.scene.stop('BattleScene')
                this.scene.resume()
                
                const attacker = this.state.players[playerIndex]
                const defender = otherOnTile
                
                if (result.winnerIndex === playerIndex) {
                  attacker.score += result.scoreLost
                  attacker.coins += result.coinsLost
                  defender.score = Math.max(0, defender.score - result.scoreLost)
                  defender.coins = Math.max(0, defender.coins - result.coinsLost)
                  this.showFloatyText(attacker, `Win! +${result.scoreLost} pts`, '#44ff88')
                  this.showFloatyText(defender, `Loss! -${result.scoreLost} pts`, '#ff4444')
                  this.showDamageNumber(defender, -result.scoreLost, 'pts')
                  if (result.coinsLost > 0) this.showDamageNumber(defender, -result.coinsLost, '🪙')
                } else {
                  this.showFloatyText(defender, 'Safe!', '#44ccff')
                }

                this.time.delayedCall(this.d(600), () => this.handleTileEffect(playerIndex, type, tileIndex))
              }
            })
            this.scene.pause()
          })
        }
      })
      return
    }

    this.handleTileEffect(playerIndex, type, tileIndex)
  }

  private handleTileEffect(playerIndex: number, type: TileType, tileIndex: number) {
    const player = this.state.players[playerIndex]
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
          this.showImpactText(this.scale.width / 2, this.scale.height / 2, '⭐ NICE! ⭐', '#FFD700')
          this.showFloatyText(player, '⭐ NICE! +5 pts +4 coins!', '#FFD700')
          this.showDamageNumber(player, 5, 'pts')
          this.showDamageNumber(player, 4, '🪙')
          this.cameras.main.flash(400, 255, 215, 0, false)
          this.cameras.main.shake(200, 0.005)
          showConfetti(this)
          this.endTurn()
          break
        case 'penalty':
          if (player.shieldActive) {
            player.shieldActive = false
            this.showFloatyText(player, '🛡️ Shield Block!', '#44ccff')
          } else {
            player.score = Math.max(0, player.score - 4)
            player.coins = Math.max(0, player.coins - 5)
            this.showImpactText(this.scale.width / 2, this.scale.height / 2, '💀 OUCH! 💀', '#ff4444')
            this.showFloatyText(player, '💀 OUCH! -4 pts -5 coins!', '#ff4444')
            this.showDamageNumber(player, -4, 'pts')
            this.showDamageNumber(player, -5, '🪙', true)
            this.cameras.main.flash(400, 200, 0, 0, false)
            this.cameras.main.shake(400, 0.02)
          }
          this.endTurn()
          break
        case 'vocab':
        case 'grammar':
          this.scene.launch('QuestionScene', {
            type,
            playerIndex,
            state: this.state,
            ...(player.isCpu ? { cpuResolve: cpuBoardQuestionResolve(Phaser.Math, player.cpuLevel, this.state.round) } : {}),
            onComplete: (result: QuestionResolution) => {
              this.scene.stop('QuestionScene')
              this.scene.resume()
              if (result.correct) {
                player.answerStreak += 1
                const streakBonusCoins = player.answerStreak % QUESTION_STREAK_THRESHOLD === 0
                  ? QUESTION_STREAK_BONUS_COINS
                  : 0
                const scoreGainRaw = QUESTION_BASE_POINTS + result.timeBonus
                let scoreGain = scoreGainRaw
                if (player.doubleScoreActive) {
                  scoreGain *= 2
                  player.doubleScoreActive = false
                }
                const coinGain = QUESTION_BASE_COINS + Math.floor(result.timeBonus / 2) + streakBonusCoins
                player.score += scoreGain
                player.coins += coinGain
                if (result.speedSurge) {
                  player.speedBoostTurns += 1
                }

                const parts = [`+${scoreGain} pts +${coinGain} coins!`]
                if (scoreGain > scoreGainRaw) parts.push('📈 Double!')
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
        case 'item_shop':
          this.handleItemShop(player)
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
      fontFamily: 'Fredoka, Arial Black',
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

  private _shakeTokenContainer: Phaser.GameObjects.Container | null = null

  showDamageNumber(player: Player, amount: number, label: string = '', noShake = false) {
    const playerIndex = this.state.players.indexOf(player)
    const tokenPos = this.playerTokens[playerIndex]
    const icon = label || (amount > 0 ? '+' : '')
    const txt = this.add.text(tokenPos.x, tokenPos.y - 40, `${icon}${amount}`, {
      fontSize: '56px',
      fontFamily: 'Fredoka, Arial Black',
      color: amount > 0 ? '#44ff88' : '#ff4444',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(25).setScale(0)

    this.tweens.add({
      targets: txt,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: txt,
          y: tokenPos.y - 120,
          alpha: 0,
          duration: 800,
          delay: 300,
          onComplete: () => txt.destroy()
        })
      }
    })

    // Only shake once per batch (same container) — prevents double-shake conflict
    if (amount < 0 && !noShake && this._shakeTokenContainer !== tokenPos) {
      this._shakeTokenContainer = tokenPos
      this.tweens.add({
        targets: tokenPos,
        x: tokenPos.x + 4,
        duration: 40,
        yoyo: true,
        repeat: 3,
        onComplete: () => { this._shakeTokenContainer = null }
      })
    }
  }

  handleShop(player: Player, playerIndex: number, tileIndex: number) {
    const ownerId = this.shopOwners[tileIndex]

    if (ownerId === undefined) {
      if (player.isCpu && !cpuShouldBuyShop(player.coins, player.cpuLevel)) {
        this.statusText.setText(`🏪 ${player.name} passes on this shop.`)
        this.showFloatyText(player, 'Saving coins…', '#aaaaaa')
        this.time.delayedCall(this.d(1200), () => this.endTurn())
        return
      }
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

    if (player.shieldActive) {
      player.shieldActive = false
      this.statusText.setText(`🏪 Shielded from rent!`)
      this.showFloatyText(player, '🛡️ Shielded!', '#44ccff')
      this.time.delayedCall(this.d(1200), () => this.endTurn())
      return
    }

    const pay = Math.min(player.coins, rent)
    player.coins -= pay
    owner.coins += pay
    this.statusText.setText(`🏪 Rent to ${owner.name}! (${owned} shops)`)
    this.showFloatyText(player, `-${pay} rent`, '#ff8888')
    this.showFloatyText(owner, `+${pay} rent!`, '#88ff88')
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  handleStarShop(player: Player) {
    if (player.isCpu && !cpuShouldBuyStar(player.coins, player.trophies, player.cpuLevel)) {
      this.statusText.setText(`🌟 ${player.name} saves coins for later.`)
      this.showFloatyText(player, 'Saving up…', '#aaccff')
      this.time.delayedCall(this.d(1200), () => this.endTurn())
      return
    }
    if (player.coins >= STAR_COST_COINS) {
      player.coins -= STAR_COST_COINS
      player.trophies += 1
      player.score += 12
      this.statusText.setText(`🌟 ${player.name} got a Star Trophy!`)
      this.showFloatyText(player, 'Star Trophy! +12 pts', '#ffee44')
      this.showDamageNumber(player, 12, 'pts')
      this.starPurchaseSplash(player)
    } else {
      player.coins += 2
      this.statusText.setText(`🌟 Save up! Stars cost ${STAR_COST_COINS} coins.`)
      this.showFloatyText(player, '+2 pity coins', '#aaccff')
    }
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  private starPurchaseSplash(player: Player) {
    const w = this.scale.width
    const h = this.scale.height
    const container = this.add.container(w / 2, h / 2).setDepth(300)

    const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.4).setAlpha(0)
    const star = this.add.text(0, -60, '⭐', { fontSize: '120px' }).setOrigin(0.5).setScale(0)
    const title = this.add.text(0, 60, 'STAR!', {
      fontSize: '72px', fontFamily: 'Fredoka, Arial Black', color: '#FFD700',
      stroke: '#884400', strokeThickness: 8
    }).setOrigin(0.5).setScale(0).setAlpha(0)

    const name = this.add.text(0, 120, `${player.emoji} ${player.name}`, {
      fontSize: '28px', fontFamily: 'Fredoka, Arial Black', color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0)

    container.add([overlay, star, title, name])
    this.tweens.add({ targets: overlay, alpha: 1, duration: 150 })
    this.tweens.add({ targets: star, scaleX: 1, scaleY: 1, duration: 500, ease: 'Back.easeOut' })
    this.tweens.add({
      targets: star, angle: 360, duration: 800, ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: star, scaleX: 1.3, scaleY: 1.3, duration: 300, yoyo: true })
      }
    })
    this.tweens.add({ targets: title, scaleX: 1, scaleY: 1, alpha: 1, duration: 400, delay: 400, ease: 'Back.easeOut' })
    this.tweens.add({ targets: name, alpha: 1, duration: 300, delay: 700 })
    this.cameras.main.flash(500, 255, 215, 0, true)
    this.cameras.main.shake(300, 0.008)

    // Golden sparkle burst
    if (!isAutoSimMode()) {
      for (let i = 0; i < 20; i++) {
        this.time.delayedCall(i * 60, () => {
          const spark = this.add.text(
            Phaser.Math.Between(100, w - 100),
            Phaser.Math.Between(100, h - 100),
            Phaser.Utils.Array.GetRandom(['✨', '⭐', '🌟']),
            { fontSize: `${Phaser.Math.Between(18, 32)}px` }
          ).setOrigin(0.5).setDepth(301).setAlpha(0)
          this.tweens.add({
            targets: spark, alpha: 1, y: spark.y - 60, scale: { from: 0.3, to: 1.2 },
            duration: 600, ease: 'Cubic.easeOut',
            onComplete: () => this.tweens.add({
              targets: spark, alpha: 0, y: spark.y - 40, duration: 300,
              onComplete: () => spark.destroy()
            })
          })
        })
      }
    }

    this.time.delayedCall(this.d(2000), () => {
      this.tweens.add({
        targets: container, alpha: 0, duration: 300,
        onComplete: () => container.destroy(true)
      })
    })
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
      this.showDamageNumber(player, BUILD_BONUS_SCORE, 'pts')
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
          if (player.shieldActive) {
            player.shieldActive = false
            return '🛡️ Shielded from the penalty!'
          }
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

  async handleSwap(player: Player, playerIndex: number) {
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
    
    await new Promise(r => this.time.delayedCall(swapDur + 200, r))
    this.landOnTile(playerIndex)
  }

  endTurn() {
    this.scene.resume()
    this.rolling = false
    this.rollBtn.setAlpha(1)

    this.state.turn++
    const totalTurns = this.state.players.length * this.roundsPerGame
    const normaWinner = this.state.players.find(p => p.trophies >= 5)
    
    if (normaWinner || this.state.turn >= totalTurns) {
      this.time.delayedCall(this.d(500), () => {
        this.scene.start('ResultsScene', { state: this.state })
      })
      return
    }

    this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length
    if (this.state.currentPlayer === 0) {
      this.state.round++
      const roundsLeft = this.roundsPerGame - this.state.round
      if (roundsLeft <= 5 && roundsLeft > 0 && !isAutoSimMode()) {
        const warning = roundsLeft === 1 ? '⚠️ FINAL ROUND! ⚠️' : `⚠️ ${roundsLeft} ROUNDS LEFT! ⚠️`
        this.cameras.main.shake(300, 0.008)
        this.cameras.main.flash(400, 255, 100, 0, true)
        this.showAnnouncement(warning, '#ff8800')
      }
    }
    this.updateStatus()
  }

  handleItemShop(player: Player) {
    const available = Object.values(ITEMS)
    let item
    if (player.isCpu) {
      // CPU picks preferred item they can afford
      const prefOrder = cpuPolicyForLevel(player.cpuLevel).preferredItems
      item = prefOrder.map(t => available.find(a => a.type === t)).find(a => a && player.coins >= a.cost)
        ?? available.find(a => player.coins >= a.cost)
        ?? Phaser.Utils.Array.GetRandom(available)
    } else {
      item = Phaser.Utils.Array.GetRandom(available)
    }
    if (player.coins >= item.cost) {
      player.coins -= item.cost
      player.inventory.push(item.type)
      this.statusText.setText(`🛍️ ${player.name} bought ${item.name}!`)
      this.showFloatyText(player, `-${item.cost} 🪙 · ${item.emoji} ${item.name}`, '#44ccff')
    } else {
      player.coins += 1
      this.statusText.setText(`🛍️ Need more coins! ${item.name} costs ${item.cost}.`)
      this.showFloatyText(player, '+1 pity coin', '#aaccff')
    }
    this.time.delayedCall(this.d(1200), () => this.endTurn())
  }

  private toggleItemMenu() {
    if (this.rolling) return
    if (this.itemMenu) {
      this.closeItemMenu()
    } else {
      this.openItemMenu()
    }
  }

  private openItemMenu() {
    const player = this.state.players[this.state.currentPlayer]
    if (player.isCpu) return
    if (player.inventory.length === 0) {
      this.statusText.setText('🎒 Your backpack is empty!')
      return
    }

    const w = this.scale.width
    const h = this.scale.height
    this.itemMenu = this.add.container(w / 2, h / 2).setDepth(100)
    
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.bgPanel, 0.96)
    bg.fillRoundedRect(-200, -150, 400, 300, 16)
    bg.lineStyle(2.5, COLORS.teal, 0.6)
    bg.strokeRoundedRect(-200, -150, 400, 300, 16)
    const title = this.add.text(0, -120, 'YOUR ITEMS', {
      fontSize: '24px', fontFamily: FONT.display, color: hexColor(COLORS.teal), stroke: '#003322', strokeThickness: 3,
    }).setOrigin(0.5)
    this.itemMenu.add([bg, title])

    player.inventory.forEach((type, i) => {
      const item = ITEMS[type]
      const btn = createButton(this, 0, -60 + i * 50, `${item.emoji} ${item.name}`, COLORS.bgPanelAlt, 0x223048, 340, 40)
      btn.on('pointerdown', () => this.useItem(this.state.currentPlayer, i))
      this.itemMenu?.add(btn)
    })

    const closeBtn = createButton(this, 0, 110, 'CLOSE', COLORS.mute, 0x4a5a6e, 120, 40)
    closeBtn.on('pointerdown', () => this.closeItemMenu())
    this.itemMenu.add(closeBtn)
  }

  private closeItemMenu() {
    this.itemMenu?.destroy()
    this.itemMenu = undefined
  }

  private async promptForBranch(player: Player, options: number[]): Promise<number> {
    this.statusText.setText('🗺️ Choose your path!')
    return new Promise<number>(resolve => {
      const overlays: Phaser.GameObjects.GameObject[] = []
      options.forEach(nodeId => {
        const { x, y } = this.getTileXY(nodeId)
        const highlight = this.add.circle(x, y, TILE_SIZE * 0.5, 0x44ccff, 0.4).setDepth(20).setInteractive({ useHandCursor: true })
        const arrow = this.add.text(x, y, '➤', { fontSize: '42px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(21)
        
        const cur = this.nodes[player.position]
        const targetNode = this.nodes[nodeId]
        const angle = Phaser.Math.Angle.Between(cur.col, cur.row, targetNode.col, targetNode.row)
        arrow.setRotation(angle)

        this.tweens.add({
          targets: [highlight, arrow],
          scaleX: 1.2, scaleY: 1.2,
          duration: 400,
          yoyo: true,
          repeat: -1
        })

        highlight.on('pointerdown', () => {
          overlays.forEach(o => o.destroy())
          resolve(nodeId)
        })
        overlays.push(highlight, arrow)
      })
    })
  }

  private createPauseButton() {
    const btn = createButton(this, 50, 50, 'II', COLORS.bgPanelAlt, 0x223048, 56, 56)
    btn.setDepth(DEPTH.hud)
    btn.on('pointerdown', () => this.pauseGame())
  }

  private pauseGame() {
    if (this.scene.isActive('PauseScene')) return
    this.scene.pause()
    this.scene.launch('PauseScene')
  }

  private updatePlayerTokens() {
    this.state.players.forEach((player, i) => {
      const token = this.playerTokens[i]
      const { x, y } = this.getTileXY(player.position)
      const off = this.getPlayerOffset(i)
      this.tweens.add({
        targets: token,
        x: x + off.x,
        y: y + off.y,
        duration: 600,
        ease: 'Cubic.easeInOut'
      })
    })
  }

  private getPlayerOffset(index: number) {
    const offsets = [{x:-10,y:-10},{x:10,y:-10},{x:-10,y:10},{x:10,y:10}]
    return offsets[index % 4]
  }
}
