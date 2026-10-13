import Phaser from 'phaser'
import type { BonusAward, GameState, Player } from '../systems/GameState'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import { characterDef, characterTextureKey } from '../systems/SpriteFactory'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { addVignette, paintStage } from '../ui/Panel'
import { addAmbientMotes, addStarfieldBackdrop } from '../ui/Starfield'
import { COLORS, FONT, hexColor } from '../ui/Theme'

interface AwardDef {
  icon: string
  title: string
  blurb: (v: number) => string
  stat: (p: Player) => number
}

const AWARDS: AwardDef[] = [
  { icon: '📚', title: 'WORD WIZARD', blurb: v => `Most questions answered correctly (${v})`, stat: p => p.stats.correctAnswers },
  { icon: '🎮', title: 'MINIGAME MASTER', blurb: v => `Most minigame victories (${v})`, stat: p => p.stats.minigameWins },
  { icon: '🪙', title: 'COIN TYCOON', blurb: v => `Most coins held at once (${v})`, stat: p => p.stats.peakCoins },
]

/** Compute and apply bonus trophies (ties all win). Idempotent per state. */
export function applyBonusAwards(state: GameState): BonusAward[] {
  if (state.bonusAwards) return state.bonusAwards
  const awards: BonusAward[] = []
  for (const a of AWARDS) {
    const best = Math.max(...state.players.map(a.stat))
    if (!(best > 0)) continue
    const winners = state.players.filter(p => a.stat(p) === best)
    // A bonus star shared by everyone changes nothing — skip it.
    if (winners.length === state.players.length && state.players.length > 1) continue
    winners.forEach(p => { p.trophies += 1 })
    awards.push({ icon: a.icon, title: a.title, blurb: a.blurb(best), winners: winners.map(p => p.id), value: best })
  }
  state.bonusAwards = awards
  return awards
}

/** Mario Party–style bonus star reveal between the last turn and the final results. */
export class BonusStarsScene extends Phaser.Scene {
  constructor() { super('BonusStarsScene') }

  private d(ms: number) {
    return scaleAutoSimDelay(ms)
  }

  create(data: { state: GameState }) {
    const { state } = data
    const w = this.scale.width
    const h = this.scale.height
    const reduce = shouldReduceMotion()

    paintStage(this, { topColor: COLORS.bgDeep, bottomColor: 0x1a1430 })
    addStarfieldBackdrop(this, 0.45)
    addVignette(this, 0.6, -4)
    if (!reduce) addAmbientMotes(this, 24)

    const awards = applyBonusAwards(state)
    const toResults = () => this.scene.start('ResultsScene', { state })

    const title = this.add.text(w / 2, 74, '🌟 BONUS STARS! 🌟', {
      fontSize: '58px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      stroke: hexColor(COLORS.goldDeep), strokeThickness: 10,
    }).setOrigin(0.5)
    this.add.text(w / 2, 126, awards.length > 0 ? `${['', 'One extra trophy is', 'Two extra trophies are', 'Three extra trophies are'][awards.length]} up for grabs…` : 'No bonus stars this time — on to the results!', {
      fontSize: '20px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5)
    if (!reduce) {
      title.setScale(0)
      this.tweens.add({ targets: title, scale: 1, duration: this.d(500), ease: 'Back.easeOut' })
    }
    Sfx.splash()
    Sfx.startMusic('results')

    const cardW = 360
    const gap = 30
    const total = awards.length * cardW + Math.max(0, awards.length - 1) * gap
    awards.forEach((award, i) => {
      const x = w / 2 - total / 2 + cardW / 2 + i * (cardW + gap)
      this.time.delayedCall(this.d(900 + i * 1700), () => this.revealAward(award, state, x, h / 2 + 50, cardW))
    })

    const endDelay = 900 + awards.length * 1700 + 600
    if (isAutoSimMode()) {
      this.time.delayedCall(this.d(endDelay), toResults)
      return
    }
    this.time.delayedCall(this.d(endDelay), () => {
      const btn = createButton(this, w / 2, h - 58, 'SEE FINAL RESULTS  ▶', COLORS.party, COLORS.partyDeep, 380, 62)
      btn.on('pointerdown', toResults)
      const key = (ev: KeyboardEvent) => { if (ev.code === 'Enter' || ev.code === 'Space') toResults() }
      this.input.keyboard?.on('keydown', key)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', key))
    })
  }

  private revealAward(award: BonusAward, state: GameState, x: number, y: number, cardW: number) {
    const cardH = 360
    const c = this.add.container(x, y)
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.4)
    g.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 8, cardW, cardH, 22)
    g.fillStyle(COLORS.bgPanel, 0.97)
    g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 22)
    g.lineStyle(4, COLORS.gold, 0.9)
    g.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 22)
    c.add(g)
    c.add(this.add.text(0, -cardH / 2 + 50, award.icon, { fontSize: '58px' }).setOrigin(0.5))
    c.add(this.add.text(0, -cardH / 2 + 110, award.title, {
      fontSize: '28px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5))
    c.add(this.add.text(0, -cardH / 2 + 146, award.blurb, {
      fontSize: '15px', fontFamily: FONT.body, color: hexColor(COLORS.mist), align: 'center', wordWrap: { width: cardW - 40 },
    }).setOrigin(0.5))

    const winners = award.winners.map(id => state.players.find(p => p.id === id)!).filter(Boolean)
    const spacing = Math.min(110, (cardW - 40) / Math.max(1, winners.length))
    winners.forEach((p, i) => {
      const px = (i - (winners.length - 1) / 2) * spacing
      const ring = this.add.graphics()
      ring.fillStyle(characterDef(p.characterIndex).color, 1)
      ring.fillCircle(px, 40, 44)
      ring.fillStyle(0x0c1424, 1)
      ring.fillCircle(px, 40, 39)
      c.add(ring)
      const key = characterTextureKey(p.characterIndex)
      if (this.textures.exists(key)) c.add(this.add.image(px, 42, key).setDisplaySize(58, 72))
      c.add(this.add.text(px, 100, p.name, { fontSize: winners.length > 2 ? '15px' : '20px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0.5))
    })
    c.add(this.add.text(0, cardH / 2 - 34, '+1 🏆', {
      fontSize: '30px', fontFamily: FONT.display, color: '#44ff88', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5))

    if (!shouldReduceMotion()) {
      c.setScale(0, 1)
      this.tweens.add({ targets: c, scaleX: 1, duration: this.d(380), ease: 'Back.easeOut' })
    }
    Sfx.star()
    showConfetti(this, x, y - 100)
  }
}
