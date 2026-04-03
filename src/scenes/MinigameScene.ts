import Phaser from 'phaser'
import { GameState } from '../systems/GameState'
import { showConfetti } from '../ui/Confetti'
import { createButton } from '../ui/Button'

interface MinigameSceneData {
  state: GameState
  onComplete: (winnerId: number) => void
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

export class MinigameScene extends Phaser.Scene {
  constructor() { super('MinigameScene') }

  create(data: MinigameSceneData) {
    const w = this.scale.width
    const h = this.scale.height
    const { state, onComplete } = data

    const games = ['context-clue', 'comma-crisis', 'parts-of-speech', 'synonym-blitz', 'sentence-fix']
    const chosen = Phaser.Utils.Array.GetRandom(games) as string

    // Announcement screen
    this.add.rectangle(0, 0, w, h, 0x000000, 0.8).setOrigin(0)

    const names: Record<string, string> = {
      'context-clue': '🔍 CONTEXT CLUE CLASH',
      'comma-crisis': '😱 COMMA CRISIS',
      'parts-of-speech': '🗣️ PARTS OF SPEECH PANIC',
      'synonym-blitz': '⚡ SYNONYM BLITZ',
      'sentence-fix': '✨ SENTENCE FIX SHOWDOWN'
    }

    const announce = this.add.text(w / 2, h / 2 - 100, '🕹️ MINIGAME TIME!', {
      fontSize: '56px',
      fontFamily: 'Arial Black',
      color: '#FFD700',
      stroke: '#884400',
      strokeThickness: 8
    }).setOrigin(0.5).setScale(0)

    this.tweens.add({ targets: announce, scaleX: 1, scaleY: 1, duration: 500, ease: 'Back.easeOut' })

    const nameText = this.add.text(w / 2, h / 2, names[chosen], {
      fontSize: '38px',
      fontFamily: 'Arial Black',
      color: '#ff88ff',
      stroke: '#440044',
      strokeThickness: 6
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({ targets: nameText, alpha: 1, y: h / 2 + 10, duration: 400, delay: 600 })

    let count = 3
    const countText = this.add.text(w / 2, h / 2 + 120, '', {
      fontSize: '80px',
      fontFamily: 'Arial Black',
      color: '#ffffff'
    }).setOrigin(0.5)

    const doCount = () => {
      if (count > 0) {
        countText.setText(String(count))
        countText.setScale(2)
        this.tweens.add({ targets: countText, scaleX: 1, scaleY: 1, duration: 500, ease: 'Back.easeIn' })
        count--
        this.time.delayedCall(1000, doCount)
      } else {
        countText.setText('GO!')
        countText.setScale(2)
        this.tweens.add({ targets: countText, scaleX: 1, scaleY: 1, duration: 300 })
        this.time.delayedCall(600, () => this.launchMinigame(chosen, state, onComplete))
      }
    }
    this.time.delayedCall(1200, doCount)
  }

  launchMinigame(type: string, state: GameState, onComplete: (winnerId: number) => void) {
    this.children.removeAll(true)
    const w = this.scale.width
    const h = this.scale.height

    this.add.rectangle(0, 0, w, h, 0x0d1b2a).setOrigin(0)

    switch (type) {
      case 'context-clue': this.playContextClue(state, onComplete); break
      case 'comma-crisis': this.playCommaCrisis(state, onComplete); break
      case 'parts-of-speech': this.playPartsOfSpeech(state, onComplete); break
      case 'synonym-blitz': this.playSynonymBlitz(state, onComplete); break
      case 'sentence-fix': this.playSentenceFix(state, onComplete); break
    }
  }

  playContextClue(state: GameState, onComplete: (winnerId: number) => void) {
    const w = this.scale.width
    const h = this.scale.height
    const questions = (this.cache.json.get('vocab') as { minigame_context_clues?: ContextClueQuestion[] })
      .minigame_context_clues ?? []

    const fallbackContext: ContextClueQuestion = {
      sentence: 'The scientist made an important _____ that changed how we understand the universe.',
      word: 'discovery',
      choices: ['discovery', 'confusion', 'mistake', 'question'],
      correct: 0
    }
    const q: ContextClueQuestion = questions.length > 0
      ? (Phaser.Utils.Array.GetRandom(questions) as ContextClueQuestion)
      : fallbackContext

    this.add.text(w / 2, 60, '🔍 CONTEXT CLUE CLASH', {
      fontSize: '36px', fontFamily: 'Arial Black', color: '#FFD700', stroke: '#664400', strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, 130, 'Fill in the blank using context clues!', {
      fontSize: '22px', fontFamily: 'Arial', color: '#aaccff'
    }).setOrigin(0.5)

    this.add.text(w / 2, 240, q.sentence, {
      fontSize: '26px', fontFamily: 'Arial', color: '#ffffff',
      wordWrap: { width: 1000 }, align: 'center', lineSpacing: 10
    }).setOrigin(0.5)

    let done = false

    const cols = 2
    q.choices.forEach((choice: string, ci: number) => {
      const col = ci % cols
      const row = Math.floor(ci / cols)
      const bx = w / 2 + (col === 0 ? -260 : 260)
      const by = 380 + row * 100
      const btn = createButton(this, bx, by, choice, 0x224488, 0x112255, 440, 70)
      btn.on('pointerdown', () => {
        if (done) return
        done = true
        const correct = ci === q.correct
        if (correct) {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0x44aa44)
          showConfetti(this)
          this.add.text(w / 2, h - 100, `✅ CORRECT! "${q.word}" wins!`, {
            fontSize: '32px', fontFamily: 'Arial Black', color: '#44ff88', stroke: '#004400', strokeThickness: 5
          }).setOrigin(0.5)
          this.time.delayedCall(2000, () => onComplete(state.currentPlayer))
        } else {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0xaa2222)
          this.cameras.main.shake(200, 0.008)
          this.add.text(w / 2, h - 100, '❌ Wrong! Try again...', {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ff4444'
          }).setOrigin(0.5)
          done = false
        }
      })
    })

    const timerBar = this.add.rectangle(w / 2 - 500, h - 40, 1000, 10, 0x44ff88).setOrigin(0, 0.5)
    this.add.rectangle(w / 2, h - 40, 1000, 14, 0x333355).setStrokeStyle(2, 0xffffff)
    this.tweens.add({
      targets: timerBar, width: 0, duration: 20000, ease: 'Linear',
      onComplete: () => {
        if (!done) {
          done = true
          this.add.text(w / 2, h - 100, "⏱️ Time's up! No winner.", {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ffcc44'
          }).setOrigin(0.5)
          this.time.delayedCall(1500, () => onComplete(-1))
        }
      }
    })
  }

  playCommaCrisis(state: GameState, onComplete: (winnerId: number) => void) {
    const w = this.scale.width
    const h = this.scale.height
    const questions = (this.cache.json.get('grammar') as { minigame_comma?: CommaCrisisQuestion[] })
      .minigame_comma ?? []

    const fallbackComma: CommaCrisisQuestion = {
      sentence: 'Before you leave please turn off the lights and close the door.',
      correct: 'Before you leave, please turn off the lights, and close the door.',
      choices: [
        'Before you leave please turn off the lights and close the door.',
        'Before you leave, please turn off the lights, and close the door.',
        'Before, you leave please turn off the lights and close, the door.',
        'Before you leave please, turn off the lights and close the door.'
      ],
      correct_index: 1
    }
    const q: CommaCrisisQuestion = questions.length > 0
      ? (Phaser.Utils.Array.GetRandom(questions) as CommaCrisisQuestion)
      : fallbackComma

    this.add.text(w / 2, 60, '😱 COMMA CRISIS', {
      fontSize: '36px', fontFamily: 'Arial Black', color: '#ff8844', stroke: '#442200', strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, 130, 'Choose the sentence with correct comma placement!', {
      fontSize: '22px', fontFamily: 'Arial', color: '#ffccaa'
    }).setOrigin(0.5)

    let done = false
    q.choices.forEach((choice: string, ci: number) => {
      const by = 260 + ci * 105
      const btn = createButton(this, w / 2, by, choice, 0x442200, 0x221100, 1000, 80)
      btn.on('pointerdown', () => {
        if (done) return
        done = true
        const correct = ci === q.correct_index
        if (correct) {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0x44aa44)
          showConfetti(this)
          this.add.text(w / 2, h - 80, '✅ PERFECT PUNCTUATION!', {
            fontSize: '32px', fontFamily: 'Arial Black', color: '#44ff88', stroke: '#004400', strokeThickness: 5
          }).setOrigin(0.5)
          this.time.delayedCall(2000, () => onComplete(state.currentPlayer))
        } else {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0xaa2222)
          this.cameras.main.shake(200, 0.008)
          this.add.text(w / 2, h - 80, '❌ Comma Crisis!', {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ff4444'
          }).setOrigin(0.5)
          done = false
        }
      })
    })

    const timerBar = this.add.rectangle(w / 2 - 500, h - 30, 1000, 10, 0xff8844).setOrigin(0, 0.5)
    this.add.rectangle(w / 2, h - 30, 1000, 14, 0x333355).setStrokeStyle(2, 0xffffff)
    this.tweens.add({
      targets: timerBar, width: 0, duration: 20000, ease: 'Linear',
      onComplete: () => {
        if (!done) {
          done = true
          this.add.text(w / 2, h - 80, "⏱️ Time's up! No winner.", {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ffcc44'
          }).setOrigin(0.5)
          this.time.delayedCall(1500, () => onComplete(-1))
        }
      }
    })
  }

