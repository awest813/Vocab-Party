import Phaser from 'phaser'

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb'

export interface LexWord {
  word: string
  pos: PartOfSpeech
  definition: string
  synonyms: string[]
  antonyms: string[]
  sentence: string
}

export interface AffixItem {
  kind: 'prefix' | 'suffix'
  affix: string
  base: string
  word: string
  definition: string
  distractors: string[]
}

export interface SpellingItem {
  correct: string
  misspellings: string[]
}

export interface RootItem {
  root: string
  meaning: string
  example: string
  distractors: string[]
}

export interface LegacyChoiceItem {
  prompt: string
  choices: string[]
  correct: number
}

interface LexiconJson {
  words?: LexWord[]
  affixes?: AffixItem[]
  spelling?: SpellingItem[]
  roots?: RootItem[]
}

/** Small built-in fallback so every minigame still works if lexicon.json fails to load. */
const FALLBACK_WORDS: LexWord[] = [
  { word: 'rapid', pos: 'adjective', definition: 'happening very quickly', synonyms: ['fast', 'quick', 'swift'], antonyms: ['slow'], sentence: 'The river grew rapid after the storm.' },
  { word: 'fragile', pos: 'adjective', definition: 'easily broken or damaged', synonyms: ['delicate', 'brittle', 'frail'], antonyms: ['sturdy'], sentence: 'Pack the fragile vase with extra paper.' },
  { word: 'enormous', pos: 'adjective', definition: 'extremely large', synonyms: ['huge', 'giant', 'massive'], antonyms: ['tiny'], sentence: 'An enormous whale rose beside the boat.' },
  { word: 'courage', pos: 'noun', definition: 'the ability to face fear', synonyms: ['bravery', 'valor', 'nerve'], antonyms: ['cowardice'], sentence: 'It took courage to sing on stage.' },
  { word: 'journey', pos: 'noun', definition: 'a long trip from one place to another', synonyms: ['trip', 'voyage', 'expedition'], antonyms: ['stay'], sentence: 'Their journey crossed three states.' },
  { word: 'mystery', pos: 'noun', definition: 'something hard to explain', synonyms: ['puzzle', 'riddle', 'enigma'], antonyms: ['answer'], sentence: 'The missing cookies were a mystery.' },
  { word: 'shout', pos: 'verb', definition: 'to say something very loudly', synonyms: ['yell', 'holler', 'bellow'], antonyms: ['whisper'], sentence: 'Fans shout when their team scores.' },
  { word: 'gather', pos: 'verb', definition: 'to bring things together', synonyms: ['collect', 'assemble', 'amass'], antonyms: ['scatter'], sentence: 'We gather shells along the beach.' },
  { word: 'repair', pos: 'verb', definition: 'to make something work again', synonyms: ['fix', 'mend', 'restore'], antonyms: ['break'], sentence: 'Dad will repair the squeaky door.' },
  { word: 'quietly', pos: 'adverb', definition: 'without making much noise', synonyms: ['softly', 'silently', 'hushedly'], antonyms: ['loudly'], sentence: 'She closed the door quietly.' },
  { word: 'eagerly', pos: 'adverb', definition: 'with strong excitement and interest', synonyms: ['keenly', 'avidly', 'zealously'], antonyms: ['reluctantly'], sentence: 'The kids eagerly opened the box.' },
  { word: 'rarely', pos: 'adverb', definition: 'not very often', synonyms: ['seldom', 'infrequently', 'hardly'], antonyms: ['often'], sentence: 'It rarely snows in the desert.' },
]

const FALLBACK_SPELLING: SpellingItem[] = [
  { correct: 'necessary', misspellings: ['neccessary', 'necesary', 'neccesary'] },
  { correct: 'separate', misspellings: ['seperate', 'separete', 'seperete'] },
  { correct: 'definitely', misspellings: ['definately', 'definitly', 'defanitely'] },
  { correct: 'receive', misspellings: ['recieve', 'receeve', 'recive'] },
]

