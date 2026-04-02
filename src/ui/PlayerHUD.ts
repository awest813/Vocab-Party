import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'

const PLAYER_COLORS = ['#ff6666', '#6688ff', '#66dd66', '#ffdd44']

export class PlayerHUD {
  private scene: Phaser.Scene
  private containers: Phaser.GameObjects.Container[] = []
  private scoreTexts: Phaser.GameObjects.Text[] = []
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

      const nameText = this.scene.add.text(-panelW / 2 + 8, -22, `${player.emoji} ${player.name}`, {
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

      const metaText = this.scene.add.text(scoreLeft + 4, 22, `🪙${player.coins}  🌟${player.trophies}  🧱${player.bricksCollected}`, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#ccddee'
      }).setOrigin(0, 0.5)
      parts.push(metaText)

      container.add(parts)
      container.setDepth(5)
      this.containers.push(container)
      this.scoreTexts.push(scoreText)
    })
  }

  update(state: GameState) {
    const w = this.scene.scale.width
    const panelW = 212
    const startX = (w - state.players.length * (panelW + 10)) / 2 + panelW / 2

    state.players.forEach((player, i) => {
      const container = this.containers[i]
      if (!container) return
      const x = startX + i * (panelW + 10)
      container.setX(x)
      const scoreText = this.scoreTexts[i]
      if (scoreText) scoreText.setText(`${player.score} pts`)
      const metaText = container.getAt(container.length - 1) as Phaser.GameObjects.Text
      if (metaText && metaText.setText) {
        metaText.setText(`🪙${player.coins}  🌟${player.trophies}  🧱${player.bricksCollected}`)
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