  playPartsOfSpeech(state: GameState, onComplete: (winnerId: number) => void) {
    const w = this.scale.width
    const h = this.scale.height
    const questions = (this.cache.json.get('grammar') as { minigame_pos?: PartsOfSpeechQuestion[] })
      .minigame_pos ?? []

    const fallbackPos: PartsOfSpeechQuestion = {
      word: 'QUICKLY',
      sentence: 'She ran quickly to catch the bus.',
      choices: ['Noun', 'Verb', 'Adjective', 'Adverb'],
      correct: 3
    }
    const q: PartsOfSpeechQuestion = questions.length > 0
      ? (Phaser.Utils.Array.GetRandom(questions) as PartsOfSpeechQuestion)
      : fallbackPos

    this.add.text(w / 2, 60, '🗣️ PARTS OF SPEECH PANIC', {
      fontSize: '36px', fontFamily: 'Arial Black', color: '#ff44ff', stroke: '#440044', strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, 130, 'What part of speech is the highlighted word?', {
      fontSize: '22px', fontFamily: 'Arial', color: '#ffaaff'
    }).setOrigin(0.5)

    const wordDisplay = this.add.text(w / 2, 220, q.word, {
      fontSize: '80px', fontFamily: 'Arial Black', color: '#FFD700',
      stroke: '#664400', strokeThickness: 8
    }).setOrigin(0.5)
    this.tweens.add({ targets: wordDisplay, scaleX: 1.1, scaleY: 1.1, duration: 600, yoyo: true, repeat: -1 })

    this.add.text(w / 2, 310, `"${q.sentence}"`, {
      fontSize: '22px', fontFamily: 'Arial', color: '#ccccff',
      wordWrap: { width: 900 }, align: 'center', fontStyle: 'italic'
    }).setOrigin(0.5)

    const posColors = [0x3355cc, 0xcc3333, 0x33aa33, 0xcc8800]
    let done = false
    q.choices.forEach((choice: string, ci: number) => {
      const col = ci % 2
      const row = Math.floor(ci / 2)
      const bx = w / 2 + (col === 0 ? -230 : 230)
      const by = 430 + row * 100
      const btn = createButton(this, bx, by, choice, posColors[ci], posColors[ci] - 0x112211, 380, 70)
      btn.on('pointerdown', () => {
        if (done) return
        done = true
        const correct = ci === q.correct
        if (correct) {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0x44aa44)
          showConfetti(this)
          this.add.text(w / 2, h - 80, `✅ Correct! It's a ${choice}!`, {
            fontSize: '32px', fontFamily: 'Arial Black', color: '#44ff88', stroke: '#004400', strokeThickness: 5
          }).setOrigin(0.5)
          this.time.delayedCall(2000, () => onComplete(state.currentPlayer))
        } else {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0xaa2222)
          this.cameras.main.shake(200, 0.008)
          this.add.text(w / 2, h - 80, '❌ Wrong Part of Speech!', {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ff4444'
          }).setOrigin(0.5)
          done = false
        }
      })
    })

