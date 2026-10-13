import { COLORS } from '../../ui/Theme'
import { pickDistinct, shuffled, type LexWord } from '../ContentBank'
import { runRapidFire, type RapidQuestion } from '../RapidFire'
import type { MinigameContext, MinigameDef } from '../types'
import { speakWord } from '../speech'

const RAPID_CONTROLS = { keys: 'Keys 1–4 or click', touch: 'Tap an answer' }

function blankOut(sentence: string, word: string): string | null {
  const idx = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (idx < 0) return null
  return `${sentence.slice(0, idx)}_____${sentence.slice(idx + word.length)}`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const definitionDash: MinigameDef = {
  id: 'definition-dash',
  title: 'Definition Dash',
  icon: '📘',
  accent: COLORS.skyBtn,
  category: 'Vocabulary',
  tagline: 'Match words and meanings at top speed.',
  howTo: [
    'A word or a definition flashes up — pick its match.',
    'Every right answer is +1. Four in a row earns a bonus.',
    'Misses cost you time while the answer is shown.',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 30000,
  cpu: { easy: [3, 6], normal: [6, 9], hard: [9, 13] },
  start(ctx: MinigameContext) {
    let n = 0
    return runRapidFire(ctx, (): RapidQuestion => {
      const w = ctx.bank.word()
      const others = ctx.bank.unrelatedTo(w, 3)
      n++
      if (n % 3 === 0) {
        return {
          kicker: 'WHICH WORD MEANS…',
          prompt: `“${w.definition}”`,
          choices: [w.word, ...others.map(o => o.word)],
          correct: 0,
          word: w.word,
          note: w.definition,
        }
      }
      return {
        kicker: 'WHAT DOES IT MEAN?',
        prompt: w.word,
        choices: [w.definition, ...others.map(o => o.definition)].map(cap),
        correct: 0,
        layout: 'stack',
        word: w.word,
        note: w.definition,
      }
    })
  },
}

export const oddOneOut: MinigameDef = {
  id: 'odd-one-out',
  title: 'Odd One Out',
  icon: '🧩',
  accent: 0xb45cff,
  category: 'Vocabulary',
  tagline: 'Three words are related. One is an impostor.',
  howTo: [
    'Three of the four words mean nearly the same thing.',
    'Find the word that does NOT belong.',
    'Speed and streaks win the round.',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 30000,
  cpu: { easy: [3, 6], normal: [6, 9], hard: [9, 13] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const w = ctx.bank.word(x => x.synonyms.length >= 2, 'odd')
      const group = shuffled([w.word, ...w.synonyms]).slice(0, 3)
      const impostor = ctx.bank.unrelatedTo(w, 1, x => x.pos === w.pos)[0] ?? ctx.bank.unrelatedTo(w, 1)[0]
      return {
        kicker: 'WHICH WORD DOESN’T BELONG?',
        prompt: '🔍 Find the impostor',
        promptSize: 34,
        choices: [impostor.word, ...group],
        correct: 0,
        word: w.word,
        note: `${group.join(', ')} all mean “${w.definition}”`,
      }
    })
  },
}

export const spellingBee: MinigameDef = {
  id: 'spelling-bee',
  title: 'Spelling Bee',
  icon: '🐝',
  accent: COLORS.gold,
  category: 'Spelling',
  tagline: 'Tricky words. One right spelling. Buzz in!',
  howTo: [
    'Four spellings appear — only one is correct.',
    'Commonly misspelled words: trust your eyes!',
    'Sound on? Each word is read aloud.',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 30000,
  cpu: { easy: [4, 7], normal: [7, 10], hard: [10, 14] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const item = ctx.bank.draw('spelling', ctx.bank.spelling)
      speakWord(item.correct)
      return {
        kicker: 'PICK THE CORRECT SPELLING',
        prompt: '🐝 Which one is right?',
        promptSize: 34,
        choices: [item.correct, ...item.misspellings.slice(0, 3)],
        correct: 0,
        word: item.correct,
        note: `spelled ${item.correct.toUpperCase().split('').join('-')}`,
      }
    })
  },
}

export const antonymAttack: MinigameDef = {
  id: 'antonym-attack',
  title: 'Antonym Attack',
  icon: '🔄',
  accent: COLORS.coral,
  category: 'Vocabulary',
  tagline: 'Flip it! Find the opposite before the clock does.',
  howTo: [
    'Pick the word that means the OPPOSITE.',
    'Watch out — synonyms are hiding as traps!',
    'Four right in a row earns a bonus point.',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 30000,
  cpu: { easy: [4, 7], normal: [7, 10], hard: [10, 14] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const legacy = ctx.bank.antonyms
      if (legacy.length > 0 && Math.random() < 0.25) {
        const item = ctx.bank.draw('legacy-antonyms', legacy)
        return { kicker: 'OPPOSITE OF…', prompt: item.prompt.toUpperCase(), choices: item.choices, correct: item.correct, word: item.prompt }
      }
      const w = ctx.bank.word(x => x.antonyms.length > 0, 'antonym')
      const trap = pickDistinct(w.synonyms, 1)
      const filler = ctx.bank.unrelatedTo(w, 3 - trap.length).map(o => o.word)
      return {
        kicker: 'OPPOSITE OF…',
        prompt: w.word.toUpperCase(),
        choices: [w.antonyms[0], ...trap, ...filler],
        correct: 0,
        word: w.word,
        note: `opposite: ${w.antonyms[0]}`,
      }
    })
  },
}