const FALLBACK_AFFIXES: AffixItem[] = [
  { kind: 'prefix', affix: 'un', base: 'happy', word: 'unhappy', definition: 'not happy', distractors: ['dis', 'mis', 'pre'] },
  { kind: 'prefix', affix: 're', base: 'build', word: 'rebuild', definition: 'build again', distractors: ['un', 'dis', 'non'] },
  { kind: 'suffix', affix: 'less', base: 'fear', word: 'fearless', definition: 'without fear', distractors: ['ful', 'ness', 'ly'] },
  { kind: 'suffix', affix: 'ful', base: 'hope', word: 'hopeful', definition: 'full of hope', distractors: ['less', 'ment', 'ist'] },
]

const FALLBACK_ROOTS: RootItem[] = [
  { root: 'bio', meaning: 'life', example: 'biology', distractors: ['water', 'earth', 'light'] },
  { root: 'tele', meaning: 'far', example: 'telescope', distractors: ['near', 'sound', 'write'] },
  { root: 'graph', meaning: 'write', example: 'autograph', distractors: ['see', 'hear', 'carry'] },
]

/**
 * Shuffled no-repeat decks shared across minigames for the whole browser session,
 * so the same prompt doesn't come back until the deck is exhausted.
 */
const decks = new Map<string, { order: number[]; i: number; size: number }>()

function drawIndex(key: string, size: number): number {
  let d = decks.get(key)
  if (!d || d.size !== size || d.i >= d.order.length) {
    const order = Array.from({ length: size }, (_, i) => i)
    Phaser.Utils.Array.Shuffle(order)
    // Avoid an immediate repeat across deck boundaries.
    if (d && d.order.length > 1 && order[0] === d.order[d.order.length - 1]) {
      order.push(order.shift()!)
    }
    d = { order, i: 0, size }
    decks.set(key, d)
  }
  return d.order[d.i++]
}

/** Next item from a session-wide no-repeat deck keyed by `key`. */
export function drawFromDeck<T>(key: string, items: readonly T[]): T {
  return items[drawIndex(key, items.length)]
}

export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  Phaser.Utils.Array.Shuffle(copy)
  return copy
}

export function pickDistinct<T>(items: readonly T[], n: number, exclude: (t: T) => boolean = () => false): T[] {
  return shuffled(items.filter(t => !exclude(t))).slice(0, n)
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'with', 'by', 'at', 'from', 'as', 'that', 'is', 'be',
  'not', 'very', 'way', 'something', 'someone', 'thing', 'things', 'person', 'people', 'others', 'other', 'into',
  'about', 'being', 'having', 'make', 'manner', 'state', 'quality', 'act', 'done', 'way', 'without', 'full', 'more',
  'than', 'one', 'it', 'its', 'your', 'their', 'who', 'what', 'when', 'how', 'out', 'up', 'too', 'so', 'much', 'can',
])

const tokenCache = new Map<string, Set<string>>()
/** Meaningful words of a definition, lightly stemmed (immense/immensely → immens). */
function contentTokens(def: string): Set<string> {
  let t = tokenCache.get(def)
  if (t) return t
  t = new Set(
    def.toLowerCase().split(/[^a-z]+/)
      .filter(x => x.length > 2 && !STOPWORDS.has(x))
      .map(x => x.replace(/(ly|ness|ing|ed|es|s|e)$/, ''))
      .filter(x => x.length > 2),
  )
  tokenCache.set(def, t)
  return t
}

/** Typed, fault-tolerant access to every word/grammar bank the minigames draw from. */
export class ContentBank {
  readonly words: LexWord[]
  readonly affixes: AffixItem[]
  readonly spelling: SpellingItem[]
  readonly roots: RootItem[]
  readonly contextClues: LegacyChoiceItem[]
  readonly homophones: LegacyChoiceItem[]
  readonly antonyms: LegacyChoiceItem[]
  readonly synonyms: LegacyChoiceItem[]
  readonly grammarFix: LegacyChoiceItem[]

