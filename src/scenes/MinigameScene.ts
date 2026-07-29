import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { showConfetti } from '../ui/Confetti'
import { createButton, setButtonEnabled, setButtonFill } from '../ui/Button'
import type { CpuLevel } from '../systems/CpuPolicy'
import { simulateCpuMinigameGuesses } from '../systems/CpuPolicy'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import { COLORS } from '../ui/Theme'

interface MinigameSceneData {
  state: GameState
  onComplete: (winnerId: number) => void
  /** Skip UI and pick a random winner (biased toward current player). */
  cpuMode?: boolean
  /** Used with `cpuMode` for board-question-style difficulty scaling. */
  cpuLevel?: CpuLevel
}

interface ContextClueQuestion {
  sentence: string
  word: string
  choices: string[]
  correct: number
}

interface CommaCrisisQuestion {
  sentence: string
  correct: string
  choices: string[]
  correct_index: number
}

interface PartsOfSpeechQuestion {
  word: string
  sentence: string
  choices: string[]
  correct: number
}

interface SynonymBlitzQuestion {
  word: string
  choices: string[]
  correct: number
}

interface SentenceFixQuestion {
  prompt: string
  choices: string[]
  correct_index: number
}

interface AntonymQuestion {
  word: string
  choices: string[]
  correct: number
}

interface HomophoneQuestion {
  prompt: string
  choices: string[]
  correct: number
}

type MinigameId =
  | 'context-clue'
  | 'comma-crisis'
  | 'parts-of-speech'
  | 'synonym-blitz'
  | 'sentence-fix'
  | 'antonym-attack'
  | 'homophone-hunt'

const MINIGAME_META: Record<MinigameId, { title: string; accent: number; tip: string }> = {
  'context-clue': { title: '🔍 CONTEXT CLUE CLASH', accent: COLORS.skyBtn, tip: 'Fill in the blank using context clues!' },
  'comma-crisis': { title: '😱 COMMA CRISIS', accent: COLORS.warning, tip: 'Pick the sentence with correct commas.' },
  'parts-of-speech': { title: '🗣️ PARTS OF SPEECH', accent: 0xff5cad, tip: 'What part of speech is the highlighted word?' },
  'synonym-blitz': { title: '⚡ SYNONYM BLITZ', accent: COLORS.sky, tip: 'Pick the word that means almost the same thing!' },
  'sentence-fix': { title: '✨ SENTENCE FIX', accent: COLORS.party, tip: 'Choose the best-written sentence.' },
  'antonym-attack': { title: '🔄 ANTONYM ATTACK', accent: 0xb45cff, tip: 'Pick the OPPOSITE of the word below!' },
  'homophone-hunt': { title: '🔊 HOMOPHONE HUNT', accent: COLORS.teal, tip: 'Choose the correct word for the blank.' },
}

const ALL_MINIGAMES: MinigameId[] = [
  'context-clue',
  'comma-crisis',
  'parts-of-speech',
  'synonym-blitz',
  'sentence-fix',
  'antonym-attack',
  'homophone-hunt',
]

interface QuizSpec {
  id: MinigameId
  prompt: string
  promptSize?: number
  detail?: string
  choices: string[]
  correct: number
  layout: 'grid' | 'stack'
  success: (choice: string) => string
  fail: string
}

export class MinigameScene extends Phaser.Scene {
  private choiceKeyCleanup?: () => void
  private minigameData!: MinigameSceneData
  private feedbackText?: Phaser.GameObjects.Text
  private timerTween?: Phaser.Tweens.Tween

  constructor() { super('MinigameScene') }

  private d(ms: number) {
    return scaleAutoSimDelay(ms)
  }

  private clearChoiceKeys() {
    this.choiceKeyCleanup?.()
    this.choiceKeyCleanup = undefined
  }

  /** Map 1–4 / A–D / numpad to choice index 0..3 */
  private registerChoiceKeys(numChoices: number, onPick: (index: number) => void) {
    this.clearChoiceKeys()
    const keyToIndex: Record<string, number> = {
      Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
      Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3,
      KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3
    }
    const handler = (ev: KeyboardEvent) => {
      const idx = keyToIndex[ev.code]
      if (idx === undefined || idx >= numChoices) return
      ev.preventDefault()
      onPick(idx)
    }
    this.input.keyboard?.on('keydown', handler)
    this.choiceKeyCleanup = () => this.input.keyboard?.off('keydown', handler)
  }

