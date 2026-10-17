import Phaser from 'phaser'
import { createButton, setButtonFill } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { createDimmer, createPanel } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import type { GameState } from '../systems/GameState'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { filterByLevel, isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import { drawFromDeck, pickDistinct } from '../minigames/ContentBank'
import { activeCustomList, playableEntries, type WordEntry, type WordList } from '../systems/WordLists'

interface QuestionData {
  question: string
  answers: string[]
  correct: number
  explanation?: string
  level?: number
  /** The word being studied, when known (custom-list questions). */
  word?: string
}

export interface QuestionResolution {
  correct: boolean
  timeBonus: number
  speedSurge: boolean
  /** The question text (for the end-of-game study sheet). */
  question?: string
  explanation?: string
  /** The studied word, when the question knows it (feeds the Word Book). */
  word?: string
}

interface QuestionSceneData {
  type: 'vocab' | 'grammar'
  playerIndex: number
  state: GameState
  onComplete: (result: QuestionResolution) => void
  /** When set, auto-picks after delay (correct with given probability). */
  cpuResolve?: { delayMs: number; correctChance: number }
}

const FALLBACK_QUESTIONS: Record<'vocab' | 'grammar', QuestionData> = {
  vocab: {
    question: "What does 'resilient' mean?",
    answers: ['Easily broken', 'Quick to recover', 'Slow to move', 'Hard to see'],
    correct: 1,
    explanation: 'Resilient means able to recover quickly from difficulties.',
  },
  grammar: {
    question: 'Which sentence is correct?',
    answers: [
      'She dont like apples.',
      "She doesn't like apples.",
      'She do not like apples.',
      'She doesnt likes apples.',
    ],
    correct: 1,
    explanation: "Use doesn't + base verb for third-person singular negatives.",
  },
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The sentence with every use of the word (plus a simple ending: orbits, gathered, sailing…)
 * blanked out, or null if it isn't there as a whole word ("art" must not blank "artist").
 */
function blankSentence(sentence: string | undefined, word: string): string | null {
  if (!sentence) return null
  const re = new RegExp(`(^|[^\\p{L}])${escapeRe(word)}(?:s|es|ed|d|ing|er|ers)?(?![\\p{L}])`, 'giu')
  let found = false
  let out = sentence.replace(re, (_m, pre: string) => {
    found = true
    return `${pre}_____`
  })
  if (!found) return null
  // "a/an" right before the blank would give the answer away.
  out = out.replace(/\b(an?|An?) _____/g, (_m, a: string) => `${a[0] === 'A' ? 'A(n)' : 'a(n)'} _____`)
  return out
}

let customQuestionCount = 0

/**
 * A board question built from the teacher's active word list: definition → word, word → definition,
 * or fill-in-the-blank when the entry has an example sentence. Distractors are other list words.
 */
export function customVocabQuestion(list: WordList): QuestionData | null {
  const entries = playableEntries(list)
  if (entries.length < 4) return null
  const e = drawFromDeck(`board-custom:${list.id}`, entries)
  const key = (x: WordEntry) => x.word.toLowerCase()
  const others = pickDistinct(entries, 3, x =>
    key(x) === key(e) || x.definition.toLowerCase() === e.definition.toLowerCase())
  if (others.length < 3) return null
  const blanked = blankSentence(e.sentence, e.word)
  const shortDefs = [e, ...others].every(x => x.definition.length <= 80)
  const kinds: ('def' | 'word' | 'blank')[] = ['def', ...(shortDefs ? ['word' as const] : []), ...(blanked ? ['blank' as const] : [])]
  const kind = kinds[customQuestionCount++ % kinds.length]
  const explanation = `${e.word}: ${e.definition}`
  if (kind === 'word') {
    return {
      question: `What does '${e.word}' mean?`,
      answers: [e.definition, ...others.map(o => o.definition)].map(cap),
      correct: 0,
      explanation,
      word: e.word,
    }
  }
  return {
    question: kind === 'blank' ? `Which word completes the sentence?\n“${blanked}”` : `Which word means “${e.definition}”?`,
    answers: [e.word, ...others.map(o => o.word)],
    correct: 0,
    explanation,
    word: e.word,
  }
}

export class QuestionScene extends Phaser.Scene {
  private currentQuestion?: string
  private currentWord?: string
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

    const bank = type === 'vocab'
      ? this.cache.json.get('vocab')?.questions as QuestionData[] | undefined
      : this.cache.json.get('grammar')?.questions as QuestionData[] | undefined
    const questions = Array.isArray(bank) ? filterByLevel(bank, 10) : []
    // Teacher mode: vocab tiles ask about the active custom list (grammar tiles stay grammar).
    const customList = type === 'vocab' ? activeCustomList() : undefined
    const custom = customList ? customVocabQuestion(customList) : null
    const raw: QuestionData = custom ?? (questions.length > 0
      ? drawFromDeck(`board-${data.type}`, questions)
      : FALLBACK_QUESTIONS[type])
    this.currentQuestion = raw.question
    this.currentWord = raw.word
    // Shuffle answer order each time so players (and CPUs) can't learn a key pattern.
    const order = raw.answers.map((_, i) => i)
    Phaser.Utils.Array.Shuffle(order)
    const q: QuestionData = {
      question: raw.question,
      answers: order.map(i => raw.answers[i]),
      correct: order.indexOf(raw.correct),
      explanation: raw.explanation,
    }
    const player = state.players[playerIndex]

    // Deep environment wash
    // Below the card (depth 40+) so the answer buttons stay clickable and tappable.
    createDimmer(this, 0.78).setDepth(39)

    const panelW = 920
    const panelH = 520
    const borderColor = type === 'vocab' ? COLORS.sky : COLORS.warning
    const cardTex = type === 'vocab'
      ? TEXTURE_KEYS.kenneyCardBlue
      : TEXTURE_KEYS.kenneyCardGreen
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
    const headerLabel = type === 'vocab' ? (custom ? `📝 ${customList!.name.toUpperCase()}` : 'VOCABULARY QUESTION') : 'GRAMMAR QUESTION'
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

    this.add.text(w / 2, h / 2 - 140, isTouchPreferred(this.sys.game) ? 'Tap an answer' : 'Keys: 1–4 or A–D', {
      fontSize: '14px',
      fontFamily: FONT.body,
      color: hexColor(COLORS.mute),
    }).setOrigin(0.5).setDepth(45)

    this.tweens.add({ targets: header, alpha: 1, duration: isAutoSimMode() ? 30 : 300, delay: isAutoSimMode() ? 0 : 200 })

    // Top-anchored under the key hint; long prompts (e.g. custom example sentences) shrink to fit
    // the space above the answers instead of spilling over the header.
    const qText = this.add.text(w / 2, h / 2 - 126, q.question, {
      fontSize: '24px',
      fontFamily: FONT.body,
      color: '#ffffff',
      wordWrap: { width: 820 },
      align: 'center',
    }).setOrigin(0.5, 0).setAlpha(0).setDepth(45)
    for (const size of [21, 18, 16]) {
      if (qText.height <= 116) break
      qText.setFontSize(size)
    }
    this.tweens.add({ targets: qText, alpha: 1, duration: isAutoSimMode() ? 30 : 400, delay: isAutoSimMode() ? 0 : 300 })

    const answerColors = [COLORS.skyDeep, COLORS.coral, COLORS.mint, COLORS.warning]
    const labels = ['A', 'B', 'C', 'D']
    let answered = false
    let secondsLeft = 15
    /** Set once the timer is built; clears it away when the question is answered. */
    let hideTimer = () => {}

    const pickAnswer = (i: number, btn: Phaser.GameObjects.Container | null) => {
      if (answered) return
      answered = true
      countdownTimer?.remove()
      timerBarTween?.stop()
      hideTimer()
      const correct = i === q.correct
      const timeBonus = correct ? Math.max(1, Math.ceil(secondsLeft / 3)) : 0
      const speedSurge = correct && secondsLeft >= 10
      // Highlight correct (green) and picked wrong (red) buttons
      this.answerContainers.forEach((c, idx) => {
        if (idx === q.correct) setButtonFill(c, COLORS.mint)
        else if (idx === i && !correct) setButtonFill(c, COLORS.danger)
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
      // Long answers: wrap and shrink so text never spills past the button.
      const label = btn.list.find(c => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined
      if (label) {
        label.setWordWrapWidth(350).setAlign('center')
        const len = ans.length + 3
        label.setFontSize(len > 44 ? 15 : len > 32 ? 18 : 22)
      }
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

    const countdownTimer = this.time.addEvent({
      delay: isAutoSimMode() ? 60 : 1000,
      repeat: 14,
      callback: () => {
        secondsLeft--
        countdownText.setText(String(secondsLeft))
        if (secondsLeft <= 5) {
          if (!answered && secondsLeft > 0) Sfx.warn()
          countdownText.setColor('#ff3333')
          this.tweens.add({
            targets: countdownText,
            scaleX: 1.4, scaleY: 1.4,
            duration: 100, yoyo: true,
            ease: 'Bounce.easeInOut'
          })
          if (!shouldReduceMotion()) this.cameras.main.shake(100, 0.005)
        }
        else if (secondsLeft <= 10) countdownText.setColor('#ff8800')
      }
    })

    hideTimer = () => {
      this.tweens.add({ targets: [timerTrack, timerBar, countdownText], alpha: 0, duration: 200 })
    }

    const timerBarTween = this.tweens.add({
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
        hideTimer()
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
      Sfx.correct()
      showConfetti(this)
      if (!shouldReduceMotion()) this.cameras.main.flash(400, 100, 255, 100)

      if (speedSurge) {
        // Speed surge particle burst
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2
          this.time.delayedCall(i * 20, () => {
            const bolt = this.add.text(w / 2 + Math.cos(angle) * 30, h / 2 + Math.sin(angle) * 30, '⚡', {
              fontSize: '24px'
            }).setOrigin(0.5).setAlpha(1).setDepth(202)
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

      const banner = this.add.container(w / 2, h / 2 - 92).setDepth(200)
      const bg = this.add.rectangle(0, 0, w, 112, COLORS.mint, 0.55)
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
      Sfx.wrong()
      if (!shouldReduceMotion()) {
        this.cameras.main.shake(300, 0.01)
        this.cameras.main.flash(300, 255, 0, 0, true)
      }
      
      const banner = this.add.container(w / 2, h / 2 - 92).setDepth(200)
      const bg = this.add.rectangle(0, 0, w, 112, COLORS.danger, 0.55)
      const txt = this.add.text(0, 0, 'WRONG', {
        fontSize: '78px', fontFamily: FONT.display, color: '#ffffff', stroke: '#440000', strokeThickness: 10
      }).setOrigin(0.5)
      banner.add([bg, txt]).setScale(3).setAlpha(0)
      this.tweens.add({ targets: banner, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, ease: 'Expo.easeOut' })
    }

    if (explanation) {
      this.time.delayedCall(this.d(300), () => {
        // Above the card and dimmer, on its own plate over the (finished) timer bar.
        this.add.text(w / 2, h / 2 + 225, `💡 ${explanation}`, {
          fontSize: '18px',
          fontFamily: 'Fredoka, Arial',
          color: '#ffffaa',
          backgroundColor: '#0b1222',
          padding: { x: 14, y: 8 },
          wordWrap: { width: 820 },
          align: 'center'
        }).setOrigin(0.5).setDepth(202)
      })
    }

    // Leave time to read the explanation, longest after a miss (that's when it teaches most).
    const readMs = explanation ? (correct ? 3000 : 4200) : 2200
    this.time.delayedCall(this.d(readMs), () => onComplete({
      correct,
      timeBonus,
      speedSurge: correct && speedSurge,
      question: this.currentQuestion,
      explanation,
      word: this.currentWord,
    }))
  }
}