    const timerBar = this.add.rectangle(w / 2 - 500, h - 30, 1000, 10, 0xff44ff).setOrigin(0, 0.5)
    this.add.rectangle(w / 2, h - 30, 1000, 14, 0x333355).setStrokeStyle(2, 0xffffff)
    this.tweens.add({
      targets: timerBar, width: 0, duration: 20000, ease: 'Linear',
      onComplete: () => {
        if (!done) {
          done = true
          this.add.text(w / 2, h - 80, "⏱️ Time's up! No winner.", {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ffcc44'
          }).setOrigin(0.5)
          this.time.delayedCall(1500, () => onComplete(-1))
        }
      }
    })
  }

  playSynonymBlitz(state: GameState, onComplete: (winnerId: number) => void) {
    const w = this.scale.width
    const h = this.scale.height
    const questions = (this.cache.json.get('vocab') as { minigame_synonyms?: SynonymBlitzQuestion[] })
      .minigame_synonyms ?? []

    const fallbackSynonym: SynonymBlitzQuestion = {
      word: 'rapid',
      choices: ['fast', 'slow', 'heavy', 'quiet'],
      correct: 0
    }
    const q: SynonymBlitzQuestion = questions.length > 0
      ? (Phaser.Utils.Array.GetRandom(questions) as SynonymBlitzQuestion)
      : fallbackSynonym

    this.add.text(w / 2, 60, '⚡ SYNONYM BLITZ', {
      fontSize: '36px', fontFamily: 'Arial Black', color: '#66ddff', stroke: '#003344', strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, 130, 'Tap the word that means almost the same thing!', {
      fontSize: '22px', fontFamily: 'Arial', color: '#aeeeff'
    }).setOrigin(0.5)

    this.add.text(w / 2, 240, q.word.toUpperCase(), {
      fontSize: '72px', fontFamily: 'Arial Black', color: '#ffffff',
      stroke: '#224466', strokeThickness: 8
    }).setOrigin(0.5)

    let done = false
    const cols = 2
    q.choices.forEach((choice: string, ci: number) => {
      const col = ci % cols
      const row = Math.floor(ci / cols)
      const bx = w / 2 + (col === 0 ? -260 : 260)
      const by = 400 + row * 100
      const btn = createButton(this, bx, by, choice, 0x116688, 0x003344, 440, 70)
      btn.on('pointerdown', () => {
        if (done) return
        done = true
        const correct = ci === q.correct
        if (correct) {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0x44aa44)
          showConfetti(this)
          this.add.text(w / 2, h - 100, `✅ Great match — "${choice}"!`, {
            fontSize: '32px', fontFamily: 'Arial Black', color: '#44ff88', stroke: '#004400', strokeThickness: 5
          }).setOrigin(0.5)
          this.time.delayedCall(2000, () => onComplete(state.currentPlayer))
        } else {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0xaa2222)
          this.cameras.main.shake(200, 0.008)
          this.add.text(w / 2, h - 100, '❌ Not quite — try another!', {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ff4444'
          }).setOrigin(0.5)
          done = false
        }
      })
    })

