/**
 * Teacher mode: custom word lists ("this week's vocabulary") saved on this device.
 * Stored in localStorage under `vocab-party-word-lists`.
 *
 * A list only drives gameplay when it is the active list, has at least
 * MIN_PLAYABLE_WORDS words with definitions, and the Word Level setting is 'custom'.
 */
import { getSettings, setSettings, WORD_LEVEL_LABEL, WORD_LEVEL_ORDER, type WordLevel } from './GameSettings'

export type ListPos = 'noun' | 'verb' | 'adjective' | 'adverb'

export interface WordEntry {
  word: string
  definition: string
  sentence?: string
  synonyms?: string[]
  antonyms?: string[]
  pos?: ListPos
}

export interface WordList {
  id: string
  name: string
  words: WordEntry[]
  /** The text the teacher typed or pasted, kept so editing round-trips exactly. */
  source: string
  updatedAt: number
}

interface WordListsData {
  version: 1
  lists: WordList[]
  activeId: string | null
}

/** Minimal lexicon shape used to auto-fill words the game already knows. */
export interface LexiconLike {
  word: string
  definition: string
  pos?: string
  synonyms?: string[]
  antonyms?: string[]
  sentence?: string
}

export const MIN_PLAYABLE_WORDS = 8
export const MAX_LISTS = 20
export const MAX_WORDS_PER_LIST = 60
export const MAX_NAME_LEN = 32
export const MAX_SOURCE_LEN = 12000
const MAX_WORD_LEN = 40
const MAX_DEF_LEN = 160
const MAX_SENTENCE_LEN = 200
const MAX_RELATED = 6

const KEY = 'vocab-party-word-lists'
const POS_VALUES: ListPos[] = ['noun', 'verb', 'adjective', 'adverb']
const POS_ALIASES: Record<string, ListPos> = {
  n: 'noun', noun: 'noun', 'n.': 'noun',
  v: 'verb', verb: 'verb', 'v.': 'verb',
  adj: 'adjective', 'adj.': 'adjective', adjective: 'adjective',
  adv: 'adverb', 'adv.': 'adverb', adverb: 'adverb',
}

// ——— Sanitizing ———

/** Collapse whitespace and strip control characters. */
function clean(s: unknown, max: number): string {
  if (typeof s !== 'string') return ''
  const printable = Array.from(s).map(ch => (ch < ' ' || ch === '\u007f' ? ' ' : ch)).join('')
  return Array.from(printable.replace(/\s+/g, ' ').trim()).slice(0, max).join('')
}

/** Lowercase ordinary words ("Photosynthesis" → "photosynthesis") but keep short acronyms like DNA. */
export function normalizeWord(raw: string): string {
  const w = clean(raw, MAX_WORD_LEN).replace(/^["'“”‘’]+|["'“”‘’.,;]+$/g, '').trim()
  if (/^[A-Z]{2,5}$/.test(w)) return w
  return w.toLowerCase()
}

const keyOf = (word: string) => word.trim().toLowerCase()

function cleanList(v: unknown): string[] | undefined {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[;/|,]/) : []
  const out = Array.from(new Set(arr.map(x => normalizeWord(String(x ?? ''))).filter(x => x.length > 0))).slice(0, MAX_RELATED)
  return out.length > 0 ? out : undefined
}

export function parsePos(v: unknown): ListPos | undefined {
  if (typeof v !== 'string') return undefined
  const k = v.trim().toLowerCase()
  return POS_ALIASES[k] ?? (POS_VALUES.includes(k as ListPos) ? k as ListPos : undefined)
}

function sanitizeEntry(raw: unknown): WordEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const word = normalizeWord(String(r.word ?? ''))
  if (!word || !/\p{L}/u.test(word)) return null
  const entry: WordEntry = { word, definition: clean(r.definition, MAX_DEF_LEN) }
  const sentence = clean(r.sentence, MAX_SENTENCE_LEN)
  if (sentence) entry.sentence = sentence
  const synonyms = cleanList(r.synonyms)?.filter(s => keyOf(s) !== keyOf(word))
  if (synonyms && synonyms.length > 0) entry.synonyms = synonyms
  const antonyms = cleanList(r.antonyms)?.filter(s => keyOf(s) !== keyOf(word))
  if (antonyms && antonyms.length > 0) entry.antonyms = antonyms
  const pos = parsePos(r.pos)
  if (pos) entry.pos = pos
  return entry
}

