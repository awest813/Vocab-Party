import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { paintStage } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { characterDef, characterTextureKey } from '../systems/SpriteFactory'
import { Sfx } from '../systems/Sfx'
import { getProgress, recordGame } from '../systems/Progress'
import { rewardParty } from '../systems/Unlocks'
import { unlock } from '../systems/Achievements'
import { getBoard } from '../systems/BoardLayout'
import { getSettings } from '../systems/GameSettings'

export class ResultsScene extends Phaser.Scene {
  constructor() { super('ResultsScene') }

  private d(ms: number) {
    return scaleAutoSimDelay(ms)
  }

  create(data: { state: GameState }) {
    const { state } = data
    this.studySheet = undefined
    const w = this.scale.width
    const h = this.scale.height

    paintStage(this, { topColor: COLORS.bgDeep, bottomColor: 0x152038 })
    addStarfieldBackdrop(this, 0.4)
    addAmbientMotes(this, 32)
    Sfx.startMusic('results')

    // Soft gold stage light
    const beams = this.add.graphics().setDepth(-1)
    beams.fillStyle(COLORS.gold, 0.08)
    beams.fillTriangle(w / 2, -40, -40, h, w + 40, h)

    const sorted = [...state.players].sort((a, b) => {
      if (b.trophies !== a.trophies) return b.trophies - a.trophies
      return b.score - a.score
    })

    if (!isAutoSimMode() && state.players.some(p => !p.isCpu)) {
      const humanWon = !sorted[0].isCpu
      const boardId = getBoard(state.options?.board).id
      recordGame(humanWon, boardId)
      rewardParty({
        bestHumanTrophies: Math.max(0, ...state.players.filter(p => !p.isCpu).map(p => p.trophies)),
        humanWon,
        rounds: state.round,
      })
      // Record immediately (leaving Results quickly must not lose them); toasts are DOM overlays.
      {
        unlock('first_party')
        if (humanWon) unlock('first_win')
        if ((getProgress().boardsWon ?? []).length >= 3) unlock('all_boards')
        if ((state.roundsPerGame ?? 0) >= getBoard(boardId).nodes.length) unlock('full_map')
        if (humanWon && getSettings().wordLevel === 'challenge') unlock('challenge_win')
        const awards = state.bonusAwards ?? []
        if (awards.length === 3 && state.players.some(p => !p.isCpu && awards.every(a => a.winners.includes(p.id)))) unlock('bonus_sweep')
        const prog = getProgress()
        if (prog.gamesPlayed >= 10) unlock('parties_10')
        if (prog.gamesWon >= 5) unlock('wins_5')
        const cpus = state.players.filter(p => p.isCpu)
        if (humanWon && cpus.length >= 3 && cpus.every(p => p.cpuLevel === 'hard')) unlock('hard_win')
      }
    }

    if (typeof window !== 'undefined') {
      const w = window as unknown as {
        __VOCAB_PARTY_RESULTS_READY__?: boolean
        __VOCAB_PARTY_WINNER__?: { name: string; score: number; trophies: number; players: number }
      }
      w.__VOCAB_PARTY_RESULTS_READY__ = true
      w.__VOCAB_PARTY_WINNER__ = {
        name: sorted[0]?.name ?? '?',
        score: sorted[0]?.score ?? 0,
        trophies: sorted[0]?.trophies ?? 0,
        players: state.players.length,
      }
    }

    const titleRow = this.add.container(w / 2, 48)
    if (this.textures.exists(TEXTURE_KEYS.kenneyTrophy)) {
      titleRow.add([
        this.add.image(-210, 0, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(40, 40),
        this.add.image(210, 0, TEXTURE_KEYS.kenneyTrophy).setDisplaySize(40, 40),
      ])
    }
    titleRow.add(
      this.add.text(0, 0, 'FINAL RESULTS', {
        fontSize: '48px',
        fontFamily: FONT.display,
        color: hexColor(COLORS.gold),
        stroke: hexColor(COLORS.goldDeep),
        strokeThickness: 8,
      }).setOrigin(0.5)
    )
    titleRow.setScale(0)
    this.tweens.add({
      targets: titleRow,
      scaleX: 1, scaleY: 1,
      duration: isAutoSimMode() ? 50 : 550,
      ease: 'Back.easeOut',
    })

    // Classic podium order: 2nd | 1st | 3rd | (4th)
    const medals = ['1', '2', '3', '4']
    const medalColors = [COLORS.gold, 0xc0c8d4, 0xcd8f4a, 0x6a7a90]
    const podiumH = [190, 150, 115, 85]
    const playerCount = sorted.length
    // Even spacing across center for up to 4 players: positions relative to rank display order
    // Display order left-to-right for Mario Party feel: 4th, 2nd, 1st, 3rd when 4 players
    // Or: 2nd, 1st, 3rd when 3; etc.
    const displayOrder = this.buildPodiumOrder(playerCount)
    const slotCount = displayOrder.length
    const spacing = slotCount <= 3 ? 260 : 210
    const startX = w / 2 - ((slotCount - 1) * spacing) / 2
    const podiumBase = h - 118

    displayOrder.forEach((rank, slot) => {
      const player = sorted[rank]
      const x = startX + slot * spacing
      const ph = podiumH[Math.min(rank, podiumH.length - 1)]
      const pColor = medalColors[Math.min(rank, medalColors.length - 1)]

      const podium = this.add.rectangle(x, podiumBase, 140, ph, pColor, 0.92)
      podium.setStrokeStyle(2, 0xffffff, 0.35)
      podium.setOrigin(0.5, 1)
      podium.setScale(1, 0)

      const podiumGlow = this.add.ellipse(x, podiumBase, 180, 36, pColor, 0.22).setOrigin(0.5, 1).setDepth(-1).setAlpha(0)

      this.tweens.add({
        targets: podium,
        scaleY: 1,
        duration: isAutoSimMode() ? 30 : 360,
        delay: isAutoSimMode() ? rank * 10 : rank * 160,
        ease: 'Back.easeOut',
      })
      this.tweens.add({
        targets: podiumGlow,
        alpha: 1,
        duration: isAutoSimMode() ? 30 : 280,
        delay: isAutoSimMode() ? rank * 10 : rank * 160,
      })

      this.add.text(x, podiumBase - ph / 2, medals[rank], {
        fontSize: '36px',
        fontFamily: FONT.display,
        color: '#000000',
      }).setAlpha(0.22).setOrigin(0.5)

      // Cards stand on their podium (the winner's still hops above it), clear of the header lines.
      const cardY = podiumBase - ph - 76
      const cardG = this.add.graphics()
      cardG.fillStyle(0x000000, 0.3)
      cardG.fillRoundedRect(x - 78, cardY - 72, 156, 148, 14)
      cardG.fillStyle(COLORS.bgPanel, 0.92)
      cardG.fillRoundedRect(x - 76, cardY - 74, 152, 144, 14)
      cardG.lineStyle(3, pColor, 0.85)
      cardG.strokeRoundedRect(x - 76, cardY - 74, 152, 144, 14)
      cardG.setAlpha(0)

      const tex = characterTextureKey(player.characterIndex)
      const emoji = this.textures.exists(tex)
        ? this.add.image(x, cardY - 36, tex)
            .setDisplaySize(52, 66).setAlpha(0)
        : this.add.text(x, cardY - 42, player.emoji, { fontSize: '44px' }).setOrigin(0.5).setAlpha(0)
      const nameT = this.add.text(x, cardY + 8, player.name, {
        fontSize: '20px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0)
      // Trophies decide the winner, so they lead; points (the tiebreak) come second.
      const scoreT = this.add.text(x, cardY + 36, `🏆 ${player.trophies}`, {
        fontSize: '22px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      }).setOrigin(0.5).setAlpha(0)
      const starT = this.add.text(x, cardY + 60, `${player.score} pts${player.bricksCollected > 0 ? `   🧱 ${player.bricksCollected}` : ''}`, {
        fontSize: '14px', fontFamily: FONT.body, color: '#a8bdd4',
      }).setOrigin(0.5).setAlpha(0)

      // Rank badge
      const badge = this.add.circle(x, cardY - 96, 20, pColor, 1).setStrokeStyle(2, 0xffffff, 0.7).setAlpha(0)
      const badgeNum = this.add.text(x, cardY - 96, String(rank + 1), {
        fontSize: '18px', fontFamily: FONT.display, color: '#000000',
      }).setOrigin(0.5).setAlpha(0)

      const fadeTargets = [cardG, emoji, nameT, scoreT, starT, badge, badgeNum]
      this.tweens.add({
        targets: fadeTargets,
        alpha: 1,
        duration: isAutoSimMode() ? 20 : 280,
        delay: isAutoSimMode() ? rank * 12 + 24 : rank * 180 + 420,
      })

      if (rank === 0 && !isAutoSimMode()) {
        this.tweens.add({
          targets: [cardG, emoji, nameT, scoreT, starT, badge, badgeNum],
          y: '-=10',
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    })

    this.time.delayedCall(this.d(1100), () => {
      Sfx.win()
      showConfetti(this)
      const banner = this.add.text(w / 2, 118, `${sorted[0].emoji} ${sorted[0].name} WINS!`, {
        fontSize: '36px',
        fontFamily: FONT.display,
        color: hexColor(COLORS.gold),
        stroke: hexColor(COLORS.goldDeep),
        strokeThickness: 7,
      }).setOrigin(0.5).setScale(0)
      this.tweens.add({
        targets: banner,
        scaleX: 1, scaleY: 1,
        duration: isAutoSimMode() ? 40 : 480,
        ease: 'Back.easeOut',
      })

      const totalRounds = state.round
      const totalStars = state.players.reduce((s, p) => s + p.trophies, 0)
      const statsLine = this.add.text(
        w / 2,
        158,
        `Most 🏆 wins — points break ties  ·  ${totalRounds} round${totalRounds === 1 ? '' : 's'}  ·  ${totalStars} 🏆 won`,
        { fontSize: '15px', fontFamily: FONT.body, color: hexColor(COLORS.mute) }
      ).setOrigin(0.5).setAlpha(0)
      this.tweens.add({ targets: statsLine, alpha: 1, duration: 400, delay: 400 })

      if (!isAutoSimMode()) {
        for (let t = 0; t < 10; t++) {
          this.time.delayedCall(t * 320, () => {
            this.createFirework(
              Phaser.Math.Between(180, w - 180),
              Phaser.Math.Between(90, h - 280)
            )
          })
        }
      }
    })

    const awards = state.bonusAwards ?? []
    if (awards.length > 0) {
      const line = awards.map(a => `${a.icon} ${a.title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}: ${a.winners.map(id => state.players.find(p => p.id === id)?.name ?? '?').join(' & ')}`).join('   ·   ')
      this.add.text(w / 2, 186, line, { fontSize: '14px', fontFamily: FONT.body, color: hexColor(COLORS.mist) }).setOrigin(0.5)
    }

    const studyBtn = createButton(this, w / 2, h - 52, '📖 STUDY SHEET', COLORS.warning, 0xd9800f, 260, 56)
    studyBtn.on('pointerdown', () => this.openStudySheet(state))

    const playAgainBtn = createButton(this, w / 2 - 300, h - 52, 'PLAY AGAIN', COLORS.party, COLORS.partyDeep, 280, 56)
    playAgainBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(280, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('SetupScene')
      })
    })

    const menuBtn = createButton(this, w / 2 + 300, h - 52, 'MAIN MENU', COLORS.skyDeep, COLORS.skyBtnDeep, 280, 56)
    menuBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(280, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('MenuScene')
      })
    })

    const onEnter = () => {
      if (this.studySheet) return
      this.scene.start('SetupScene')
    }
    const onEsc = () => {
      if (this.studySheet) {
        this.closeStudySheet()
        return
      }
      this.scene.start('MenuScene')
    }
    this.input.keyboard?.on('keydown-ENTER', onEnter)
    this.input.keyboard?.on('keydown-ESC', onEsc)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ENTER', onEnter)
      this.input.keyboard?.off('keydown-ESC', onEsc)
    })
  }