    const timerBar = this.add.rectangle(w / 2 - 500, h - 40, 1000, 10, 0x44ddff).setOrigin(0, 0.5)
    this.add.rectangle(w / 2, h - 40, 1000, 14, 0x333355).setStrokeStyle(2, 0xffffff)
    this.tweens.add({
      targets: timerBar, width: 0, duration: 20000, ease: 'Linear',
      onComplete: () => {
        if (!done) {
          done = true
          this.add.text(w / 2, h - 100, "⏱️ Time's up! No winner.", {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ffcc44'
          }).setOrigin(0.5)
          this.time.delayedCall(1500, () => onComplete(-1))
        }
      }
    })
  }

  playSentenceFix(state: GameState, onComplete: (winnerId: number) => void) {
    const w = this.scale.width
    const h = this.scale.height
    const questions = (this.cache.json.get('grammar') as { minigame_sentence_fix?: SentenceFixQuestion[] })
      .minigame_sentence_fix ?? []

    const fallbackSentenceFix: SentenceFixQuestion = {
      prompt: 'Which sentence is written correctly?',
      choices: [
        'Me and him went to the store.',
        'He and I went to the store.',
        'Him and I went to the store.',
        'Me and he went to the store.'
      ],
      correct_index: 1
    }
    const q: SentenceFixQuestion = questions.length > 0
      ? (Phaser.Utils.Array.GetRandom(questions) as SentenceFixQuestion)
      : fallbackSentenceFix

    this.add.text(w / 2, 55, '✨ SENTENCE FIX SHOWDOWN', {
      fontSize: '34px', fontFamily: 'Arial Black', color: '#88ffcc', stroke: '#114433', strokeThickness: 6
    }).setOrigin(0.5)

    this.add.text(w / 2, 118, q.prompt, {
      fontSize: '22px', fontFamily: 'Arial', color: '#ccffee',
      wordWrap: { width: 980 }, align: 'center'
    }).setOrigin(0.5)

    let done = false
    q.choices.forEach((choice: string, ci: number) => {
      const by = 200 + ci * 105
      const btn = createButton(this, w / 2, by, choice, 0x1a4d40, 0x0a2a22, 1000, 78)
      btn.on('pointerdown', () => {
        if (done) return
        done = true
        const correct = ci === q.correct_index
        if (correct) {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0x44aa44)
          showConfetti(this)
          this.add.text(w / 2, h - 78, '✅ Perfect grammar!', {
            fontSize: '32px', fontFamily: 'Arial Black', color: '#44ff88', stroke: '#004400', strokeThickness: 5
          }).setOrigin(0.5)
          this.time.delayedCall(2000, () => onComplete(state.currentPlayer))
        } else {
          const btnBg = btn.getAt(0) as Phaser.GameObjects.Rectangle
          if (btnBg) btnBg.setFillStyle(0xaa2222)
          this.cameras.main.shake(200, 0.008)
          this.add.text(w / 2, h - 78, '❌ That sentence needs work!', {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ff4444'
          }).setOrigin(0.5)
          done = false
        }
      })
    })

    const timerBar = this.add.rectangle(w / 2 - 500, h - 30, 1000, 10, 0x66ffcc).setOrigin(0, 0.5)
    this.add.rectangle(w / 2, h - 30, 1000, 14, 0x333355).setStrokeStyle(2, 0xffffff)
    this.tweens.add({
      targets: timerBar, width: 0, duration: 20000, ease: 'Linear',
      onComplete: () => {
        if (!done) {
          done = true
          this.add.text(w / 2, h - 78, "⏱️ Time's up! No winner.", {
            fontSize: '28px', fontFamily: 'Arial Black', color: '#ffcc44'
          }).setOrigin(0.5)
          this.time.delayedCall(1500, () => onComplete(-1))
        }
      }
    })
  }
}
