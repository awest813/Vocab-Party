import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { createDimmer, createPanel } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import type { GameState } from '../systems/GameState'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'

interface QuestionData {
  question: string
  answers: string[]
  correct: number
  explanation?: string
}

export interface QuestionResolution {
  correct: boolean
  timeBonus: number
  speedSurge: boolean
}

interface QuestionSceneData {
  type: 'vocab' | 'grammar'
  playerIndex: number
  state: GameState
  onComplete: (result: QuestionResolution) => void
  /** When set, auto-picks after delay (correct with given probability). */
  cpuResolve?: { delayMs: number; correctChance: number }
}

export class QuestionScene extends Phaser.Scene {
  constructor() { super('QuestionScene') }

  private d(ms: number) {
    return scaleAutoSimDelay(ms)
  }

  private answerContainers: Phaser.GameObjects.Container[] = []

  create(data: QuestionSceneData) {
    // Reset from previous scene
    this.answerContainers = []

    const w = this.scale.width
    const h = this.scale.height
    const { type, playerIndex, state, onComplete, cpuResolve } = data

    const questions: QuestionData[] = type === 'vocab'
      ? this.cache.json.get('vocab').questions
      : this.cache.json.get('grammar').questions

    const q: QuestionData = Phaser.Utils.Array.GetRandom(questions)
    const player = state.players[playerIndex]

    // Deep environment wash
    createDimmer(this, 0.78)

    const panelW = 920
    const panelH = 520
    const borderColor = type === 'vocab' ? COLORS.sky : COLORS.warning
    const cardTex = type === 'vocab' ? TEXTURE_KEYS.kenneyCardBlue : TEXTURE_KEYS.kenneyCardRed
    const hasCard = this.textures.exists(cardTex)

    const panelContainer = createPanel(this, {
      x: w / 2,
      y: h / 2,
      width: panelW,
      height: panelH,
      fill: COLORS.bgPanel,
      fillAlpha: 0.94,
      border: borderColor,
      borderAlpha: 0.65,
      headerColor: borderColor,
      headerHeight: 6,
      depth: 40,
      animateIn: true,
    })

    if (hasCard) {
      panelContainer.add(
        this.add.image(0, 10, cardTex).setDisplaySize(panelW - 40, panelH - 50).setAlpha(0.12)
      )
    }

    const headerColor = type === 'vocab' ? hexColor(COLORS.sky) : hexColor(COLORS.warning)
    const headerLabel = type === 'vocab' ? 'VOCABULARY QUESTION' : 'GRAMMAR QUESTION'
    const header = this.add.text(w / 2, h / 2 - 210, headerLabel, {
      fontSize: '26px',
      fontFamily: FONT.display,
      color: headerColor,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(45)

    this.add.text(w / 2, h / 2 - 170, `${player.emoji} ${player.name}'s Turn  ·  Score: ${player.score}`, {
      fontSize: '18px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mist),
    }).setOrigin(0.5).setDepth(45)

    this.add.text(w / 2, h / 2 - 140, 'Keys: 1–4 or A–D', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
    }).setOrigin(0.5).setDepth(45)

    this.tweens.add({ targets: header, alpha: 1, duration: isAutoSimMode() ? 30 : 300, delay: isAutoSimMode() ? 0 : 200 })

    const qText = this.add.text(w / 2, h / 2 - 100, q.question, {
      fontSize: '24px',
      fontFamily: FONT.body,
      color: '#ffffff',
      wordWrap: { width: 820 },
      align: 'center',
    }).setOrigin(0.5).setAlpha(0).setDepth(45)
    this.tweens.add({ targets: qText, alpha: 1, duration: isAutoSimMode() ? 30 : 400, delay: isAutoSimMode() ? 0 : 300 })

    const answerColors = [COLORS.skyDeep, COLORS.coral, COLORS.mint, COLORS.warning]
    const labels = ['A', 'B', 'C', 'D']
    let answered = false
    let countdownTimer: Phaser.Time.TimerEvent
    let timerBarTween: Phaser.Tweens.Tween | undefined
    let secondsLeft = 15

    const pickAnswer = (i: number, btn: Phaser.GameObjects.Container | null) => {
      if (answered) return
      answered = true
      countdownTimer?.remove()
      timerBarTween?.stop()
      const correct = i === q.correct
      const timeBonus = correct ? Math.max(1, Math.ceil(secondsLeft / 3)) : 0
      const speedSurge = correct && secondsLeft >= 10
      // Highlight correct (green) and picked wrong (red) buttons
      this.answerContainers.forEach((c, idx) => {
        const setFill = (c as any).setFillColor as ((color: number) => void) | undefined
        if (!setFill) return
        if (idx === q.correct) setFill(COLORS.mint)
        else if (idx === i && !correct) setFill(COLORS.danger)
        else c.setAlpha(0.4)
      })
      this.handleAnswer(correct, timeBonus, speedSurge, btn, onComplete, q.explanation)
    }

    const keyToIndex: Record<string, number> = {
      Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
      Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3,
      KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      const idx = keyToIndex[ev.code]
      if (idx === undefined || idx >= q.answers.length) return
      ev.preventDefault()
      pickAnswer(idx, null)
    }
    this.input.keyboard?.on('keydown', onKeyDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', onKeyDown)
    })

    q.answers.forEach((ans, i) => {
      const row = Math.floor(i / 2)
      const col = i % 2
      const bx = w / 2 + (col === 0 ? -230 : 230)
      const by = h / 2 + 40 + row * 90
      const btn = createButton(this, bx, by, `${labels[i]}: ${ans}`, answerColors[i], answerColors[i], 380, 64)
      btn.setAlpha(0).setDepth(45)
      btn.setName(`btn_${i}`)
      this.answerContainers.push(btn)
      this.tweens.add({
        targets: btn,
        alpha: 1,
        duration: isAutoSimMode() ? 20 : 300,
        delay: isAutoSimMode() ? 0 : 400 + i * 80
      })

      btn.on('pointerdown', () => pickAnswer(i, btn))
    })

    // Timer bar
    const timerTrack = this.add.graphics().setDepth(45)
    timerTrack.fillStyle(0x1a2438, 1)
    timerTrack.fillRoundedRect(w / 2 - 400, h / 2 + 217, 800, 16, 8)
    timerTrack.lineStyle(1.5, 0xffffff, 0.25)
    timerTrack.strokeRoundedRect(w / 2 - 400, h / 2 + 217, 800, 16, 8)

    const timerBar = this.add.rectangle(w / 2 - 400, h / 2 + 225, 800, 10, COLORS.mint)
    timerBar.setOrigin(0, 0.5).setDepth(45)

    const countdownText = this.add.text(w / 2 + 420, h / 2 + 225, '15', {
      fontSize: '22px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.mint),
      stroke: '#002200',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(45)

    countdownTimer = this.time.addEvent({
      delay: isAutoSimMode() ? 60 : 1000,
      repeat: 14,
      callback: () => {
        secondsLeft--
        countdownText.setText(String(secondsLeft))
        if (secondsLeft <= 5) {
          countdownText.setColor('#ff3333')
          this.tweens.add({
            targets: countdownText,
            scaleX: 1.4, scaleY: 1.4,
            duration: 100, yoyo: true,
            ease: 'Bounce.easeInOut'
          })
          this.cameras.main.shake(100, 0.005)
        }
        else if (secondsLeft <= 10) countdownText.setColor('#ff8800')
      }
    })

    timerBarTween = this.tweens.add({
      targets: timerBar,
      width: 0,
      duration: isAutoSimMode() ? 900 : 15000,
      ease: 'Linear',
      onUpdate: () => {
        const pct = timerBar.width / 800
        if (pct <= 0.33) timerBar.setFillStyle(0xff3333)
        else if (pct <= 0.66) timerBar.setFillStyle(0xff8800)
        else timerBar.setFillStyle(0x44ff88)
      },
      onComplete: () => {
        countdownTimer.remove()
        if (!answered) {
          answered = true
          this.handleAnswer(false, 0, false, null, onComplete)
        }
      }
    })

    if (cpuResolve) {
      this.time.delayedCall(this.d(cpuResolve.delayMs), () => {
        if (answered) return
        answered = true
        countdownTimer.remove()
        timerBarTween.stop()
        const wantCorrect = Phaser.Math.FloatBetween(0, 1) < cpuResolve.correctChance
        const wrongIndices = q.answers.map((_, i) => i).filter(i => i !== q.correct)
        const pickIndex = wantCorrect
          ? q.correct
          : (wrongIndices.length > 0 ? Phaser.Utils.Array.GetRandom(wrongIndices) : q.correct)
        const correct = pickIndex === q.correct
        const simulatedSecondsLeft = Math.max(1, Math.floor(secondsLeft * Phaser.Math.FloatBetween(0.45, 0.95)))
        const timeBonus = correct ? Math.max(1, Math.ceil(simulatedSecondsLeft / 3)) : 0
        const speedSurge = correct && simulatedSecondsLeft >= 10
        this.handleAnswer(correct, timeBonus, speedSurge, null, onComplete, q.explanation)
      })
    }
  }

  handleAnswer(
    correct: boolean,
    timeBonus: number,
    speedSurge: boolean,
    _btn: Phaser.GameObjects.Container | null,
    onComplete: (result: QuestionResolution) => void,
    explanation?: string
  ) {
    const w = this.scale.width
    const h = this.scale.height

    if (correct) {
      showConfetti(this)
      this.cameras.main.flash(400, 100, 255, 100)

      if (speedSurge) {
        // Speed surge particle burst
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2
          this.time.delayedCall(i * 20, () => {
            const bolt = this.add.text(w / 2 + Math.cos(angle) * 30, h / 2 + Math.sin(angle) * 30, '⚡', {
              fontSize: '24px'
            }).setOrigin(0.5).setAlpha(1)
            this.tweens.add({
              targets: bolt,
              x: bolt.x + Math.cos(angle) * 120,
              y: bolt.y + Math.sin(angle) * 120,
              alpha: 0,
              duration: 400,
              ease: 'Expo.easeOut',
              onComplete: () => bolt.destroy()
            })
          })
        }
      }

      const banner = this.add.container(w / 2, h / 2).setDepth(200)
      const bg = this.add.rectangle(0, 0, w, 140, COLORS.mint, 0.55)
      const txt = this.add.text(0, 0, 'CORRECT!', {
        fontSize: '78px', fontFamily: FONT.display, color: '#ffffff', stroke: '#004400', strokeThickness: 10
      }).setOrigin(0.5)
      banner.add([bg, txt]).setScale(3).setAlpha(0)
      this.tweens.add({ targets: banner, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, ease: 'Expo.easeOut' })

      if (timeBonus > 0) {
        this.time.delayedCall(this.d(400), () => {
          this.add.text(w / 2, h / 2 + 100, `SPEED BONUS +${timeBonus}`, {
            fontSize: '26px', fontFamily: FONT.display, color: '#88ddff', stroke: '#102844', strokeThickness: 4
          }).setOrigin(0.5).setDepth(201)
        })
      }
      this.time.delayedCall(this.d(600), () => {
        this.add.text(w / 2, h / 2 + 160, `+${10 + timeBonus} pts`, {
          fontSize: '22px', fontFamily: FONT.display, color: hexColor(COLORS.mint), stroke: '#004400', strokeThickness: 4
        }).setOrigin(0.5).setDepth(201)
      })
    } else {
      this.cameras.main.shake(300, 0.01)
      this.cameras.main.flash(300, 255, 0, 0, true)
      
      const banner = this.add.container(w / 2, h / 2).setDepth(200)
      const bg = this.add.rectangle(0, 0, w, 140, COLORS.danger, 0.55)
      const txt = this.add.text(0, 0, 'WRONG', {
        fontSize: '78px', fontFamily: FONT.display, color: '#ffffff', stroke: '#440000', strokeThickness: 10
      }).setOrigin(0.5)
      banner.add([bg, txt]).setScale(3).setAlpha(0)
      this.tweens.add({ targets: banner, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, ease: 'Expo.easeOut' })
    }

    if (explanation) {
      this.time.delayedCall(this.d(300), () => {
        this.add.text(w / 2, h / 2 + 230, `💡 ${explanation}`, {
          fontSize: '18px',
          fontFamily: 'Fredoka, Arial',
          color: '#ffffaa',
          wordWrap: { width: 820 },
          align: 'center'
        }).setOrigin(0.5)
      })
    }

    this.time.delayedCall(this.d(2200), () => onComplete({
      correct,
      timeBonus,
      speedSurge: correct && speedSurge
    }))
  }
}