  private studySheet?: Phaser.GameObjects.Container

  private closeStudySheet() {
    this.studySheet?.destroy()
    this.studySheet = undefined
  }

  /** Per-player accuracy, minigame record, and the words/questions they should review. */
  private openStudySheet(state: GameState) {
    this.closeStudySheet()
    const w = this.scale.width
    const h = this.scale.height
    const c = this.add.container(0, 0).setDepth(500)
    this.studySheet = c
    const dim = this.add.rectangle(0, 0, w, h, 0x000000, 0.72).setOrigin(0).setInteractive()
    dim.on('pointerdown', () => this.closeStudySheet())
    c.add(dim)
    const panelW = 1200
    const panelH = 620
    const g = this.add.graphics()
    g.fillStyle(COLORS.bgPanel, 0.98)
    g.fillRoundedRect(w / 2 - panelW / 2, h / 2 - panelH / 2, panelW, panelH, 20)
    g.lineStyle(3, COLORS.warning, 0.8)
    g.strokeRoundedRect(w / 2 - panelW / 2, h / 2 - panelH / 2, panelW, panelH, 20)
    // swallow clicks on the panel itself
    const block = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0, 0.001).setInteractive()
    c.add([g, block])
    c.add(this.add.text(w / 2, h / 2 - panelH / 2 + 38, '📖 STUDY SHEET', {
      fontSize: '34px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5))
    c.add(this.add.text(w / 2, h / 2 - panelH / 2 + 74, 'Words and questions worth another look — practice them in the Minigame Arcade!', {
      fontSize: '15px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5))

    const players = [...state.players].sort((a, b) => Number(a.isCpu) - Number(b.isCpu))
    const colW = (panelW - 40) / players.length
    players.forEach((p, i) => {
      const x = w / 2 - panelW / 2 + 20 + colW * i + colW / 2
      const top = h / 2 - panelH / 2 + 110
      const col = characterDef(p.characterIndex).color
      const cg = this.add.graphics()
      cg.fillStyle(0x0b1222, 0.9)
      cg.fillRoundedRect(x - colW / 2 + 6, top, colW - 12, panelH - 190, 14)
      cg.lineStyle(2, col, 0.6)
      cg.strokeRoundedRect(x - colW / 2 + 6, top, colW - 12, panelH - 190, 14)
      c.add(cg)
      c.add(this.add.text(x, top + 24, `${p.name}${p.isCpu ? ' 🤖' : ''}`, { fontSize: '22px', fontFamily: FONT.display, color: hexColor(col) }).setOrigin(0.5))
      const answered = p.stats.correctAnswers + p.stats.wrongAnswers
      const acc = answered > 0 ? Math.round((p.stats.correctAnswers / answered) * 100) : 0
      c.add(this.add.text(x, top + 56, answered > 0 ? `Board questions: ${p.stats.correctAnswers}/${answered} (${acc}%)` : 'Board questions: —', {
        fontSize: '14px', fontFamily: FONT.body, color: '#ffffff',
      }).setOrigin(0.5))
      c.add(this.add.text(x, top + 78, `Minigame wins: ${p.stats.minigameWins}  ·  Words practiced: ${p.stats.wordsPracticed}`, {
        fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mist), align: 'center', wordWrap: { width: colW - 30 },
      }).setOrigin(0.5))
      const missed = [...p.stats.missed].reverse().slice(0, players.length > 2 ? 6 : 8)
      if (missed.length === 0) {
        c.add(this.add.text(x, top + 150, p.isCpu ? '—' : 'Nothing to review — great job! ✨', {
          fontSize: '16px', fontFamily: FONT.display, color: '#44ff88', align: 'center', wordWrap: { width: colW - 40 },
        }).setOrigin(0.5))
        return
      }
      c.add(this.add.text(x, top + 108, 'REVIEW', { fontSize: '13px', fontFamily: FONT.display, color: hexColor(COLORS.coral) }).setOrigin(0.5))
      let y = top + 126
      const maxY = top + panelH - 200
      for (const m of missed) {
        if (y > maxY) break
        const head = this.add.text(x - colW / 2 + 20, y, `• ${m.word}`, {
          fontSize: '15px', fontFamily: FONT.display, color: '#ffffff', wordWrap: { width: colW - 44 },
        })
        c.add(head)
        y += head.height + 1
        if (m.note) {
          const note = this.add.text(x - colW / 2 + 32, y, m.note, {
            fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mist), wordWrap: { width: colW - 56 },
          })
          c.add(note)
          y += note.height
        }
        y += 8
      }
    })
    const close = createButton(this, w / 2, h / 2 + panelH / 2 - 40, 'CLOSE', COLORS.chrome, COLORS.chromeDeep, 200, 50)
    close.on('pointerdown', () => this.closeStudySheet())
    c.add(close)
  }

  /** Left-to-right display ranks for a balanced podium. */
  private buildPodiumOrder(count: number): number[] {
    if (count <= 1) return [0]
    if (count === 2) return [1, 0]
    if (count === 3) return [1, 0, 2]
    return [3, 1, 0, 2]
  }

  private createFirework(x: number, y: number) {
    const colors = [COLORS.coral, COLORS.mint, COLORS.sky, COLORS.gold, 0xff66cc, COLORS.teal]
    const color = Phaser.Utils.Array.GetRandom(colors)

    if (!this.textures.exists(TEXTURE_KEYS.particleYellow)) return

    const particles = this.add.particles(x, y, TEXTURE_KEYS.particleYellow, {
      speed: { min: 90, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0 },
      lifespan: 750,
      gravityY: 110,
      tint: color,
      blendMode: 'ADD',
      quantity: 32,
    })

    this.time.delayedCall(750, () => particles.destroy())
  }
}
