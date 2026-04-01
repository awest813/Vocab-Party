import Phaser from 'phaser'
import { GameState } from '../systems/GameState'

const PLAYER_COLORS = ['#ff6666', '#6688ff', '#66dd66', '#ffdd44']

export class PlayerHUD {
  private scene: Phaser.Scene
  private containers: Phaser.GameObjects.Container[] = []
  private activeTweenTarget: number = -1

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene
    this.build(state)
  }

  build(state: GameState) {
    const w = this.scene.scale.width
    const panelW = 200
    const panelH = 80
    const startX = (w - state.players.length * (panelW + 10)) / 2 + panelW / 2

    state.players.forEach((player, i) => {
      const x = startX + i * (panelW + 10)
      const y = 46
      const container = this.scene.add.container(x, y)

      const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x222244)
      bg.setStrokeStyle(3, parseInt(PLAYER_COLORS[i].replace('#', ''), 16))

      const nameText = this.scene.add.text(-panelW / 2 + 8, -22, `${player.emoji} ${player.name}`, {
        fontSize: '16px',
        fontFamily: 'Arial Black',
        color: PLAYER_COLORS[i]
      })

      const scoreText = this.scene.add.text(-panelW / 2 + 8, 4, `⭐ ${player.score} pts`, {
        fontSize: '18px',
        fontFamily: 'Arial Black',
        color: '#FFD700'
      })

      container.add([bg, nameText, scoreText])
      container.setDepth(5)
      this.containers.push(container)
    })
  }

  update(state: GameState) {
    const w = this.scene.scale.width
    const panelW = 200
    const startX = (w - state.players.length * (panelW + 10)) / 2 + panelW / 2

    state.players.forEach((player, i) => {
      const container = this.containers[i]
      if (!container) return
      const x = startX + i * (panelW + 10)
      container.setX(x)
      const scoreText = container.getAt(2) as Phaser.GameObjects.Text
      if (scoreText) scoreText.setText(`⭐ ${player.score} pts`)

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
