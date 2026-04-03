import Phaser from 'phaser'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'

interface QuestionData {
  question: string
  answers: string[]
  correct: number
  explanation?: string
}

interface QuestionSceneData {
  type: 'vocab' | 'grammar'
  playerIndex: number
  state: any
  onComplete: (correct: boolean) => void
}

export class QuestionScene extends Phaser.Scene {
  constructor() { super('QuestionScene') }

  create(data: QuestionSceneData) {
    const w = this.scale.width
    const h = this.scale.height
    const { type, playerIndex, state, onComplete } = data

    const questions: QuestionData[] = type === 'vocab'
      ? this.cache.json.get('vocab').questions
      : this.cache.json.get('grammar').questions

    const q: QuestionData = Phaser.Utils.Array.GetRandom(questions)
    const player = state.players[playerIndex]

    // Dark overlay
    this.add.rectangle(0, 0, w, h, 0x000000, 0.75).setOrigin(0)

    // Panel
    const panelW = 900
    const panelH = 500
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x1e2050)
    panel.setStrokeStyle(5, type === 'vocab' ? 0x4488ff : 0xff8844)

    // Panel entrance
    panel.setScale(0.1)
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' })

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

    this.tweens.add({ targets: header, alpha: 1, duration: 300, delay: 200 })

    // Question text
    const qText = this.add.text(w / 2, h / 2 - 100, q.question, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
      wordWrap: { width: 820 },
      align: 'center'
    }).setOrigin(0.5).setAlpha(0)
    this.tweens.add({ targets: qText, alpha: 1, duration: 400, delay: 300 })

    // Answer buttons
    const answerColors = [0x4444cc, 0xcc4444, 0x44aa44, 0xcc8800]
    const labels = ['A', 'B', 'C', 'D']
    let answered = false
    let countdownTimer: Phaser.Time.TimerEvent

    const pickAnswer = (i: number, btn: Phaser.GameObjects.Container | null) => {
      if (answered) return
      answered = true
      countdownTimer?.remove()
      const correct = i === q.correct
      this.handleAnswer(correct, btn, onComplete, q.explanation)
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
      this.tweens.add({ targets: btn, alpha: 1, duration: 300, delay: 400 + i * 80 })

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

    let secondsLeft = 15
    const countdownText = this.add.text(w / 2 + 430, h / 2 + 225, '15', {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#44ff88',
      stroke: '#002200',
      strokeThickness: 3
    }).setOrigin(0, 0.5)

    countdownTimer = this.time.addEvent({
      delay: 1000,
      repeat: 14,
      callback: () => {
        secondsLeft--
        countdownText.setText(String(secondsLeft))
        if (secondsLeft <= 5) countdownText.setColor('#ff3333')
        else if (secondsLeft <= 10) countdownText.setColor('#ff8800')
      }
    })

    this.tweens.add({
      targets: timerBar,
      width: 0,
      duration: 15000,
      ease: 'Linear',
      onComplete: () => {
        countdownTimer.remove()
        if (!answered) {
          answered = true
          this.handleAnswer(false, null, onComplete)
        }
      }
    })

    this.time.delayedCall(10000, () => { if (!answered) timerBar.setFillStyle(0xff8800) })
    this.time.delayedCall(13000, () => { if (!answered) timerBar.setFillStyle(0xff3333) })
  }

  handleAnswer(
    correct: boolean,
    _btn: Phaser.GameObjects.Container | null,
    onComplete: (c: boolean) => void,
    explanation?: string
  ) {
    const w = this.scale.width
    const h = this.scale.height

    if (correct) {
      showConfetti(this)
      this.cameras.main.flash(400, 100, 255, 100)
      const msg = this.add.text(w / 2, h / 2 - 240, '✅ CORRECT! +10 Points!', {
        fontSize: '36px',
        fontFamily: 'Arial Black',
        color: '#44ff88',
        stroke: '#004400',
        strokeThickness: 5
      }).setOrigin(0.5).setScale(0.1)
      this.tweens.add({ targets: msg, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.easeOut' })
    } else {
      this.cameras.main.shake(300, 0.01)
      const msg = this.add.text(w / 2, h / 2 - 240, '❌ INCORRECT!', {
        fontSize: '36px',
        fontFamily: 'Arial Black',
        color: '#ff4444',
        stroke: '#440000',
        strokeThickness: 5
      }).setOrigin(0.5).setScale(0.1)
      this.tweens.add({ targets: msg, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.easeOut' })
    }

    if (explanation) {
      this.time.delayedCall(300, () => {
        this.add.text(w / 2, h / 2 + 230, `💡 ${explanation}`, {
          fontSize: '18px',
          fontFamily: 'Arial',
          color: '#ffffaa',
          wordWrap: { width: 820 },
          align: 'center'
        }).setOrigin(0.5)
      })
    }

    this.time.delayedCall(2200, () => onComplete(correct))
  }
}