function sanitizeList(raw: unknown, seenIds: Set<string>): WordList | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  let id = typeof r.id === 'string' && /^[\w-]{1,40}$/.test(r.id) ? r.id : newId()
  while (seenIds.has(id)) id = newId()
  seenIds.add(id)
  const seenWords = new Set<string>()
  const words: WordEntry[] = []
  for (const w of Array.isArray(r.words) ? r.words : []) {
    const e = sanitizeEntry(w)
    if (!e || seenWords.has(keyOf(e.word))) continue
    seenWords.add(keyOf(e.word))
    words.push(e)
    if (words.length >= MAX_WORDS_PER_LIST) break
  }
  const name = clean(r.name, MAX_NAME_LEN) || 'My word list'
  const source = typeof r.source === 'string' ? r.source.slice(0, MAX_SOURCE_LEN) : serializeEntries(words)
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0
  return { id, name, words, source, updatedAt }
}

function sanitize(p: Partial<WordListsData> | null): WordListsData {
  const seen = new Set<string>()
  const lists = (Array.isArray(p?.lists) ? p!.lists : [])
    .map(l => sanitizeList(l, seen))
    .filter((l): l is WordList => l !== null)
    .slice(0, MAX_LISTS)
  const activeId = typeof p?.activeId === 'string' && lists.some(l => l.id === p.activeId) ? p.activeId : null
  return { version: 1, lists, activeId }
}

// ——— Storage ———

let cache: WordListsData | null = null

function load(): WordListsData {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WordListsData> | null
      if (parsed && typeof parsed === 'object' && parsed.version === 1) {
        cache = sanitize(parsed)
        return cache
      }
    }
  } catch {
    /* corrupt storage — start fresh */
  }
  cache = { version: 1, lists: [], activeId: null }
  return cache
}

function save(): void {
  if (!cache) return
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* storage full or unavailable — lists stay for this session */
  }
}

