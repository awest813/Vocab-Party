import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

const PLAYER_COLORS = ['#ff6666', '#6688ff', '#66dd66', '#ffdd44']

export class PlayerHUD {
  private scene: Phaser.Scene
  private containers: Phaser.GameObjects.Container[] = []
  private scoreTexts: Phaser.GameObjects.Text[] = []
  private metaTexts: Phaser.GameObjects.Text[] = []
  private rankTexts: Phaser.GameObjects.Text[] = []
  private lastScores: number[] = []
  private activeTweenTarget: number = -1

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene
    this.build(state)
  }

  build(state: GameState) {
    const w = this.scene.scale.width
    const panelW = 212
    const panelH = 96
    const startX = (w - state.players.length * (panelW + 10)) / 2 + panelW / 2

    state.players.forEach((player, i) => {
      const x = startX + i * (panelW + 10)
      const y = 50
      const container = this.scene.add.container(x, y)

      // Glassmorphic panel
      const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x0d0d1f, 0.75)
      bg.setStrokeStyle(3, parseInt(PLAYER_COLORS[i].replace('#', ''), 16), 0.6)
      
      // Top bar color
      const topBar = this.scene.add.rectangle(0, -panelH/2 + 2, panelW - 4, 4, parseInt(PLAYER_COLORS[i].replace('#', ''), 16))
      topBar.setOrigin(0.5, 0)

      const nameLine = player.isCpu
        ? `${player.emoji} ${player.name} 🤖`
        : `${player.emoji} ${player.name}`
      const nameText = this.scene.add.text(-panelW / 2 + 10, -32, nameLine, {
        fontSize: '18px',
        fontFamily: 'Fredoka, Arial Black',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      })

      const scoreText = this.scene.add.text(-panelW / 2 + 10, -4, `${player.score} pts`, {
        fontSize: '20px',
        fontFamily: 'Fredoka, Arial Black',
        color: '#FFD700'
      }).setOrigin(0, 0.5)
      this.lastScores[i] = player.score

      const metaText = this.scene.add.text(-panelW / 2 + 10, 24, `🪙${player.coins}  🌟${player.trophies}`, {
        fontSize: '14px',
        fontFamily: 'Fredoka, Arial Black',
        color: '#ccddee'
      }).setOrigin(0, 0.5)

      const rankText = this.scene.add.text(panelW / 2 - 10, -panelH / 2 + 10, '', {
        fontSize: '12px',
        fontFamily: 'Fredoka, Arial Black',
        color: '#ffffff',
        align: 'right'
      }).setOrigin(1, 0)

      const statusGroup = this.scene.add.container(panelW / 2 - 10, panelH / 2 - 12)

      container.add([bg, topBar, nameText, scoreText, metaText, rankText, statusGroup])
      container.setDepth(10)
      this.containers.push(container)
      this.scoreTexts.push(scoreText)
      this.metaTexts.push(metaText)
      this.rankTexts.push(rankText)
    })
  }

  update(state: GameState) {
    const w = this.scene.scale.width
    const panelW = 212
    const startX = (w - state.players.length * (panelW + 10)) / 2 + panelW / 2
    
    const sorted = [...state.players].sort((a, b) => {
      if (b.trophies !== a.trophies) return b.trophies - a.trophies
      return b.score - a.score
    })
    const rankById = new Map<number, number>()
    sorted.forEach((p, idx) => rankById.set(p.id, idx + 1))

    state.players.forEach((player, i) => {
      const container = this.containers[i]
      if (!container) return
      
      const isActive = i === state.currentPlayer
      const targetScale = isActive ? 1.08 : 1.0
      const targetAlpha = isActive ? 1 : 0.7
      
      if (container.scaleX !== targetScale) {
        this.scene.tweens.add({
          targets: container,
          scaleX: targetScale,
          scaleY: targetScale,
          alpha: targetAlpha,
          duration: 200,
          ease: 'Back.easeOut'
        })
      }

      const scoreText = this.scoreTexts[i]
      if (scoreText && this.lastScores[i] !== player.score) {
        scoreText.setText(`${player.score} pts`)
        this.scene.tweens.add({ targets: scoreText, scaleX: 1.2, scaleY: 1.2, duration: 150, yoyo: true })
        this.lastScores[i] = player.score
      }

      const inventory = player.inventory.map(t => {
        switch(t) {
          case 'dash': return '🏃';
          case 'swap': return '🔄';
          case 'warp': return '🌀';
          case 'shield': return '🛡️';
          case 'double_score': return '📈';
          case 'poison_dart': return '🎯';
          case 'golden_key': return '🔑';
          default: return '';
        }
      }).join('')
      
      const metaText = this.metaTexts[i]
      if (metaText) {
        metaText.setText(`🪙${player.coins}  🌟${player.trophies}  ${inventory}`)
      }

      const rankText = this.rankTexts[i]
      if (rankText) {
        const rank = rankById.get(player.id) || 1
        const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🚩'
        rankText.setText(`${rankBadge} #${rank}`)
      }

      // Status Icons
      const statusGroup = container.getAt(6) as Phaser.GameObjects.Container
      statusGroup.removeAll(true)
      let sx = 0
      if (player.shieldActive) {
        statusGroup.add(this.scene.add.text(sx, 0, '🛡️', { fontSize: '14px' }).setOrigin(1, 0.5))
        sx -= 20
      }
      if (player.doubleScoreActive) {
        statusGroup.add(this.scene.add.text(sx, 0, '📈', { fontSize: '14px' }).setOrigin(1, 0.5))
        sx -= 20
      }
      if (player.dashActive) {
        statusGroup.add(this.scene.add.text(sx, 0, '🏃', { fontSize: '14px' }).setOrigin(1, 0.5))
        sx -= 20
      }
    })
  }
}
