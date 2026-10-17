import Phaser from 'phaser'
import { CPU_LEVEL_LABEL, type CpuLevel } from '../systems/CpuPolicy'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { medalCount, rewardArcade } from '../systems/Unlocks'
import { Sfx } from '../systems/Sfx'
import { characterTextureKey } from '../systems/SpriteFactory'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { createPanel, paintStage } from '../ui/Panel'
import { addStarfieldBackdrop } from '../ui/Starfield'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { ContentBank } from '../minigames/ContentBank'
import {
  cpuMinigameScore,
  getMinigame,
  getPersonalBests,
  MINIGAMES,
  pickPartyMinigame,
  recordPersonalBest,
} from '../minigames/registry'
import { stopSpeech } from '../minigames/speech'
import { getProgress, recordMinigame, recordWords } from '../systems/Progress'
import { checkWordAchievements, unlock } from '../systems/Achievements'
import type { MinigameContext, MinigameDef, MinigameInstance, PlayArea } from '../minigames/types'
import { popText } from '../minigames/ui'

export interface MinigameParticipant {
  /** Player id on the board; use negative ids for ghost rivals. */
  id: number
  name: string
  characterIndex: number
  color: number
  isCpu: boolean
  cpuLevel: CpuLevel
}

export interface StudyEntry {
  word: string
  correct: boolean
  note?: string
}

export interface MinigameResult {
  gameId: string
  scores: Record<number, number>
  /** 1-based place per participant id (ties share a place). */
  placements: Record<number, number>
  /** Participant ids, best first. */
  ranking: number[]
  study: Record<number, StudyEntry[]>
}

export interface MinigameSceneData {
  mode: 'party' | 'duel' | 'practice'
  participants: MinigameParticipant[]
  /** Force a specific game (arcade / duel); otherwise the roulette picks one. */
  gameId?: string
  /** Banner line shown with the rules, e.g. "1st +10 🪙 · 2nd +5 🪙". */
  stakes?: string
  /** Optional per-place reward labels shown on the results board. */
  rewardLabels?: string[]
  onComplete?: (result: MinigameResult) => void
  /** Practice these words more often (Word Book → practice weak words). */
  focusWords?: string[]
  /** Where practice mode's back button goes (default: the Arcade). */
  backScene?: 'ArcadeScene' | 'WordBookScene'
}

const HEADER_H = 92
const SIDEBAR_W = 236
const PLACE_LABEL = ['1st', '2nd', '3rd', '4th']
const PLACE_COLOR = [COLORS.gold, 0xc0c8d4, 0xcd8f4a, 0x6a7a90]

interface Ghost {
  id: number
  finalScore: number
  times: number[]
  text: Phaser.GameObjects.Text
}