function newId(): string {
  return `wl-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function getWordLists(): WordList[] {
  return load().lists
}

export function getWordList(id: string | null | undefined): WordList | undefined {
  return id ? load().lists.find(l => l.id === id) : undefined
}

export function getActiveList(): WordList | undefined {
  return getWordList(load().activeId)
}

export function setActiveList(id: string | null): void {
  const d = load()
  d.activeId = id && d.lists.some(l => l.id === id) ? id : null
  save()
}

export function canCreateList(): boolean {
  return load().lists.length < MAX_LISTS
}

/** Create a list (null once MAX_LISTS is reached). */
export function createList(name: string, source = ''): WordList | null {
  const d = load()
  if (d.lists.length >= MAX_LISTS) return null
  const parsed = parseWordList(source)
  const list: WordList = {
    id: newId(),
    name: clean(name, MAX_NAME_LEN) || uniqueName('My word list'),
    words: parsed.entries,
    source: source.slice(0, MAX_SOURCE_LEN),
    updatedAt: Date.now(),
  }
  d.lists.push(list)
  save()
  return list
}

export function uniqueName(base: string): string {
  const names = new Set(load().lists.map(l => l.name.toLowerCase()))
  if (!names.has(base.toLowerCase())) return base
  for (let i = 2; i < 100; i++) {
    const n = `${base} ${i}`.slice(0, MAX_NAME_LEN)
    if (!names.has(n.toLowerCase())) return n
  }
  return base
}

export function renameList(id: string, name: string): void {
  const l = getWordList(id)
  const n = clean(name, MAX_NAME_LEN)
  if (!l || !n) return
  l.name = n
  l.updatedAt = Date.now()
  save()
}

/** Re-parse the pasted text and store the result. */
export function updateListSource(id: string, source: string): ParseResult | null {
  const l = getWordList(id)
  if (!l) return null
  const text = source.slice(0, MAX_SOURCE_LEN)
  const parsed = parseWordList(text)
  l.source = text
  l.words = parsed.entries
  l.updatedAt = Date.now()
  save()
  return parsed
}

export function deleteList(id: string): void {
  const d = load()
  d.lists = d.lists.filter(l => l.id !== id)
  // Deleting the active list leaves none active (the game falls back to All levels with a
  // message) rather than silently switching the class to some other list.
  if (d.activeId === id) d.activeId = null
  save()
}

let lexicon: ReadonlyMap<string, LexiconLike> = new Map()

/** Remember the built-in lexicon (from the Phaser JSON cache) so lists can auto-fill from it. */
export function setLexiconFromCache(cache: { json: { get(key: string): unknown } }): void {
  if (lexicon.size > 0) return
  const lex = cache.json.get('lexicon') as { words?: unknown } | undefined
  const words = Array.isArray(lex?.words) ? lex!.words as LexiconLike[] : []
  lexicon = lexiconMap(words.filter(w => w && typeof w.word === 'string' && typeof w.definition === 'string'))
}

export function getLexicon(): ReadonlyMap<string, LexiconLike> {
  return lexicon
}

/** Entries merged with lexicon data, keeping only words with a definition (the ones that can be played). */
export function playableEntries(list: WordList | undefined): (WordEntry & { fromLexicon: boolean })[] {
  return list ? list.words.map(w => enrichEntry(w, lexicon)).filter(w => w.definition.length > 0) : []
}

export function isListPlayable(list: WordList | undefined): boolean {
  return playableEntries(list).length >= MIN_PLAYABLE_WORDS
}

/** True when the game should use the teacher's words right now. */
export function isCustomWordsActive(): boolean {
  return getSettings().wordLevel === 'custom' && isListPlayable(getActiveList())
}

/** The active list when custom words are in play, else undefined. */
export function activeCustomList(): WordList | undefined {
  return isCustomWordsActive() ? getActiveList() : undefined
}

/** Word Level options for the Words toggles: the built-in levels, plus the active list when there is one. */
export function wordLevelCycle(): WordLevel[] {
  return getActiveList() ? [...WORD_LEVEL_ORDER, 'custom'] : [...WORD_LEVEL_ORDER]
}

/** Button label for a level ("📝 Science words" for the custom option). */
export function wordLevelLabel(level: WordLevel = getSettings().wordLevel): string {
  if (level !== 'custom') return WORD_LEVEL_LABEL[level]
  const list = getActiveList()
  return list && isListPlayable(list) ? `📝 ${list.name}` : WORD_LEVEL_LABEL.all
}

/**
 * Advance the Word Level setting. Returns a friendly message when the custom
 * option can't be used yet (and is skipped), else null.
 */
export function cycleWordLevel(): string | null {
  const cycle = wordLevelCycle()
  let cur = getSettings().wordLevel
  // An unplayable 'custom' setting already shows as "All levels", so cycle on from there.
  if (cur === 'custom' && playableEntries(getActiveList()).length < MIN_PLAYABLE_WORDS) cur = 'all'
  let next = cycle[(cycle.indexOf(cur) + 1) % cycle.length]
  let message: string | null = null
  if (next === 'custom') {
    const list = getActiveList()
    const n = playableEntries(list).length
    if (!list || n < MIN_PLAYABLE_WORDS) {
      message = `“${list?.name ?? 'Your list'}” needs at least ${MIN_PLAYABLE_WORDS} words with definitions (it has ${n}). Add more in Word Lists!`
      next = cycle[0]
    }
  }
  setSettings({ wordLevel: next })
  return message
}

/**
 * When the setting says 'custom' but no playable list is active (deleted, too short),
 * explain that All levels are used instead. Returns the message, or null when all is well.
 */
export function customFallbackMessage(): string | null {
  if (getSettings().wordLevel !== 'custom') return null
  const list = getActiveList()
  if (!list) return 'No word list is active, so All levels are in play. Pick one in Word Lists.'
  const n = playableEntries(list).length
  if (n < MIN_PLAYABLE_WORDS) return `“${list.name}” has ${n} playable words (needs ${MIN_PLAYABLE_WORDS}), so All levels are in play for now.`
  return null
}

/** Find a word in any saved list (Word Book details for words outside the lexicon). */
export function findListEntry(word: string): WordEntry | undefined {
  const k = keyOf(word)
  for (const l of load().lists) {
    const hit = l.words.find(w => keyOf(w.word) === k)
    if (hit) return hit
  }
  return undefined
}

/** Fill gaps from the built-in lexicon; the teacher's own text always wins. */
export function enrichEntry(e: WordEntry, lexicon: ReadonlyMap<string, LexiconLike>): WordEntry & { fromLexicon: boolean } {
  const lex = lexicon.get(keyOf(e.word))
  if (!lex) return { ...e, fromLexicon: false }
  return {
    word: e.word,
    definition: e.definition || clean(lex.definition, MAX_DEF_LEN),
    sentence: e.sentence ?? (lex.sentence || undefined),
    synonyms: e.synonyms ?? (lex.synonyms && lex.synonyms.length > 0 ? [...lex.synonyms] : undefined),
    antonyms: e.antonyms ?? (lex.antonyms && lex.antonyms.length > 0 ? [...lex.antonyms] : undefined),
    pos: e.pos ?? parsePos(lex.pos),
    fromLexicon: true,
  }
}

export function lexiconMap(words: readonly LexiconLike[]): Map<string, LexiconLike> {
  const m = new Map<string, LexiconLike>()
  for (const w of words) if (w && typeof w.word === 'string') m.set(keyOf(w.word), w)
  return m
}

// ——— Parsing pasted text ———

export interface ParseWarning {
  line: number
  message: string
}

export interface ParseResult {
  entries: WordEntry[]
  warnings: ParseWarning[]
}

/** Split one CSV/TSV row, honouring "quoted, cells". */
function splitDelimited(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"' && cur.trim() === '') {
      quoted = true
      cur = ''
    } else if (ch === delim) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

type Column = 'word' | 'definition' | 'sentence' | 'synonyms' | 'antonyms' | 'pos'
const HEADER_ALIASES: Record<string, Column> = {
  word: 'word', term: 'word', vocab: 'word', vocabulary: 'word',
  definition: 'definition', meaning: 'definition', def: 'definition',
  sentence: 'sentence', example: 'sentence', 'example sentence': 'sentence',
  synonyms: 'synonyms', synonym: 'synonyms',
  antonyms: 'antonyms', antonym: 'antonyms', opposites: 'antonyms',
  pos: 'pos', 'part of speech': 'pos', type: 'pos',
}

function headerColumns(line: string): { delim: string; cols: (Column | null)[] } | null {
  for (const delim of [',', '\t', ';']) {
    if (!line.includes(delim)) continue
    const cols = splitDelimited(line, delim).map(c => HEADER_ALIASES[c.toLowerCase().replace(/[^a-z ]/g, '').trim()] ?? null)
    if (cols.includes('word') && cols.includes('definition')) return { delim, cols }
  }
  return null
}

/** Strip list bullets and numbering: "1. ", "2) ", "- ", "• ". */
function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•·▪◦]+|\d{1,3}[.)]|[a-zA-Z][.)](?=\s))\s+/, '')
}

/** `word - definition`, `word: definition`, `word<TAB>definition`, `word = definition`, optional `| sentence`. */
function parseLine(line: string): Record<string, unknown> | null {
  const body = stripBullet(line).trim()
  if (!body) return null
  const [main, ...rest] = body.split('|')
  const sentence = rest.join('|').trim()
  const m = main.match(/^(.+?)(?:\t+|\s+[-–—]+\s+|\s*[:=]\s*|\s*[–—]\s*)(.*)$/)
  let word = (m ? m[1] : main).trim()
  let definition = (m ? m[2] : '').trim()
  let pos: string | undefined
  // "word (n.) - definition" or "word - (adj) definition"
  const wp = word.match(/^(.+?)\s*\((n|v|adj|adv|noun|verb|adjective|adverb)\.?\)$/i)
  if (wp) { word = wp[1]; pos = wp[2] }
  const dp = definition.match(/^\((n|v|adj|adv|noun|verb|adjective|adverb)\.?\)\s*(.*)$/i)
  if (dp) { pos = dp[1]; definition = dp[2] }
  return { word, definition, sentence, pos }
}

export function parseWordList(text: string): ParseResult {
  const lines = text.slice(0, MAX_SOURCE_LEN).split(/\r?\n/)
  const warnings: ParseWarning[] = []
  const entries: WordEntry[] = []
  const seen = new Set<string>()
  const firstIdx = lines.findIndex(l => l.trim().length > 0)
  const header = firstIdx >= 0 ? headerColumns(lines[firstIdx]) : null
  let capped = false

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1
    if (!rawLine.trim() || i === firstIdx && header) return
    if (/^\s*(#|\/\/)/.test(rawLine)) return
    let raw: Record<string, unknown> | null
    if (header) {
      const cells = splitDelimited(rawLine, header.delim)
      raw = {}
      header.cols.forEach((c, ci) => { if (c && cells[ci] !== undefined) raw![c] = cells[ci] })
    } else {
      raw = parseLine(rawLine)
    }
    if (!raw) return
    const rawWord = String(raw.word ?? '').trim()
    if (rawWord.length > MAX_WORD_LEN || rawWord.split(/\s+/).length > 4) {
      warnings.push({ line: lineNo, message: `Line ${lineNo}: couldn't find a word (try "word - definition")` })
      return
    }
    const e = sanitizeEntry(raw)
    if (!e) {
      warnings.push({ line: lineNo, message: `Line ${lineNo}: no word found` })
      return
    }
    if (seen.has(keyOf(e.word))) {
      warnings.push({ line: lineNo, message: `“${e.word}” is listed twice — the copy on line ${lineNo} is skipped` })
      return
    }
    if (entries.length >= MAX_WORDS_PER_LIST) {
      if (!capped) warnings.push({ line: lineNo, message: `Lists hold up to ${MAX_WORDS_PER_LIST} words — the rest are skipped` })
      capped = true
      return
    }
    seen.add(keyOf(e.word))
    entries.push(e)
  })
  return { entries, warnings }
}