  private shuffleChoices(choices: string[], correct: number): { choices: string[]; correct: number } {
    const order = choices.map((_, i) => i)
    Phaser.Utils.Array.Shuffle(order)
    return {
      choices: order.map(i => choices[i]),
      correct: order.indexOf(correct),
    }
  }

  private setFeedback(message: string, color: string) {
    this.feedbackText?.destroy()
    const h = this.scale.height
    this.feedbackText = this.add.text(this.scale.width / 2, h - 78, message, {
      fontSize: '24px',
      fontFamily: 'Fredoka, Arial Black',
      color,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(50)
  }

  private paintBackdrop() {
    const w = this.scale.width
    const h = this.scale.height
    this.add.rectangle(0, 0, w, h, 0x0a1020).setOrigin(0)
    const g = this.add.graphics()
    g.fillGradientStyle(0x1a2a4a, 0x1a2a4a, 0x050510, 0x050510, 0.35)
    g.fillRect(0, 0, w, h)
  }

  create(data: MinigameSceneData) {
    this.minigameData = data
    this.feedbackText = undefined
    this.timerTween = undefined
    const { state, onComplete, cpuMode, cpuLevel } = data

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearChoiceKeys()
      this.timerTween?.stop()
    })

    if (cpuMode) {
      const { currentPlayerWins, totalDelayMs } = simulateCpuMinigameGuesses(Phaser.Math, cpuLevel)
      const winnerId = state.players.length > 0 && currentPlayerWins ? state.currentPlayer : -1
      const wait = this.d(Math.max(400, totalDelayMs))
      this.time.delayedCall(Math.max(24, wait), () => onComplete(winnerId))
      return
    }

    const chosen = Phaser.Utils.Array.GetRandom(ALL_MINIGAMES) as MinigameId
    this.showIntro(chosen)
  }

  private showIntro(chosen: MinigameId) {
    const w = this.scale.width
    const h = this.scale.height
    const { state } = this.minigameData
    const meta = MINIGAME_META[chosen]
    const player = state.players[state.currentPlayer]

    this.paintBackdrop()

    Sfx.splash()

    const panel = this.add.container(w / 2, h / 2 - 20)
    const bg = this.add.rectangle(0, 0, 820, 280, 0x0a1528, 0.9)
    bg.setStrokeStyle(3, meta.accent, 0.65)
    const glow = this.add.rectangle(0, -138, 812, 4, meta.accent, 0.85)

    const eyebrow = this.add.text(0, -95, '🕹️ MINIGAME', {
      fontSize: '22px', fontFamily: 'Fredoka, Arial', color: '#aaccff'
    }).setOrigin(0.5)

    const title = this.add.text(0, -35, meta.title, {
      fontSize: '40px', fontFamily: 'Fredoka, Arial Black', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6, align: 'center', wordWrap: { width: 760 }
    }).setOrigin(0.5)

    const byline = this.add.text(0, 45, `${player?.emoji ?? ''} ${player?.name ?? 'Player'} takes the challenge`, {
      fontSize: '20px', fontFamily: 'Fredoka, Arial', color: '#ffcce8'
    }).setOrigin(0.5)

    const tip = this.add.text(0, 90, meta.tip, {
      fontSize: '18px', fontFamily: 'Fredoka, Arial', color: '#88aacc',
      wordWrap: { width: 700 }, align: 'center'
    }).setOrigin(0.5)

    panel.add([bg, glow, eyebrow, title, byline, tip])
    panel.setScale(0.92).setAlpha(0)
    this.tweens.add({
      targets: panel, scaleX: 1, scaleY: 1, alpha: 1,
      duration: this.d(280), ease: 'Cubic.easeOut'
    })
    if (!shouldReduceMotion()) this.cameras.main.flash(this.d(220), 255, 68, 170, true)

    const countText = this.add.text(w / 2, h / 2 + 190, '', {
      fontSize: '72px', fontFamily: 'Fredoka, Arial Black', color: '#ffffff',
      stroke: '#000000', strokeThickness: 8
    }).setOrigin(0.5)

    let count = isAutoSimMode() ? 0 : 3
    const tick = () => {
      if (count > 0) {
        countText.setText(String(count))
        countText.setScale(1.6).setColor('#ffffff')
        this.tweens.add({ targets: countText, scaleX: 1, scaleY: 1, duration: this.d(280), ease: 'Back.easeOut' })
        count--
        this.time.delayedCall(this.d(700), tick)
      } else {
        countText.setText('GO!')
        countText.setColor('#44ff88')
        countText.setScale(1.35)
        this.time.delayedCall(this.d(380), () => {
          panel.destroy(true)
          countText.destroy()
          this.launchMinigame(chosen)
        })
      }
    }
    this.time.delayedCall(this.d(isAutoSimMode() ? 40 : 650), tick)
  }