/** Trim long player names so they fit fixed-width UI slots. */
function fitName(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

export class MinigameScene extends Phaser.Scene {
  private data_!: MinigameSceneData
  private def!: MinigameDef
  private bank!: ContentBank
  private scores: Record<number, number> = {}
  /** When each player last raised their score (ms into their round) — breaks score ties. */
  private reachedAt: Record<number, number> = {}
  private study: Record<number, StudyEntry[]> = {}
  private keyHandlers: ((ev: KeyboardEvent) => boolean | void)[] = []
  private keyListener?: (ev: KeyboardEvent) => void
  private instance?: MinigameInstance
  private running = false
  private elapsed = 0
  private timers: Phaser.Time.TimerEvent[] = []
  private ghosts: Ghost[] = []
  private timerBar?: Phaser.GameObjects.Graphics
  private timerText?: Phaser.GameObjects.Text
  private liveScoreText?: Phaser.GameObjects.Text
  private sidebarTexts = new Map<number, Phaser.GameObjects.Text>()

  constructor() { super('MinigameScene') }

  private d(ms: number) {
    return scaleAutoSimDelay(ms)
  }

  create(data: MinigameSceneData) {
    this.data_ = data
    this.scores = {}
    this.reachedAt = {}
    this.study = {}
    this.keyHandlers = []
    this.timers = []
    this.ghosts = []
    this.running = false
    this.instance = undefined
    this.sidebarTexts = new Map()
    this.playedIds = new Set()
    this.ghostScores = new Map()
    this.bank = new ContentBank(this.cache, data.focusWords)
    data.participants.forEach(p => {
      this.scores[p.id] = 0
      this.study[p.id] = []
    })

    this.keyListener = (ev: KeyboardEvent) => {
      // Held keys auto-repeat; never let one held key answer question after question.
      if (!this.running || ev.repeat) return
      for (const h of this.keyHandlers) {
        if (h(ev)) {
          ev.preventDefault()
          return
        }
      }
    }
    this.input.keyboard?.on('keydown', this.keyListener)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keyListener) this.input.keyboard?.off('keydown', this.keyListener)
      this.timers.forEach(t => t.remove())
      // Note: don't call instance.stop() here — the display list is already destroyed at shutdown.
      this.running = false
      stopSpeech()
    })

    const forced = getMinigame(data.gameId)
    this.def = forced ?? pickPartyMinigame()
    this.paintBackdrop()
    Sfx.startMusic('minigame')
    if (forced) this.showIntro()
    else this.showRoulette()
  }

  update(_time: number, delta: number) {
    if (!this.running) return
    this.elapsed += delta
    this.instance?.update?.(_time, delta)
    this.updateClock()
  }

  // ────────────────────────────── helpers ──────────────────────────────

  private get humans(): MinigameParticipant[] {
    return this.data_.participants.filter(p => !p.isCpu)
  }

  private wait(ms: number, fn: () => void) {
    const t = this.time.delayedCall(this.d(ms), fn)
    this.timers.push(t)
    return t
  }

  private paintBackdrop() {
    paintStage(this, { topColor: 0x0f1830, bottomColor: 0x070b14, midAlpha: 0.5 })
    addStarfieldBackdrop(this, 0.38)
    const wash = this.add.graphics().setDepth(-5)
    wash.fillStyle(this.def?.accent ?? COLORS.teal, 0.05)
    wash.fillRect(0, this.scale.height * 0.62, this.scale.width, this.scale.height * 0.38)
  }

  private clearAll() {
    this.tweens.killAll()
    this.children.removeAll(true)
    this.paintBackdrop()
  }

  private portrait(p: MinigameParticipant, x: number, y: number, size: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y)
    const ring = this.add.graphics()
    ring.fillStyle(0x000000, 0.35)
    ring.fillCircle(0, 3, size / 2 + 3)
    ring.fillStyle(p.color, 1)
    ring.fillCircle(0, 0, size / 2 + 3)
    ring.fillStyle(0x0c1424, 1)
    ring.fillCircle(0, 0, size / 2 - 1)
    c.add(ring)
    const key = characterTextureKey(p.characterIndex)
    if (p.id >= 0 && this.textures.exists(key)) {
      c.add(this.add.image(0, 2, key).setDisplaySize(size * 0.78, size * 0.92))
    } else {
      c.add(this.add.text(0, 0, '🤖', { fontSize: `${Math.round(size * 0.55)}px` }).setOrigin(0.5))
    }
    return c
  }

  // ────────────────────────────── roulette ──────────────────────────────

  private showRoulette() {
    const w = this.scale.width
    const h = this.scale.height
    const fast = isAutoSimMode() || this.humans.length === 0
    Sfx.splash()

    const banner = this.add.text(w / 2, 110, this.data_.mode === 'duel' ? '⚔️ DUEL!' : '🎉 MINIGAME TIME! 🎉', {
      fontSize: '56px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5)
    if (!shouldReduceMotion()) {
      banner.setScale(0)
      this.tweens.add({ targets: banner, scale: 1, duration: this.d(420), ease: 'Back.easeOut' })
    }

    // Reel window
    const reelY = h / 2 + 20
    const frame = this.add.graphics()
    frame.fillStyle(0x000000, 0.45)
    frame.fillRoundedRect(w / 2 - 330, reelY - 86, 660, 180, 26)
    frame.fillStyle(COLORS.bgPanel, 1)
    frame.fillRoundedRect(w / 2 - 330, reelY - 92, 660, 180, 26)
    frame.lineStyle(5, COLORS.gold, 0.9)
    frame.strokeRoundedRect(w / 2 - 330, reelY - 92, 660, 180, 26)
    const pointerL = this.add.text(w / 2 - 370, reelY - 2, '▶', { fontSize: '42px', color: hexColor(COLORS.gold) }).setOrigin(0.5)
    const pointerR = this.add.text(w / 2 + 370, reelY - 2, '◀', { fontSize: '42px', color: hexColor(COLORS.gold) }).setOrigin(0.5)
    void pointerL; void pointerR

    const icon = this.add.text(w / 2 - 230, reelY - 2, '', { fontSize: '86px' }).setOrigin(0.5)
    const title = this.add.text(w / 2 + 50, reelY - 22, '', {
      fontSize: '44px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5)
    const cat = this.add.text(w / 2 + 50, reelY + 34, '', {
      fontSize: '18px', fontFamily: FONT.display, color: hexColor(COLORS.mist),
    }).setOrigin(0.5)

    const setFace = (m: MinigameDef) => {
      icon.setText(m.icon)
      title.setText(m.title)
      cat.setText(m.category.toUpperCase())
      cat.setColor(hexColor(m.accent))
    }

    const order = Phaser.Utils.Array.Shuffle([...MINIGAMES])
    const spins = fast ? 3 : 22
    let i = 0
    const step = () => {
      const isLast = i >= spins
      const m = isLast ? this.def : order[i % order.length]
      setFace(m)
      Sfx.reel()
      if (!shouldReduceMotion()) {
        icon.setY(reelY - 30).setAlpha(0.4)
        title.setAlpha(0.6)
        this.tweens.add({ targets: icon, y: reelY - 2, alpha: 1, duration: this.d(60) })
        this.tweens.add({ targets: title, alpha: 1, duration: this.d(60) })
      }
      if (isLast) {
        Sfx.star()
        if (!shouldReduceMotion()) {
          this.cameras.main.flash(this.d(260), 255, 220, 120, true)
          this.tweens.add({ targets: [icon, title], scale: 1.15, duration: this.d(160), yoyo: true })
        }
        this.wait(fast ? 200 : 1100, () => {
          this.clearAll()
          this.showIntro()
        })
        return
      }
      i++
      const t = i / spins
      this.wait(50 + Math.pow(t, 3) * 300, step)
    }
    this.wait(fast ? 50 : 500, step)
  }

  // ────────────────────────────── intro / rules ──────────────────────────────

  private showIntro() {
    const w = this.scale.width
    const h = this.scale.height
    const def = this.def
    const touch = isTouchPreferred(this.sys.game)
    const allCpu = this.humans.length === 0

    const panel = createPanel(this, {
      x: w / 2, y: h / 2 - 6, width: 900, height: 560,
      fill: COLORS.bgPanel, fillAlpha: 0.96, border: def.accent, borderAlpha: 0.8,
      headerColor: def.accent, headerHeight: 10, depth: 10,
    })

    panel.add(this.add.text(-400, -220, def.icon, { fontSize: '76px' }).setOrigin(0, 0.5))
    // Title sits fully inside the card (it used to poke above the accent bar).
    panel.add(this.add.text(-300, -234, def.title.toUpperCase(), {
      fontSize: '44px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0, 0.5))
    const chip = this.add.text(-300, -190, ` ${def.category.toUpperCase()} · ${Math.round(def.durationMs / 1000)}s `, {
      fontSize: '16px', fontFamily: FONT.display, color: '#0a101c', backgroundColor: hexColor(def.accent),
      padding: { x: 6, y: 3 },
    }).setOrigin(0, 0.5)
    panel.add(chip)
    panel.add(this.add.text(0, -150, def.tagline, {
      fontSize: '22px', fontFamily: FONT.body, color: hexColor(COLORS.frost), fontStyle: 'italic',
      align: 'center', wordWrap: { width: 820 },
    }).setOrigin(0.5))

    // Stack rule lines by their measured height so wrapped lines never overlap.
    let ruleY = -108
    def.howTo.forEach((line, i) => {
      const t = this.add.text(-346, ruleY, line, {
        fontSize: '21px', fontFamily: FONT.body, color: '#ffffff', wordWrap: { width: 740 },
      }).setOrigin(0, 0)
      const dotY = ruleY + 13
      const dot = this.add.graphics()
      dot.fillStyle(def.accent, 1)
      dot.fillCircle(-372, dotY, 13)
      panel.add(dot)
      panel.add(this.add.text(-372, dotY, String(i + 1), { fontSize: '15px', fontFamily: FONT.display, color: '#0a101c' }).setOrigin(0.5))
      panel.add(t)
      ruleY += t.height + 12
    })

    panel.add(this.add.text(0, 50, `🎮  ${touch ? def.controls.touch : def.controls.keys}`, {
      fontSize: '17px', fontFamily: FONT.body, color: hexColor(COLORS.mist), align: 'center', wordWrap: { width: 820 },
    }).setOrigin(0.5))

    // Participants row
    const ps = this.data_.participants
    const spacing = Math.min(200, 820 / Math.max(1, ps.length))
    ps.forEach((p, i) => {
      const x = (i - (ps.length - 1) / 2) * spacing
      const port = this.portrait(p, x, 124, 62)
      panel.add(port)
      panel.add(this.add.text(x, 168, p.name, {
        fontSize: '17px', fontFamily: FONT.display, color: '#ffffff',
      }).setOrigin(0.5))
      if (p.isCpu) {
        panel.add(this.add.text(x, 188, `CPU · ${CPU_LEVEL_LABEL[p.cpuLevel]}`, { fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mute) }).setOrigin(0.5))
      }
    })
    if (ps.length === 2 && this.data_.mode === 'duel') {
      panel.add(this.add.text(0, 124, 'VS', {
        fontSize: '34px', fontFamily: FONT.display, color: hexColor(COLORS.coral), stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5))
    }

    if (this.data_.stakes) {
      panel.add(this.add.text(0, 222, this.data_.stakes, {
        fontSize: '18px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      }).setOrigin(0.5))
    }

    if (allCpu) {
      panel.add(this.add.text(0, 254, 'CPUs are playing…', { fontSize: '16px', fontFamily: FONT.body, color: hexColor(COLORS.mute) }).setOrigin(0.5))
      this.wait(1800, () => this.simulateAllCpu())
      return
    }

    const go = createButton(this, w / 2, h - 34, touch ? "READY — LET'S GO!" : "READY!  (Enter)", COLORS.party, COLORS.partyDeep, 360, 58)
    go.setDepth(20)
    let started = false
    const begin = () => {
      if (started) return
      started = true
      this.input.keyboard?.off('keydown', keyGo)
      this.clearAll()
      this.runTurns(0)
    }
    const keyGo = (ev: KeyboardEvent) => {
      if (ev.repeat) return
      if (ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'NumpadEnter') begin()
    }
    go.on('pointerdown', begin)
    this.wait(400, () => { if (!started) this.input.keyboard?.on('keydown', keyGo) })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', keyGo))
  }

  // ────────────────────────────── human turns ──────────────────────────────

  private runTurns(humanIdx: number) {
    const humans = this.humans
    if (humanIdx >= humans.length) {
      this.finishRound()
      return
    }
    const player = humans[humanIdx]
    if (humans.length > 1) {
      this.showPassCard(player, humanIdx, () => this.countdownThenPlay(player, humanIdx))
    } else {
      this.countdownThenPlay(player, humanIdx)
    }
  }

  private showPassCard(player: MinigameParticipant, humanIdx: number, next: () => void) {
    const w = this.scale.width
    const h = this.scale.height
    const panel = createPanel(this, {
      x: w / 2, y: h / 2, width: 640, height: 380, border: player.color, headerColor: player.color, headerHeight: 10, depth: 10,
    })
    panel.add(this.portrait(player, 0, -70, 110))
    panel.add(this.add.text(0, 30, `${fitName(player.name, 14)}'s turn!`, {
      fontSize: '42px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5))
    // Leader so far: humans who already played plus the CPUs' locked-in finals.
    const known = [
      ...this.data_.participants.filter(p => !p.isCpu).slice(0, humanIdx).map(p => this.scores[p.id] ?? 0),
      ...Array.from(this.ghostScores.values()),
    ]
    const beat = humanIdx > 0 && known.length > 0
      ? `Top score so far: ${Math.max(...known)}`
      : 'Everyone else — no peeking! 👀'
    panel.add(this.add.text(0, 84, beat, { fontSize: '20px', fontFamily: FONT.body, color: hexColor(COLORS.mist) }).setOrigin(0.5))
    const btn = createButton(this, w / 2, h / 2 + 140, "I'M READY", player.color, player.color, 260, 56)
    btn.setDepth(20)
    let done = false
    const go = () => {
      if (done) return
      done = true
      this.input.keyboard?.off('keydown', key)
      this.clearAll()
      next()
    }
    const key = (ev: KeyboardEvent) => { if (!ev.repeat && (ev.code === 'Enter' || ev.code === 'Space')) go() }
    btn.on('pointerdown', go)
    // Arm late: the previous player may still be mashing Space/Enter when time ran out.
    this.wait(600, () => { if (!done) this.input.keyboard?.on('keydown', key) })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', key))
  }

  private countdownThenPlay(player: MinigameParticipant, humanIdx: number) {
    const w = this.scale.width
    const h = this.scale.height
    const label = this.add.text(w / 2, h / 2 - 120, `${this.def.icon} ${this.def.title}`, {
      fontSize: '30px', fontFamily: FONT.display, color: hexColor(this.def.accent), stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5)
    const count = this.add.text(w / 2, h / 2 + 10, '', {
      fontSize: '140px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 12,
    }).setOrigin(0.5)
    let n = 3
    const tick = () => {
      if (n > 0) {
        count.setText(String(n)).setScale(1.5).setColor('#ffffff')
        this.tweens.add({ targets: count, scale: 1, duration: this.d(300), ease: 'Back.easeOut' })
        Sfx.tick()
        n--
        this.wait(650, tick)
      } else {
        count.setText('GO!').setColor('#44ff88').setScale(1.3)
        Sfx.tick(true)
        this.wait(380, () => {
          label.destroy()
          count.destroy()
          this.playRound(player, humanIdx)
        })
      }
    }
    this.wait(250, tick)
  }

  private playArea(): PlayArea {
    const left = 24
    const right = this.scale.width - SIDEBAR_W - 28
    return {
      left,
      right,
      width: right - left,
      cx: (left + right) / 2,
      top: HEADER_H + 14,
      bottom: this.scale.height - 14,
    }
  }

  private buildHud(player: MinigameParticipant) {
    const w = this.scale.width
    const def = this.def
    const g = this.add.graphics().setDepth(40)
    g.fillStyle(COLORS.bgPanel, 0.96)
    g.fillRect(0, 0, w, HEADER_H)
    g.fillStyle(def.accent, 0.9)
    g.fillRect(0, HEADER_H - 4, w, 4)

    this.add.text(22, 28, `${def.icon} ${def.title}`, {
      fontSize: '26px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(41)
    this.add.text(22, 62, `${player.name} playing`, {
      fontSize: '15px', fontFamily: FONT.body, color: hexColor(player.color),
    }).setOrigin(0, 0.5).setDepth(41)

    this.timerBar = this.add.graphics().setDepth(41)
    this.timerText = this.add.text(w / 2, 26, '', {
      fontSize: '26px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(42)

    this.add.text(w - 30, 24, 'SCORE', { fontSize: '13px', fontFamily: FONT.display, color: hexColor(COLORS.mist) }).setOrigin(1, 0.5).setDepth(41)
    this.liveScoreText = this.add.text(w - 30, 58, '0', {
      fontSize: '40px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 5,
    }).setOrigin(1, 0.5).setDepth(41)

    // Sidebar scoreboard
    const sx = w - SIDEBAR_W - 10
    const sy = HEADER_H + 14
    const ps = this.data_.participants
    const rowH = 76
    const sideH = this.data_.mode === 'practice' ? 140 : 46 + ps.length * rowH
    const sb = this.add.graphics().setDepth(30)
    sb.fillStyle(0x0b1222, 0.92)
    sb.fillRoundedRect(sx, sy, SIDEBAR_W, sideH, 16)
    sb.lineStyle(2, def.accent, 0.45)
    sb.strokeRoundedRect(sx, sy, SIDEBAR_W, sideH, 16)

    if (this.data_.mode === 'practice') {
      const best = getPersonalBests()[def.id] ?? 0
      this.add.text(sx + SIDEBAR_W / 2, sy + 30, 'PERSONAL BEST', { fontSize: '15px', fontFamily: FONT.display, color: hexColor(COLORS.mist) }).setOrigin(0.5).setDepth(31)
      this.add.text(sx + SIDEBAR_W / 2, sy + 80, best > 0 ? `🏆 ${best}` : '—', {
        fontSize: '42px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(31)
    } else {
      this.add.text(sx + SIDEBAR_W / 2, sy + 22, 'LIVE SCORES', { fontSize: '15px', fontFamily: FONT.display, color: hexColor(COLORS.mist) }).setOrigin(0.5).setDepth(31)
      ps.forEach((p, i) => {
        const y = sy + 46 + i * rowH + rowH / 2 - 6
        const isMe = p.id === player.id
        if (isMe) {
          const hl = this.add.graphics().setDepth(30)
          hl.fillStyle(p.color, 0.18)
          hl.fillRoundedRect(sx + 6, y - rowH / 2 + 4, SIDEBAR_W - 12, rowH - 8, 12)
        }
        this.portrait(p, sx + 38, y, 46).setDepth(31)
        this.add.text(sx + 70, y - 12, fitName(p.name, 9), { fontSize: '17px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0, 0.5).setDepth(31)
        this.add.text(sx + 70, y + 12, p.isCpu ? `CPU · ${CPU_LEVEL_LABEL[p.cpuLevel]}` : isMe ? 'playing now' : this.playedIds.has(p.id) ? 'finished' : 'up next', {
          fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
        }).setOrigin(0, 0.5).setDepth(31)
        const done = !p.isCpu && !isMe && this.study[p.id] !== undefined && this.playedIds.has(p.id)
        const t = this.add.text(sx + SIDEBAR_W - 18, y, p.isCpu || isMe ? '0' : done ? String(this.scores[p.id]) : '—', {
          fontSize: '30px', fontFamily: FONT.display, color: isMe ? hexColor(COLORS.gold) : '#ffffff', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(1, 0.5).setDepth(31)
        this.sidebarTexts.set(p.id, t)
      })
    }
  }

  private playedIds = new Set<number>()

  private setupGhosts() {
    this.ghosts = []
    for (const p of this.data_.participants) {
      if (!p.isCpu) continue
      const text = this.sidebarTexts.get(p.id)
      if (!text) continue
      if (!this.ghostScores.has(p.id)) {
        this.ghostScores.set(p.id, cpuMinigameScore(this.def, p.cpuLevel))
      }
      const finalScore = this.ghostScores.get(p.id)!
      // Each CPU gets its own pace: some start fast, some finish strong.
      const k = Phaser.Math.FloatBetween(0.75, 1.35)
      const times = Array.from({ length: finalScore }, () => Math.pow(Phaser.Math.FloatBetween(0.04, 0.97), k) * this.def.durationMs).sort((a, b) => a - b)
      this.ghosts.push({ id: p.id, finalScore, times, text })
    }
  }

  private ghostScores = new Map<number, number>()

  /** A CPU ghost's score at the current point in the round. */
  private ghostShown(g: Ghost): number {
    let shown = 0
    while (shown < g.times.length && g.times[shown] <= this.elapsed) shown++
    return shown
  }

  private updateClock() {
    const total = this.def.durationMs
    const left = Math.max(0, total - this.elapsed)
    const w = this.scale.width
    if (this.timerBar && this.timerText) {
      const barW = 420
      const frac = left / total
      const col = frac > 0.5 ? COLORS.mint : frac > 0.2 ? COLORS.warning : COLORS.danger
      this.timerBar.clear()
      this.timerBar.fillStyle(0x000000, 0.5)
      this.timerBar.fillRoundedRect(w / 2 - barW / 2, 52, barW, 18, 9)
      this.timerBar.fillStyle(col, 1)
      this.timerBar.fillRoundedRect(w / 2 - barW / 2 + 2, 54, Math.max(6, (barW - 4) * frac), 14, 7)
      const secs = Math.ceil(left / 1000)
      const prev = this.timerText.text
      this.timerText.setText(`${secs}s`)
      if (secs <= 5 && prev !== `${secs}s` && secs > 0) {
        Sfx.tick()
        this.timerText.setColor('#ff6b6b')
        if (!shouldReduceMotion()) this.tweens.add({ targets: this.timerText, scale: 1.3, duration: 90, yoyo: true })
      }
    }
    for (const g of this.ghosts) {
      const s = String(this.ghostShown(g))
      if (g.text.text !== s) {
        g.text.setText(s)
        if (!shouldReduceMotion()) this.tweens.add({ targets: g.text, scale: 1.25, duration: 80, yoyo: true })
      }
    }
    if (left <= 0 && this.running) this.endRound()
  }

  private currentPlayer?: MinigameParticipant
  private currentHumanIdx = 0
  private root?: Phaser.GameObjects.Container

  /** Bumped every round so stale timers from a previous player's game never fire. */
  private roundToken = 0
  private roundTimers: Phaser.Time.TimerEvent[] = []

  private playRound(player: MinigameParticipant, humanIdx: number) {
    this.roundToken++
    this.roundTimers = []
    this.currentPlayer = player
    this.currentHumanIdx = humanIdx
    this.elapsed = 0
    this.keyHandlers = []
    this.buildHud(player)
    this.setupGhosts()

    const root = this.add.container(0, 0).setDepth(10)
    this.root = root
    const area = this.playArea()

    const touch = isTouchPreferred(this.sys.game)
    const reduceMotion = shouldReduceMotion()

    const ctx: MinigameContext = {
      scene: this,
      bank: this.bank,
      root,
      area,
      accent: this.def.accent,
      touch,
      reduceMotion,
      addScore: (delta, x, y) => {
        if (!this.running) return
        const before = this.scores[player.id]
        this.scores[player.id] = Math.max(0, before + delta)
        if (this.scores[player.id] > before) this.reachedAt[player.id] = this.elapsed
        const s = String(this.scores[player.id])
        this.liveScoreText?.setText(s)
        this.sidebarTexts.get(player.id)?.setText(s)
        if (this.liveScoreText && !reduceMotion) this.tweens.add({ targets: this.liveScoreText, scale: 1.25, duration: 90, yoyo: true })
        if (x !== undefined && y !== undefined) {
          popText(this, null, x, y, delta > 0 ? `+${delta}` : `${delta}`, delta > 0 ? '#44ff88' : '#ff6b6b')
        }
        if (delta > 0) Sfx.coin()
      },
      recordWord: (word, correct, note) => {
        const list = this.study[player.id]
        const existing = list.find(e => e.word === word)
        if (existing) {
          if (!correct) { existing.correct = false; existing.note = note ?? existing.note }
        } else {
          list.push({ word, correct, note })
        }
      },
      onKey: (handler) => { this.keyHandlers.push(handler) },
      isOver: () => !this.running,
      timeLeftMs: () => Math.max(0, this.def.durationMs - this.elapsed),
      after: (ms, fn) => {
        const token = this.roundToken
        const t = this.wait(ms, () => { if (this.running && this.roundToken === token) fn() })
        this.roundTimers.push(t)
        return t
      },
      rivals: () => this.data_.participants
        .filter(r => r.id !== player.id)
        .map(r => {
          let score: number | null = null
          if (r.isCpu) {
            const g = this.ghosts.find(x => x.id === r.id)
            score = g ? this.ghostShown(g) : null
          } else if (this.playedIds.has(r.id)) {
            score = this.scores[r.id] ?? 0
          }
          return { id: r.id, name: r.name, color: r.color, characterIndex: r.characterIndex, isCpu: r.isCpu, score }
        }),
      flash: (text, color = '#ffffff') => {
        const t = this.add.text(area.cx, area.top + (area.bottom - area.top) * 0.5, text, {
          fontSize: '40px', fontFamily: FONT.display, color, stroke: '#000000', strokeThickness: 8,
        }).setOrigin(0.5).setDepth(60)
        this.tweens.add({
          targets: t,
          ...(reduceMotion ? {} : { scale: { from: 0.6, to: 1.1 } }),
          alpha: { from: 1, to: 0 },
          duration: 950,
          ease: 'Cubic.easeOut',
          onComplete: () => t.destroy(),
        })
      },
    }

    this.running = true
    this.instance = this.def.start(ctx)
    this.updateClock()
  }

  private endRound() {
    if (!this.running) return
    this.running = false
    this.instance?.stop?.()
    this.instance = undefined
    this.roundToken++
    this.roundTimers.forEach(t => t.remove())
    this.roundTimers = []
    this.keyHandlers = []
    stopSpeech()
    const player = this.currentPlayer!
    this.playedIds.add(player.id)
    // Lock ghost displays at their finals.
    this.ghosts.forEach(g => g.text.setText(String(g.finalScore)))
    Sfx.timeUp()

    const w = this.scale.width
    const h = this.scale.height
    const shade = this.add.rectangle(0, 0, w, h, 0x000000, 0.5).setOrigin(0).setDepth(80).setInteractive()
    void shade
    const t = this.add.text(w / 2, h / 2 - 20, "⏱️ TIME'S UP!", {
      fontSize: '72px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(81)
    this.add.text(w / 2, h / 2 + 60, `${player.name} scored ${this.scores[player.id]}`, {
      fontSize: '32px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(81)
    if (!shouldReduceMotion()) {
      t.setScale(0.4)
      this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.easeOut' })
    }
    this.wait(1700, () => {
      this.clearAll()
      this.ghosts = []
      this.sidebarTexts.clear()
      this.runTurns(this.currentHumanIdx + 1)
    })
  }

  // ────────────────────────────── results ──────────────────────────────

  private simulateAllCpu() {
    this.data_.participants.forEach(p => {
      this.scores[p.id] = cpuMinigameScore(this.def, p.cpuLevel)
      this.reachedAt[p.id] = Math.random() * this.def.durationMs
    })
    this.clearAll()
    this.showResults()
  }

  private finishRound() {
    // CPUs keep the scores their ghosts showed during the human turn(s).
    this.data_.participants.forEach(p => {
      if (!p.isCpu) return
      this.scores[p.id] = this.ghostScores.get(p.id) ?? cpuMinigameScore(this.def, p.cpuLevel)
      const ghost = this.ghosts.find(g => g.id === p.id)
      this.reachedAt[p.id] = ghost && this.scores[p.id] > 0 ? ghost.times[this.scores[p.id] - 1] ?? Infinity : Math.random() * this.def.durationMs
    })
    this.showResults()
  }

  private computeResult(): MinigameResult {
    const ps = this.data_.participants
    const score = (id: number) => this.scores[id] ?? 0
    // Equal scores go to whoever got there first; only a dead heat on both shares a place.
    const reached = (id: number) => (score(id) > 0 ? this.reachedAt[id] ?? Infinity : Infinity)
    const ranking = [...ps].sort((a, b) => score(b.id) - score(a.id) || reached(a.id) - reached(b.id)).map(p => p.id)
    const placements: Record<number, number> = {}
    ranking.forEach((id, i) => {
      const prev = ranking[i - 1]
      placements[id] = i > 0 && score(prev) === score(id) && reached(prev) === reached(id) ? placements[prev] : i + 1
    })
    return { gameId: this.def.id, scores: { ...this.scores }, placements, ranking, study: this.study }
  }

  /** Persist human players' practice into the lifetime Word Book. */
  private recordProgress(result: MinigameResult) {
    if (isAutoSimMode()) return
    const competitive = this.data_.participants.length > 1
    for (const p of this.humans) {
      recordWords(result.study[p.id] ?? [])
      const won = competitive && result.placements[p.id] === 1
      recordMinigame(won)
      if (won) unlock('minigame_win')
    }
    if (getProgress().minigamesWon >= 10) unlock('minigame_10')
    checkWordAchievements()
  }

  private showResults() {
    const w = this.scale.width
    const h = this.scale.height
    const result = this.computeResult()
    this.recordProgress(result)
    const practice = this.data_.mode === 'practice'
    const fast = isAutoSimMode()

    if (practice) {
      this.showPracticeResults(result)
      return
    }

    this.add.text(w / 2, 70, `${this.def.icon} RESULTS`, {
      fontSize: '50px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5)
    this.add.text(w / 2, 118, this.def.title, { fontSize: '20px', fontFamily: FONT.display, color: hexColor(COLORS.mist) }).setOrigin(0.5)

    const rows = result.ranking.map(id => this.data_.participants.find(p => p.id === id)!)
    const rowH = 96
    const top = h / 2 - (rows.length * rowH) / 2 + 30
    rows.forEach((p, i) => {
      const place = result.placements[p.id]
      const y = top + i * rowH
      const row = this.add.container(w / 2, y)
      const g = this.add.graphics()
      const col = PLACE_COLOR[place - 1] ?? 0x6a7a90
      g.fillStyle(0x000000, 0.35)
      g.fillRoundedRect(-380, -38, 760, 82, 18)
      g.fillStyle(place === 1 ? 0x2a2410 : COLORS.bgPanel, 0.96)
      g.fillRoundedRect(-380, -42, 760, 82, 18)
      g.lineStyle(3, col, place === 1 ? 1 : 0.6)
      g.strokeRoundedRect(-380, -42, 760, 82, 18)
      g.fillStyle(col, 1)
      g.fillRoundedRect(-372, -34, 76, 66, 14)
      row.add(g)
      row.add(this.add.text(-334, -1, PLACE_LABEL[place - 1] ?? `${place}th`, {
        fontSize: '28px', fontFamily: FONT.display, color: '#0a101c',
      }).setOrigin(0.5))
      row.add(this.portrait(p, -240, -1, 58))
      row.add(this.add.text(-196, -14, fitName(p.name, 12), { fontSize: '26px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0, 0.5))
      row.add(this.add.text(-196, 16, p.isCpu ? `CPU · ${CPU_LEVEL_LABEL[p.cpuLevel]}` : 'Player', { fontSize: '14px', fontFamily: FONT.body, color: hexColor(COLORS.mute) }).setOrigin(0, 0.5))
      row.add(this.add.text(110, -1, `${result.scores[p.id]} pts`, {
        fontSize: '30px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5))
      // A tie on points that was broken by time gets a small note so the result doesn't look arbitrary.
      const tiedOnPoints = rows.some(r => r.id !== p.id && result.scores[r.id] === result.scores[p.id])
      if (tiedOnPoints && result.scores[p.id] > 0) {
        const below = rows.slice(i + 1).some(r => result.scores[r.id] === result.scores[p.id])
        if (below) {
          row.add(this.add.text(110, 26, '⏱ got there first', {
            fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
          }).setOrigin(0.5))
        }
      }
      // The Rival Bot (negative id) never collects board rewards.
      const reward = p.id < 0 ? '' : this.data_.rewardLabels?.[place - 1]
      if (reward) {
        row.add(this.add.text(360, -1, reward, {
          fontSize: '24px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 4,
        }).setOrigin(1, 0.5))
      }
      if (!shouldReduceMotion()) {
        row.setAlpha(0).setX(w / 2 + 80)
        this.tweens.add({ targets: row, alpha: 1, x: w / 2, duration: this.d(320), delay: this.d(150 + (rows.length - 1 - i) * 260), ease: 'Back.easeOut' })
      }
    })

    const humanWon = rows.some(r => !r.isCpu && result.placements[r.id] === 1)
    this.wait(150 + rows.length * 260, () => {
      if (humanWon) {
        Sfx.win()
        showConfetti(this)
      } else {
        Sfx.star()
      }
    })

    const finish = () => {
      if (done) return
      done = true
      this.input.keyboard?.off('keydown', key)
      this.data_.onComplete?.(result)
    }
    let done = false
    const key = (ev: KeyboardEvent) => { if (!ev.repeat && (ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'NumpadEnter')) finish() }
    if (fast || this.humans.length === 0) {
      this.wait(fast ? 600 : 2600, finish)
      return
    }
    const btn = createButton(this, w / 2, h - 52, 'CONTINUE  ▶', COLORS.party, COLORS.partyDeep, 300, 60)
    btn.on('pointerdown', finish)
    this.wait(500, () => this.input.keyboard?.on('keydown', key))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', key))
  }

  private showPracticeResults(result: MinigameResult) {
    const w = this.scale.width
    const h = this.scale.height
    const me = this.data_.participants[0]
    const score = result.scores[me.id] ?? 0
    const prevBest = getPersonalBests()[this.def.id] ?? 0
    const isBest = recordPersonalBest(this.def.id, score)
    if (!isAutoSimMode()) {
      const medal = score >= this.def.cpu.hard[1] ? 3 : score >= this.def.cpu.normal[1] ? 2 : score >= this.def.cpu.easy[1] ? 1 : 0
      if (score > 0) rewardArcade(this.def.id, medal)
      if (score >= this.def.cpu.hard[1]) unlock('gold_medal')
      const bests = getPersonalBests()
      if (MINIGAMES.every(m => (bests[m.id] ?? 0) > 0)) unlock('arcade_all')
      if (medalCount(3) >= 5) unlock('gold_5')
      if (medalCount(1) >= MINIGAMES.length) unlock('bronze_all')
    }

    const panel = createPanel(this, {
      x: w / 2, y: h / 2 - 20, width: 760, height: 520, border: this.def.accent, headerColor: this.def.accent, headerHeight: 10, depth: 10,
    })
    panel.add(this.add.text(0, -210, `${this.def.icon} ${this.def.title}`, {
      fontSize: '36px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5))
    panel.add(this.add.text(0, -120, String(score), {
      fontSize: '110px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5))
    panel.add(this.add.text(0, -40, isBest ? '🏆 NEW PERSONAL BEST!' : `Best: ${Math.max(prevBest, score)}`, {
      fontSize: '26px', fontFamily: FONT.display, color: isBest ? '#44ff88' : hexColor(COLORS.mist),
    }).setOrigin(0.5))

    // Medal against CPU tiers
    const tier = score >= this.def.cpu.hard[1] ? '🥇 Beat a Hard CPU’s best!' : score >= this.def.cpu.normal[1] ? '🥈 Beat a Normal CPU’s best' : score >= this.def.cpu.easy[1] ? '🥉 Beat an Easy CPU’s best' : 'Keep practicing — you’ve got this!'
    panel.add(this.add.text(0, 4, tier, { fontSize: '20px', fontFamily: FONT.body, color: '#ffffff' }).setOrigin(0.5))

    const missed = (result.study[me.id] ?? []).filter(e => !e.correct).slice(0, 4)
    if (missed.length > 0) {
      panel.add(this.add.text(0, 50, 'REVIEW', { fontSize: '15px', fontFamily: FONT.display, color: hexColor(COLORS.coral) }).setOrigin(0.5))
      missed.forEach((e, i) => {
        panel.add(this.add.text(0, 80 + i * 28, `${e.word}${e.note ? ` — ${e.note}` : ''}`, {
          fontSize: '17px', fontFamily: FONT.body, color: hexColor(COLORS.frost), wordWrap: { width: 700 },
        }).setOrigin(0.5))
      })
    } else if (score > 0) {
      panel.add(this.add.text(0, 80, 'Flawless — no misses! ✨', { fontSize: '20px', fontFamily: FONT.display, color: '#44ff88' }).setOrigin(0.5))
    } else {
      panel.add(this.add.text(0, 80, 'Give it another go — you’ll get the hang of it!', { fontSize: '20px', fontFamily: FONT.display, color: hexColor(COLORS.mist) }).setOrigin(0.5))
    }

    if (isBest) {
      Sfx.win()
      showConfetti(this)
    } else {
      Sfx.star()
    }

    const touch = isTouchPreferred(this.sys.game)
    let leaving = false
    const backScene = this.data_.backScene ?? 'ArcadeScene'
    const again = () => { if (!leaving) { leaving = true; this.scene.restart({ ...this.data_ }) } }
    const backOut = () => { if (!leaving) { leaving = true; this.scene.start(backScene) } }
    const againBtn = createButton(this, w / 2 - 170, h - 62, touch ? '↻  PLAY AGAIN' : '↻  AGAIN  (Enter)', COLORS.party, COLORS.partyDeep, 300, 60)
    againBtn.on('pointerdown', again)
    const back = createButton(this, w / 2 + 170, h - 62, `${backScene === 'WordBookScene' ? 'WORD BOOK' : 'ARCADE'}${touch ? '' : '  (Esc)'}`, COLORS.skyBtn, COLORS.skyBtnDeep, 300, 60)
    back.on('pointerdown', backOut)
    const key = (ev: KeyboardEvent) => {
      if (ev.repeat) return
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') again()
      else if (ev.code === 'Escape') backOut()
    }
    this.wait(400, () => this.input.keyboard?.on('keydown', key))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', key))
  }
}
