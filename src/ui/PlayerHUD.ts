import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { characterDef } from '../systems/SpriteFactory'
import { COLORS, DEPTH, FONT, hexColor } from './Theme'

const RANK_LABEL = ['1st', '2nd', '3rd', '4th']

export class PlayerHUD {
  private scene: Phaser.Scene
  private containers: Phaser.GameObjects.Container[] = []
  private scoreTexts: Phaser.GameObjects.Text[] = []
  private metaTexts: Phaser.GameObjects.Text[] = []
  private rankTexts: Phaser.GameObjects.Text[] = []
  private frames: Phaser.GameObjects.Graphics[] = []
  private statusGroups: Phaser.GameObjects.Container[] = []
  private lastScores: number[] = []
  private lastActiveScale: number[] = []

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene
    this.build(state)
  }

  build(state: GameState) {
    const w = this.scene.scale.width
    const panelW = 228
    const panelH = 92
    const gap = 12
    const startX = (w - state.players.length * (panelW + gap) + gap) / 2 + panelW / 2

    state.players.forEach((player, i) => {
      const x = startX + i * (panelW + gap)
      const y = 52
      const container = this.scene.add.container(x, y)
      const accent = characterDef(player.characterIndex).color

      const frame = this.scene.add.graphics()
      this.paintFrame(frame, panelW, panelH, accent, false)
      this.frames.push(frame)

      const nameText = this.scene.add.text(-panelW / 2 + 12, -30, `${player.emoji} ${player.name}`, {
        fontSize: '17px',
        fontFamily: FONT.display,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })

      const children: Phaser.GameObjects.GameObject[] = [frame, nameText]

      if (player.isCpu) {
        const lvl = player.cpuLevel === 'hard' ? 'H' : player.cpuLevel === 'easy' ? 'E' : 'N'
        children.push(
          this.scene.add.text(panelW / 2 - 12, -30, `CPU·${lvl}`, {
            fontSize: '11px',
            fontFamily: FONT.display,
            color: player.cpuLevel === 'hard' ? '#ffb4a2' : player.cpuLevel === 'easy' ? '#b8f0c8' : '#9ad4ff',
            stroke: '#001830',
            strokeThickness: 2,
          }).setOrigin(1, 0)
        )
      }

      const scoreText = this.scene.add.text(-panelW / 2 + 12, 0, `${player.score} pts`, {
        fontSize: '22px',
        fontFamily: FONT.display,
        color: hexColor(COLORS.gold),
        stroke: '#3a2800',
        strokeThickness: 3,
      }).setOrigin(0, 0.5)
      this.lastScores[i] = player.score

      const metaText = this.scene.add.text(-panelW / 2 + 12, 28, '', {
        fontSize: '14px',
        fontFamily: FONT.display,
        color: '#c5d8ec',
      }).setOrigin(0, 0.5)

      const rankText = this.scene.add.text(panelW / 2 - 10, -panelH / 2 + 8, '', {
        fontSize: '13px',
        fontFamily: FONT.display,
        color: '#ffffff',
        align: 'right',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(1, 0)

      const statusGroup = this.scene.add.container(panelW / 2 - 10, panelH / 2 - 14)
      this.statusGroups.push(statusGroup)

      children.push(scoreText, metaText, rankText, statusGroup)
      container.add(children)
      container.setDepth(DEPTH.hud)
      this.containers.push(container)
      this.scoreTexts.push(scoreText)
      this.metaTexts.push(metaText)
      this.rankTexts.push(rankText)
    })
  }

  private paintFrame(
    g: Phaser.GameObjects.Graphics,
    panelW: number,
    panelH: number,
    accent: number,
    active: boolean
  ) {
    g.clear()
    const r = 12
    g.fillStyle(0x000000, 0.35)
    g.fillRoundedRect(-panelW / 2 + 2, -panelH / 2 + 4, panelW, panelH, r)

    g.fillStyle(COLORS.bgPanel, active ? 0.95 : 0.82)
    g.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, r)

    g.fillStyle(accent, active ? 1 : 0.85)
    g.fillRoundedRect(-panelW / 2 + 2, -panelH / 2 + 2, panelW - 4, 5, {
      tl: 8, tr: 8, bl: 0, br: 0,
    })

    g.lineStyle(2.5, accent, active ? 0.95 : 0.45)
    g.strokeRoundedRect(-panelW / 2 + 1, -panelH / 2 + 1, panelW - 2, panelH - 2, r)

    if (active) {
      g.lineStyle(1.5, 0xffffff, 0.25)
      g.strokeRoundedRect(-panelW / 2 + 4, -panelH / 2 + 4, panelW - 8, panelH - 8, r - 2)
    }
  }

  update(state: GameState) {
    const panelW = 228
    const panelH = 92

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
      const accent = characterDef(player.characterIndex).color
      this.paintFrame(this.frames[i], panelW, panelH, accent, isActive)

      const targetScale = isActive ? 1.06 : 1.0
      const targetAlpha = isActive ? 1 : 0.78

      if (this.lastActiveScale[i] !== targetScale) {
        this.lastActiveScale[i] = targetScale
        this.scene.tweens.killTweensOf(container)
        this.scene.tweens.add({
          targets: container,
          scaleX: targetScale,
          scaleY: targetScale,
          alpha: targetAlpha,
          duration: 200,
          ease: 'Back.easeOut',
        })
      }

      const scoreText = this.scoreTexts[i]
      if (scoreText && this.lastScores[i] !== player.score) {
        scoreText.setText(`${player.score} pts`)
        this.scene.tweens.add({
          targets: scoreText,
          scaleX: 1.18, scaleY: 1.18,
          duration: 140, yoyo: true,
        })
        this.lastScores[i] = player.score
      }

      const inventory = player.inventory.map(t => {
        switch (t) {
          case 'dash': return '🏃'
          case 'swap': return '🔄'
          case 'warp': return '🌀'
          case 'shield': return '🛡️'
          case 'double_score': return '📈'
          case 'poison_dart': return '🎯'
          case 'golden_key': return '🔑'
          default: return ''
        }
      }).join('')

      const metaText = this.metaTexts[i]
      if (metaText) {
        metaText.setText(`🪙 ${player.coins}   🌟 ${player.trophies}${inventory ? '   ' + inventory : ''}`)
      }

      const rankText = this.rankTexts[i]
      if (rankText) {
        const rank = rankById.get(player.id) || 1
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '•'
        rankText.setText(`${medal} ${RANK_LABEL[rank - 1] ?? `#${rank}`}`)
        rankText.setColor(rank === 1 ? hexColor(COLORS.gold) : '#ffffff')
      }

      const status = this.statusGroups[i]
      if (status) {
        status.removeAll(true)
        let sx = 0
        if (player.shieldActive) {
          status.add(this.scene.add.text(sx, 0, '🛡️', { fontSize: '14px' }).setOrigin(1, 0.5))
          sx -= 18
        }
        if (player.doubleScoreActive) {
          status.add(this.scene.add.text(sx, 0, '📈', { fontSize: '14px' }).setOrigin(1, 0.5))
          sx -= 18
        }
        if (player.dashActive) {
          status.add(this.scene.add.text(sx, 0, '🏃', { fontSize: '14px' }).setOrigin(1, 0.5))
        }
      }
    })
  }
}
