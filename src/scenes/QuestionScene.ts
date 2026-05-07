import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import type { GameState } from '../systems/GameState'
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

  create(data: QuestionSceneData) {
    const w = this.scale.width
    const h = this.scale.height
    const { type, playerIndex, state, onComplete, cpuResolve } = data

    const questions: QuestionData[] = type === 'vocab'
      ? this.cache.json.get('vocab').questions
      : this.cache.json.get('grammar').questions

    const q: QuestionData = Phaser.Utils.Array.GetRandom(questions)
    const player = state.players[playerIndex]

    // Deep environment wash
    this.add.rectangle(0, 0, w, h, 0x050510, 0.85).setOrigin(0)
    
    // Glassmorphic Question Panel
    const panelW = 920
    const panelH = 520
    const panelContainer = this.add.container(w / 2, h / 2)
    
    const panelBg = this.add.rectangle(0, 0, panelW, panelH, 0x0a1528, 0.8)
    const borderColor = type === 'vocab' ? 0x4488ff : 0xff8844
    panelBg.setStrokeStyle(4, borderColor, 0.6)
    
    const accentGlow = this.add.rectangle(0, -panelH / 2 + 2, panelW - 4, 4, borderColor, 0.8)
    
    panelContainer.add([panelBg, accentGlow])
    panelContainer.setScale(0.8)
    panelContainer.setAlpha(0)
    
    this.tweens.add({
      targets: panelContainer,
      scaleX: 1, scaleY: 1,
      alpha: 1,
      duration: isAutoSimMode() ? 40 : 400,
      ease: 'Cubic.easeOut'
    })

    // Header
    const headerColor = type === 'vocab' ? '#4488ff' : '#ff8844'
    const headerLabel = type === 'vocab' ? '📖 VOCABULARY QUESTION' : '✏️ GRAMMAR QUESTION'
    const header = this.add.text(w / 2, h / 2 - 210, headerLabel, {
      fontSize: '28px',
      fontFamily: 'Arial Black',
      color: headerColor,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0)

    this.add.text(w / 2, h / 2 - 170, `${player.emoji} ${player.name}'s Turn`, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#aaaacc'
    }).setOrigin(0.5)

    this.tweens.add({ targets: header, alpha: 1, duration: isAutoSimMode() ? 30 : 300, delay: isAutoSimMode() ? 0 : 200 })

    // Question text
    const qText = this.add.text(w / 2, h / 2 - 100, q.question, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
      wordWrap: { width: 820 },
      align: 'center'
    }).setOrigin(0.5).setAlpha(0)
    this.tweens.add({ targets: qText, alpha: 1, duration: isAutoSimMode() ? 30 : 400, delay: isAutoSimMode() ? 0 : 300 })

    // Answer buttons
    const answerColors = [0x4444cc, 0xcc4444, 0x44aa44, 0xcc8800]
    const labels = ['A', 'B', 'C', 'D']
    let answered = false
    let countdownTimer: Phaser.Time.TimerEvent
    let secondsLeft = 15

    const pickAnswer = (i: number, btn: Phaser.GameObjects.Container | null) => {
      if (answered) return
      answered = true
      countdownTimer?.remove()
      const correct = i === q.correct
      const timeBonus = correct ? Math.max(1, Math.ceil(secondsLeft / 3)) : 0
      const speedSurge = correct && secondsLeft >= 10
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
      const btn = createButton(this, bx, by, `${labels[i]}: ${ans}`, answerColors[i], answerColors[i] - 0x222222, 380, 64)
      btn.setAlpha(0)
      this.tweens.add({
        targets: btn,
        alpha: 1,
        duration: isAutoSimMode() ? 20 : 300,
        delay: isAutoSimMode() ? 0 : 400 + i * 80
      })

      btn.on('pointerdown', () => pickAnswer(i, btn))
    })

    this.add.text(w / 2, h / 2 + 188, 'Keys: 1–4 or A–D', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#7788aa'
    }).setOrigin(0.5)

    // Timer bar
    this.add.rectangle(w / 2, h / 2 + 225, 800, 16, 0x333355)
      .setStrokeStyle(2, 0xffffff)
    const timerBar = this.add.rectangle(w / 2 - 400, h / 2 + 225, 800, 12, 0x44ff88)
    timerBar.setOrigin(0, 0.5)

    const countdownText = this.add.text(w / 2 + 430, h / 2 + 225, '15', {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#44ff88',
      stroke: '#002200',
      strokeThickness: 3
    }).setOrigin(0, 0.5)

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

    const timerBarTween = this.tweens.add({
      targets: timerBar,
      width: 0,
      duration: isAutoSimMode() ? 900 : 15000,
      ease: 'Linear',
      onComplete: () => {
        countdownTimer.remove()
        if (!answered) {
          answered = true
          this.handleAnswer(false, 0, false, null, onComplete)
        }
      }
    })

    this.time.delayedCall(this.d(10000), () => { if (!answered) timerBar.setFillStyle(0xff8800) })
    this.time.delayedCall(this.d(13000), () => { if (!answered) timerBar.setFillStyle(0xff3333) })

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
      
      const banner = this.add.container(w / 2, h / 2).setDepth(200)
      const bg = this.add.rectangle(0, 0, w, 140, 0x00ff88, 0.6)
      const txt = this.add.text(0, 0, '✅ CORRECT!', {
        fontSize: '84px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#004400', strokeThickness: 10
      }).setOrigin(0.5)
      banner.add([bg, txt]).setScale(3).setAlpha(0)
      this.tweens.add({ targets: banner, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, ease: 'Expo.easeOut' })

      if (timeBonus > 0) {
        this.time.delayedCall(this.d(400), () => {
          this.add.text(w / 2, h / 2 + 100, `⚡ SPEED BONUS +${timeBonus}`, {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#88ddff', stroke: '#102844', strokeThickness: 4
          }).setOrigin(0.5).setDepth(201)
        })
      }
    } else {
      this.cameras.main.shake(300, 0.01)
      this.cameras.main.flash(300, 255, 0, 0, true)
      
      const banner = this.add.container(w / 2, h / 2).setDepth(200)
      const bg = this.add.rectangle(0, 0, w, 140, 0xff0000, 0.6)
      const txt = this.add.text(0, 0, '❌ WRONG', {
        fontSize: '84px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#440000', strokeThickness: 10
      }).setOrigin(0.5)
      banner.add([bg, txt]).setScale(3).setAlpha(0)
      this.tweens.add({ targets: banner, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, ease: 'Expo.easeOut' })
    }

    if (explanation) {
      this.time.delayedCall(this.d(300), () => {
        this.add.text(w / 2, h / 2 + 230, `💡 ${explanation}`, {
          fontSize: '18px',
          fontFamily: 'Arial',
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