export const contextClues: MinigameDef = {
  id: 'context-clues',
  title: 'Context Clues',
  icon: '🔎',
  accent: COLORS.teal,
  category: 'Vocabulary',
  tagline: 'Read the sentence. Crack the missing word.',
  howTo: [
    'A sentence is missing a word.',
    'Use the clues around the blank to choose it.',
    'Read carefully — misses cost time!',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 35000,
  cpu: { easy: [3, 5], normal: [5, 8], hard: [8, 11] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const legacy = ctx.bank.contextClues
      if (legacy.length > 0 && Math.random() < 0.3) {
        const item = ctx.bank.draw('legacy-context', legacy)
        return { kicker: 'FILL IN THE BLANK', prompt: item.prompt, promptSize: 28, choices: item.choices, correct: item.correct }
      }
      let w: LexWord = ctx.bank.word()
      let blanked = blankOut(w.sentence, w.word)
      for (let tries = 0; !blanked && tries < 6; tries++) {
        w = ctx.bank.word()
        blanked = blankOut(w.sentence, w.word)
      }
      const others = ctx.bank.unrelatedTo(w, 3, x => x.pos === w.pos)
      const fill = others.length === 3 ? others : ctx.bank.unrelatedTo(w, 3)
      return {
        kicker: 'FILL IN THE BLANK',
        prompt: blanked ?? w.definition,
        promptSize: 28,
        choices: [w.word, ...fill.map(o => o.word)],
        correct: 0,
        word: w.word,
        note: w.definition,
      }
    })
  },
}

export const rootDetective: MinigameDef = {
  id: 'root-detective',
  title: 'Root Detective',
  icon: '🌱',
  accent: COLORS.mint,
  category: 'Word Parts',
  tagline: 'Greek and Latin roots unlock thousands of words.',
  howTo: [
    'A word root appears with an example word.',
    'Pick what the root means.',
    'Use the example word as your clue!',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 30000,
  cpu: { easy: [3, 6], normal: [6, 9], hard: [9, 12] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const r = ctx.bank.draw('roots', ctx.bank.roots)
      return {
        kicker: 'WHAT DOES THIS ROOT MEAN?',
        prompt: r.root.toUpperCase(),
        detail: `as in “${r.example}”`,
        choices: [r.meaning, ...r.distractors.slice(0, 3)],
        correct: 0,
        word: `${r.root}-`,
        note: `means “${r.meaning}” (${r.example})`,
      }
    })
  },
}

export const prefixFactory: MinigameDef = {
  id: 'prefix-factory',
  title: 'Prefix Factory',
  icon: '🏭',
  accent: COLORS.warning,
  category: 'Word Parts',
  tagline: 'Bolt the right prefix or suffix onto the base word.',
  howTo: [
    'A base word and a meaning roll down the line.',
    'Pick the prefix or suffix that builds the word.',
    'Build as many words as you can!',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 30000,
  cpu: { easy: [4, 7], normal: [7, 10], hard: [10, 13] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const a = ctx.bank.draw('affixes', ctx.bank.affixes)
      const isPrefix = a.kind === 'prefix'
      return {
        kicker: isPrefix ? 'ADD A PREFIX' : 'ADD A SUFFIX',
        prompt: isPrefix ? `▢▢ + ${a.base}` : `${a.base} + ▢▢`,
        detail: `to mean “${a.definition}”`,
        choices: [a.affix, ...a.distractors.slice(0, 3)].map(s => (isPrefix ? `${s}-` : `-${s}`)),
        correct: 0,
        word: a.word,
        note: `${a.word} = ${a.definition}`,
      }
    })
  },
}

export const homophoneHunt: MinigameDef = {
  id: 'homophone-hunt',
  title: 'Homophone Hunt',
  icon: '🔊',
  accent: 0x3ec7ff,
  category: 'Spelling',
  tagline: 'Sound-alike words, very different meanings.',
  howTo: [
    'Each sentence has a blank.',
    'Pick the sound-alike word that fits.',
    'their / there / they’re — know the difference!',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 30000,
  cpu: { easy: [4, 7], normal: [7, 10], hard: [10, 13] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const item = ctx.bank.homophones.length > 0
        ? ctx.bank.draw('homophones', ctx.bank.homophones)
        : { prompt: '_____ going to the store later.', choices: ["They're", 'Their', 'There', 'Thier'], correct: 0 }
      return { kicker: 'WHICH WORD FITS?', prompt: item.prompt, promptSize: 30, choices: item.choices, correct: item.correct }
    })
  },
}

export const grammarGauntlet: MinigameDef = {
  id: 'grammar-gauntlet',
  title: 'Grammar Gauntlet',
  icon: '✏️',
  accent: 0xff5cad,
  category: 'Grammar',
  tagline: 'Commas, agreement, pronouns: pick the polished one.',
  howTo: [
    'Several versions of a sentence appear.',
    'Choose the one that is written correctly.',
    'Fewer questions, bigger brains.',
  ],
  controls: RAPID_CONTROLS,
  durationMs: 40000,
  cpu: { easy: [2, 4], normal: [4, 6], hard: [6, 9] },
  start(ctx) {
    return runRapidFire(ctx, () => {
      const item = ctx.bank.grammarFix.length > 0
        ? ctx.bank.draw('grammar', ctx.bank.grammarFix)
        : { prompt: 'Which sentence is written correctly?', choices: ['Me and him went.', 'He and I went.', 'Him and I went.', 'Me and he went.'], correct: 1 }
      return { kicker: 'PICK THE CORRECT SENTENCE', prompt: item.prompt, promptSize: 26, choices: item.choices, correct: item.correct, layout: 'stack' }
    }, { missPauseMs: 1500 })
  },
}
