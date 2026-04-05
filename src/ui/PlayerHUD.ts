import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { CPU_LEVEL_LABEL } from '../systems/CpuPolicy'
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
      const y = 46
      const container = this.scene.add.container(x, y)

      const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x222244)
      bg.setStrokeStyle(3, parseInt(PLAYER_COLORS[i].replace('#', ''), 16))

      const nameLine = player.isCpu
        ? `${player.emoji} ${player.name} 🤖 ${CPU_LEVEL_LABEL[player.cpuLevel]}`
        : `${player.emoji} ${player.name}`
      const nameText = this.scene.add.text(-panelW / 2 + 8, -22, nameLine, {
        fontSize: '16px',
        fontFamily: 'Arial Black',
        color: PLAYER_COLORS[i]
      })

      const scoreLeft = -panelW / 2 + 8
      const parts: Phaser.GameObjects.GameObject[] = [bg, nameText]
      let scoreX = scoreLeft
      if (this.scene.textures.exists(TEXTURE_KEYS.gem)) {
        const gem = this.scene.add.image(scoreLeft + 11, 4, TEXTURE_KEYS.gem).setDisplaySize(22, 22).setOrigin(0.5, 0.5)
        parts.push(gem)
        scoreX = scoreLeft + 26
      }
      const scoreText = this.scene.add.text(scoreX, -2, `${player.score} pts`, {
        fontSize: '17px',
        fontFamily: 'Arial Black',
        color: '#FFD700'
      }).setOrigin(0, 0.5)
      parts.push(scoreText)
      this.lastScores[i] = player.score

      const metaText = this.scene.add.text(scoreLeft + 4, 22, `🪙${player.coins}  🌟${player.trophies}  🧱${player.bricksCollected}`, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#ccddee'
      }).setOrigin(0, 0.5)
      parts.push(metaText)

      const rankText = this.scene.add.text(panelW / 2 - 8, -panelH / 2 + 7, '', {
        fontSize: '13px',
        fontFamily: 'Arial Black',
        color: '#ddeeff'
      }).setOrigin(1, 0)
      parts.push(rankText)

      container.add(parts)
      container.setDepth(5)
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
    const sortedIds = [...state.players]
      .sort((a, b) => {
        if (b.trophies !== a.trophies) return b.trophies - a.trophies
        if (b.score !== a.score) return b.score - a.score
        return b.coins - a.coins
      })
      .map(p => p.id)
    const rankById = new Map<number, number>()
    sortedIds.forEach((id, idx) => rankById.set(id, idx + 1))

    state.players.forEach((player, i) => {
      const container = this.containers[i]
      if (!container) return
      const x = startX + i * (panelW + 10)
      container.setX(x)
      const scoreText = this.scoreTexts[i]
      if (scoreText) {
        scoreText.setText(`${player.score} pts`)
        if (this.lastScores[i] !== player.score) {
          this.scene.tweens.add({
            targets: scoreText,
            scaleX: 1.16,
            scaleY: 1.16,
            duration: 130,
            yoyo: true
          })
          this.lastScores[i] = player.score
        }
      }
      const momentum: string[] = []
      if (player.answerStreak >= 2) momentum.push(`🧠x${player.answerStreak}`)
      if (player.speedBoostTurns > 0) momentum.push(`💨x${player.speedBoostTurns}`)
      const metaText = this.metaTexts[i]
      if (metaText) {
        const suffix = momentum.length > 0 ? `  ${momentum.join(' ')}` : ''
        metaText.setText(`🪙${player.coins}  🌟${player.trophies}  🧱${player.bricksCollected}${suffix}`)
      }

      const rankText = this.rankTexts[i]
      const rank = rankById.get(player.id) ?? state.players.length
      const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏁'
      if (rankText) {
        rankText.setText(`${rankBadge} #${rank}`)
      }

      // Highlight current player
      const bg = container.getAt(0) as Phaser.GameObjects.Rectangle
      const isActive = i === state.currentPlayer
      bg.setFillStyle(isActive ? 0x443388 : 0x222244)
      if (isActive && this.activeTweenTarget !== i) {
        this.activeTweenTarget = i
        this.scene.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 200, yoyo: true })
      }
    })
  }
}