  constructor(cache: Phaser.Cache.CacheManager) {
    const lex = (cache.json.get('lexicon') ?? {}) as LexiconJson
    const vocab = (cache.json.get('vocab') ?? {}) as Record<string, unknown[]>
    const grammar = (cache.json.get('grammar') ?? {}) as Record<string, unknown[]>

    const validWords = (lex.words ?? []).filter(w =>
      w && typeof w.word === 'string' && Array.isArray(w.synonyms) && w.synonyms.length > 0 && typeof w.definition === 'string')
    this.words = validWords.length >= 12 ? validWords : FALLBACK_WORDS
    this.affixes = (lex.affixes?.length ?? 0) >= 4 ? lex.affixes! : FALLBACK_AFFIXES
    this.spelling = (lex.spelling?.length ?? 0) >= 4 ? lex.spelling! : FALLBACK_SPELLING
    this.roots = (lex.roots?.length ?? 0) >= 3 ? lex.roots! : FALLBACK_ROOTS

    type Raw = { sentence?: string; prompt?: string; word?: string; choices?: string[]; correct?: number; correct_index?: number }
    const asChoice = (raw: unknown[] | undefined, promptOf: (r: Raw) => string | undefined): LegacyChoiceItem[] =>
      (raw ?? []).flatMap(r => {
        const item = r as Raw
        const prompt = promptOf(item)
        const correct = item.correct_index ?? item.correct
        if (!prompt || !Array.isArray(item.choices) || typeof correct !== 'number') return []
        if (correct < 0 || correct >= item.choices.length) return []
        return [{ prompt, choices: item.choices, correct }]
      })

    this.contextClues = asChoice(vocab.minigame_context_clues, r => r.sentence)
    this.homophones = asChoice(vocab.minigame_homophones, r => r.prompt)
    this.antonyms = asChoice(vocab.minigame_antonyms, r => r.word)
    this.synonyms = asChoice(vocab.minigame_synonyms, r => r.word)
    this.grammarFix = [
      ...asChoice(grammar.minigame_sentence_fix, r => r.prompt),
      ...asChoice(grammar.minigame_comma, () => 'Which sentence uses commas correctly?'),
    ]
  }

  /** Next item from a session-wide no-repeat deck. */
  draw<T>(key: string, items: readonly T[]): T {
    return items[drawIndex(key, items.length)]
  }

  word(filter?: (w: LexWord) => boolean): LexWord {
    if (!filter) return this.draw('words', this.words)
    const pool = this.words.filter(filter)
    return pool.length > 0 ? this.draw(`words:${pool.length}`, pool) : this.draw('words', this.words)
  }

  /**
   * Words that are safe distractors for `w`: no shared synonyms, and no shared
   * content words in their definitions (so "vast" never gets "immensely" as a wrong answer).
   */
  unrelatedTo(w: LexWord, n: number, filter?: (x: LexWord) => boolean): LexWord[] {
    const related = new Set([w.word, ...w.synonyms, ...w.antonyms])
    const defTokens = contentTokens(w.definition)
    const isRelated = (x: LexWord) =>
      x.word === w.word
      || related.has(x.word)
      || x.synonyms.some(s => related.has(s) || s === w.word)
      || x.antonyms.includes(w.word)
      || [...contentTokens(x.definition)].some(t => defTokens.has(t))
    const strict = pickDistinct(this.words, n, x => (filter ? !filter(x) : false) || isRelated(x))
    if (strict.length >= n) return strict
    // Very small banks: relax the filter rather than return too few distractors.
    const extra = pickDistinct(this.words, n - strict.length, x => isRelated(x) && x.word !== w.word && !strict.includes(x))
    return [...strict, ...extra.filter(x => !related.has(x.word))]
  }
}