  private launchMinigame(type: MinigameId) {
    this.clearChoiceKeys()
    this.children.removeAll(true)
    this.feedbackText = undefined
    this.paintBackdrop()

    const { state, onComplete } = this.minigameData
    switch (type) {
      case 'context-clue': this.playContextClue(state, onComplete); break
      case 'comma-crisis': this.playCommaCrisis(state, onComplete); break
      case 'parts-of-speech': this.playPartsOfSpeech(state, onComplete); break
      case 'synonym-blitz': this.playSynonymBlitz(state, onComplete); break
      case 'sentence-fix': this.playSentenceFix(state, onComplete); break
      case 'antonym-attack': this.playAntonymAttack(state, onComplete); break
      case 'homophone-hunt': this.playHomophoneHunt(state, onComplete); break
    }
  }

  /** Shared multiple-choice runner used by every minigame. */
  private playQuiz(spec: QuizSpec, state: GameState, onComplete: (winnerId: number) => void) {
    const w = this.scale.width
    const h = this.scale.height
    const meta = MINIGAME_META[spec.id]
    const shuffled = this.shuffleChoices(spec.choices, spec.correct)
    const q = { ...spec, choices: shuffled.choices, correct: shuffled.correct }

    this.add.text(w / 2, 48, meta.title, {
      fontSize: '34px', fontFamily: 'Fredoka, Arial Black', color: '#FFD700',
      stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, 92, meta.tip, {
      fontSize: '18px', fontFamily: 'Fredoka, Arial', color: '#aaccff'
    }).setOrigin(0.5)

    const promptY = q.detail ? 168 : 200
    this.add.text(w / 2, promptY, q.prompt, {
      fontSize: `${q.promptSize ?? (q.layout === 'stack' ? 26 : 56)}px`,
      fontFamily: 'Fredoka, Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
      wordWrap: { width: 1000 },
      align: 'center'
    }).setOrigin(0.5)

    if (q.detail) {
      this.add.text(w / 2, 250, q.detail, {
        fontSize: '20px', fontFamily: 'Fredoka, Arial', color: '#c8d8ff',
        fontStyle: 'italic', wordWrap: { width: 920 }, align: 'center'
      }).setOrigin(0.5)
    }

    const labels = ['A', 'B', 'C', 'D']
    const choiceButtons: Phaser.GameObjects.Container[] = []
    const eliminated = new Set<number>()
    let resolved = false

    const finish = (winnerId: number, delayMs: number) => {
      resolved = true
      this.clearChoiceKeys()
      this.timerTween?.stop()
      this.time.delayedCall(this.d(delayMs), () => onComplete(winnerId))
    }

    const onChoice = (ci: number) => {
      if (resolved || eliminated.has(ci)) return
      const btn = choiceButtons[ci]
      if (!btn) return
      const correct = ci === q.correct

      if (correct) {
        setButtonFill(btn, 0x22aa44)
        Sfx.correct()
        showConfetti(this)
        this.setFeedback(q.success(q.choices[ci]), '#44ff88')
        choiceButtons.forEach((b, i) => {
          if (i !== ci) setButtonEnabled(b, false)
        })
        finish(state.currentPlayer, 1600)
      } else {
        eliminated.add(ci)
        setButtonFill(btn, 0xaa2222)
        setButtonEnabled(btn, false)
        Sfx.wrong()
        if (!shouldReduceMotion()) this.cameras.main.shake(this.d(160), 0.007)
        this.setFeedback(q.fail, '#ff7777')
        // Keep keyboard live for remaining options
        this.registerChoiceKeys(q.choices.length, (idx) => onChoice(idx))
      }
    }

    q.choices.forEach((choice, ci) => {
      let bx: number
      let by: number
      let bw: number
      let bh: number
      if (q.layout === 'stack') {
        bx = w / 2
        by = (q.detail ? 330 : 255) + ci * 86
        bw = 1040
        bh = 70
      } else {
        const col = ci % 2
        const row = Math.floor(ci / 2)
        bx = w / 2 + (col === 0 ? -260 : 260)
        by = (q.detail ? 355 : 330) + row * 92
        bw = 460
        bh = 70
      }

      const long = choice.length > 42
      const btn = createButton(this, bx, by, `${labels[ci]}  ${choice}`, meta.accent, meta.accent - 0x111111, bw, bh)
      const label = btn.list.find(c => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined
      if (label) {
        label.setStyle({
          fontSize: long ? '15px' : '19px',
          wordWrap: { width: bw - 36 },
          align: 'center',
        })
      }
      choiceButtons.push(btn)
      btn.on('pointerdown', () => onChoice(ci))
    })

    this.registerChoiceKeys(q.choices.length, (ci) => onChoice(ci))

    this.add.text(w / 2, h - 48, isTouchPreferred(this.sys.game)
      ? 'Tap an answer  ·  Wrong answers stay out'
      : 'Keys: 1–4 or A–D  ·  Wrong answers stay out', {
      fontSize: '14px', fontFamily: 'Fredoka, Arial', color: '#6688aa'
    }).setOrigin(0.5)

    const track = this.add.rectangle(w / 2, h - 24, 1000, 14, 0x333355).setStrokeStyle(2, 0xffffff, 0.35)
    const timerBar = this.add.rectangle(w / 2 - 500, h - 24, 1000, 10, meta.accent).setOrigin(0, 0.5)
    void track
    this.timerTween = this.tweens.add({
      targets: timerBar,
      width: 0,
      duration: this.d(18000),
      ease: 'Linear',
      onComplete: () => {
        if (resolved) return
        this.setFeedback("⏱️ Time's up — no winner this round.", '#ffcc44')
        choiceButtons.forEach(b => setButtonEnabled(b, false))
        finish(-1, 1200)
      }
    })
  }

  playContextClue(state: GameState, onComplete: (winnerId: number) => void) {
    const questions = (this.cache.json.get('vocab') as { minigame_context_clues?: ContextClueQuestion[] })
      .minigame_context_clues ?? []
    const fallback: ContextClueQuestion = {
      sentence: 'The scientist made an important _____ that changed how we understand the universe.',
      word: 'discovery',
      choices: ['discovery', 'confusion', 'mistake', 'question'],
      correct: 0
    }
    const raw = questions.length > 0 ? Phaser.Utils.Array.GetRandom(questions) as ContextClueQuestion : fallback
    this.playQuiz({
      id: 'context-clue',
      prompt: raw.sentence,
      promptSize: 28,
      choices: raw.choices,
      correct: raw.correct,
      layout: 'grid',
      success: () => `✅ Correct — "${raw.word}" fits the clue!`,
      fail: '❌ Not quite — use the sentence clues and try again!',
    }, state, onComplete)
  }

  playCommaCrisis(state: GameState, onComplete: (winnerId: number) => void) {
    const questions = (this.cache.json.get('grammar') as { minigame_comma?: CommaCrisisQuestion[] })
      .minigame_comma ?? []
    const fallback: CommaCrisisQuestion = {
      sentence: 'Before you leave please turn off the lights and close the door.',
      correct: 'Before you leave, please turn off the lights and close the door.',
      choices: [
        'Before you leave please turn off the lights and close the door.',
        'Before you leave, please turn off the lights and close the door.',
        'Before, you leave please turn off the lights and close, the door.',
        'Before you leave please, turn off the lights and close the door.'
      ],
      correct_index: 1
    }
    const raw = questions.length > 0 ? Phaser.Utils.Array.GetRandom(questions) as CommaCrisisQuestion : fallback
    this.playQuiz({
      id: 'comma-crisis',
      prompt: 'Which sentence uses commas correctly?',
      promptSize: 24,
      detail: `Starter: “${raw.sentence}”`,
      choices: raw.choices,
      correct: raw.correct_index,
      layout: 'stack',
      success: () => '✅ Perfect punctuation!',
      fail: '❌ Comma crisis — try another option!',
    }, state, onComplete)
  }

  playPartsOfSpeech(state: GameState, onComplete: (winnerId: number) => void) {
    const questions = (this.cache.json.get('grammar') as { minigame_pos?: PartsOfSpeechQuestion[] })
      .minigame_pos ?? []
    const fallback: PartsOfSpeechQuestion = {
      word: 'QUICKLY',
      sentence: 'She ran quickly to catch the bus.',
      choices: ['Noun', 'Verb', 'Adjective', 'Adverb'],
      correct: 3
    }
    const raw = questions.length > 0 ? Phaser.Utils.Array.GetRandom(questions) as PartsOfSpeechQuestion : fallback
    this.playQuiz({
      id: 'parts-of-speech',
      prompt: raw.word,
      promptSize: 64,
      detail: `"${raw.sentence}"`,
      choices: raw.choices,
      correct: raw.correct,
      layout: 'grid',
      success: (choice) => `✅ Yes — "${raw.word}" is a ${choice}!`,
      fail: '❌ Wrong part of speech — try again!',
    }, state, onComplete)
  }

  playSynonymBlitz(state: GameState, onComplete: (winnerId: number) => void) {
    const questions = (this.cache.json.get('vocab') as { minigame_synonyms?: SynonymBlitzQuestion[] })
      .minigame_synonyms ?? []
    const fallback: SynonymBlitzQuestion = {
      word: 'rapid',
      choices: ['fast', 'slow', 'heavy', 'quiet'],
      correct: 0
    }
    const raw = questions.length > 0 ? Phaser.Utils.Array.GetRandom(questions) as SynonymBlitzQuestion : fallback
    this.playQuiz({
      id: 'synonym-blitz',
      prompt: raw.word.toUpperCase(),
      promptSize: 64,
      choices: raw.choices,
      correct: raw.correct,
      layout: 'grid',
      success: (choice) => `✅ Great match — "${choice}"!`,
      fail: '❌ Not a synonym — try another!',
    }, state, onComplete)
  }

  playSentenceFix(state: GameState, onComplete: (winnerId: number) => void) {
    const questions = (this.cache.json.get('grammar') as { minigame_sentence_fix?: SentenceFixQuestion[] })
      .minigame_sentence_fix ?? []
    const fallback: SentenceFixQuestion = {
      prompt: 'Which sentence is written correctly?',
      choices: [
        'Me and him went to the store.',
        'He and I went to the store.',
        'Him and I went to the store.',
        'Me and he went to the store.'
      ],
      correct_index: 1
    }
    const raw = questions.length > 0 ? Phaser.Utils.Array.GetRandom(questions) as SentenceFixQuestion : fallback
    this.playQuiz({
      id: 'sentence-fix',
      prompt: raw.prompt,
      promptSize: 24,
      choices: raw.choices,
      correct: raw.correct_index,
      layout: 'stack',
      success: () => '✅ Perfect grammar!',
      fail: '❌ That sentence needs work — try again!',
    }, state, onComplete)
  }

  playAntonymAttack(state: GameState, onComplete: (winnerId: number) => void) {
    const questions = (this.cache.json.get('vocab') as { minigame_antonyms?: AntonymQuestion[] })
      .minigame_antonyms ?? []
    const fallback: AntonymQuestion = {
      word: 'hot',
      choices: ['boiling', 'cold', 'warm', 'toasty'],
      correct: 1
    }
    const raw = questions.length > 0 ? Phaser.Utils.Array.GetRandom(questions) as AntonymQuestion : fallback
    this.playQuiz({
      id: 'antonym-attack',
      prompt: raw.word.toUpperCase(),
      promptSize: 64,
      choices: raw.choices,
      correct: raw.correct,
      layout: 'grid',
      success: (choice) => `✅ Opposite locked — "${choice}"!`,
      fail: '❌ Not the opposite — try again!',
    }, state, onComplete)
  }

  playHomophoneHunt(state: GameState, onComplete: (winnerId: number) => void) {
    const questions = (this.cache.json.get('vocab') as { minigame_homophones?: HomophoneQuestion[] })
      .minigame_homophones ?? []
    const fallback: HomophoneQuestion = {
      prompt: '_____ going to the store later.',
      choices: ["They're", 'Their', 'There', 'Thier'],
      correct: 0
    }
    const raw = questions.length > 0 ? Phaser.Utils.Array.GetRandom(questions) as HomophoneQuestion : fallback
    this.playQuiz({
      id: 'homophone-hunt',
      prompt: raw.prompt,
      promptSize: 30,
      choices: raw.choices,
      correct: raw.correct,
      layout: 'grid',
      success: (choice) => `✅ Perfect fit — "${choice}"!`,
      fail: '❌ Wrong homophone — try again!',
    }, state, onComplete)
  }
}