/** Warnings that depend on the lexicon (missing definitions it can't fill). */
export function lexiconWarnings(entries: readonly WordEntry[]): string[] {
  const out: string[] = []
  for (const e of entries) {
    if (!e.definition && !lexicon.has(keyOf(e.word))) out.push(`“${e.word}” needs a definition — it won't appear until it has one`)
  }
  return out
}

/** Turn entries back into editable text (used when a stored list has no source). */
export function serializeEntries(words: readonly WordEntry[]): string {
  return words.map(w => `${w.word} - ${w.definition}${w.sentence ? ` | ${w.sentence}` : ''}`).join('\n')
}

// ——— Built-in samples ———

export interface SampleList {
  id: string
  icon: string
  name: string
  source: string
}

export const SAMPLE_LISTS: SampleList[] = [
  {
    id: 'science',
    icon: '🔬',
    name: 'Science words',
    source: [
      'orbit - the curved path one object takes around another in space | The moon follows an orbit around Earth.',
      'gravity - the force that pulls objects toward each other | Gravity makes a dropped apple fall to the ground.',
      'habitat - the natural home of a plant or animal | A pond is the perfect habitat for frogs.',
      'predator - an animal that hunts other animals for food | The hawk is a predator that hunts mice.',
      'erosion - the slow wearing away of land by wind or water | Ocean waves cause erosion along the cliffs.',
      'fossil - the hardened remains of a plant or animal from long ago | We found a fossil of a fern in the rock.',
      'evaporate - to change from a liquid into a gas | Puddles evaporate quickly on a sunny day.',
      'magnet - an object that pulls iron and steel toward it | The magnet picked up all the paper clips.',
      'eclipse - when one object in space blocks the light of another | Everyone wore special glasses to watch the eclipse.',
      'mammal - a warm-blooded animal that feeds its babies milk | A whale is a mammal, not a fish.',
      'hypothesis - a proposed explanation that can be tested',
      'evidence',
      'atom - the tiny building block that all matter is made of | Every atom is far too small to see.',
      'condense - to change from a gas into a liquid | Steam will condense on the cold mirror.',
    ].join('\n'),
  },
  {
    id: 'spooky',
    icon: '🎃',
    name: 'Spooky October words',
    source: [
      'eerie - strange and a little bit scary | The empty hallway was eerie at night.',
      'haunted - visited by ghosts, as the story goes | Legend says the old mill is haunted.',
      'cauldron - a large pot for cooking over a fire | The witch stirred soup in her cauldron.',
      'lantern - a lamp with a cover that you can carry | We carried a lantern on the night hike.',
      'harvest - the time of year when crops are gathered | Pumpkins are picked at harvest time.',
      'costume - clothes worn to look like someone or something else | My costume this year is a friendly robot.',
      'cobweb - an old, dusty spider web | A cobweb hung in the corner of the attic.',
      'skeleton - the frame of bones inside a body | The museum showed a dinosaur skeleton.',
      'shiver - to shake a little from cold or fear | The cold wind made us shiver.',
      'mysterious',
      'ancient',
      'creak - to make a long squeaky sound | The old stairs creak when you step on them.',
      'nocturnal - active at night instead of during the day | Owls are nocturnal birds.',
      'gloomy - dark and a little sad | The sky was gloomy before the storm.',
      'whisper',
    ].join('\n'),
  },
  {
    id: 'character',
    icon: '💛',
    name: 'Character traits',
    source: [
      'courage',
      'empathy',
      'curiosity',
      'gratitude',
      'wisdom',
      'honest - always telling the truth | An honest friend tells you when your shoe is untied.',
      'patient - able to wait calmly without getting upset | Be patient while the paint dries.',
      'cautious',
      'generous - happy to share with others | Our generous neighbor gave us fresh tomatoes.',
      'loyal - always on the side of a friend | A loyal dog waits by the door for its owner.',
      'polite',
      'clever',
      'responsible - trusted to do the right thing and finish your jobs | A responsible student turns in homework on time.',
    ].join('\n'),
  },
]

/** Add a built-in sample as a new list, or return the copy that already exists. */
export function addSampleList(sample: SampleList): WordList | null {
  const existing = load().lists.find(l => l.name === sample.name)
  if (existing) return existing
  return createList(sample.name, sample.source)
}
