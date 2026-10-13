import Phaser from 'phaser'
import { DEFAULT_CPU_LEVEL } from '../systems/CpuPolicy'
import { isTouchPreferred, shouldReduceMotion } from '../systems/GameSettings'
import { getProgress, masteryOf, weakWords, type Mastery, type WordRecord } from '../systems/Progress'
import { Sfx } from '../systems/Sfx'
import { createButton, setButtonEnabled } from '../ui/Button'
import { addVignette, paintStage } from '../ui/Panel'
import { addStarfieldBackdrop } from '../ui/Starfield'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { ContentBank } from '../minigames/ContentBank'
import type { MinigameSceneData } from './MinigameScene'

type Filter = 'all' | Mastery

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'mastered', label: '⭐ MASTERED' },
  { id: 'learning', label: '📘 LEARNING' },
  { id: 'practice', label: '🎯 PRACTICE' },
]

const MASTERY_COLOR: Record<Mastery, number> = {
  mastered: 0x44dd88,
  learning: 0x5eb7ff,
  practice: 0xff9f1c,
}

const COLS = 4
const ROWS = 6
const PER_PAGE = COLS * ROWS

/** Lifetime vocabulary progress: every word practiced on this device and how well it's known. */
export class WordBookScene extends Phaser.Scene {
  private filter: Filter = 'all'
  private page = 0
  private selected?: string
  private gridLayer?: Phaser.GameObjects.Container
  private detailLayer?: Phaser.GameObjects.Container
  private tabButtons: Phaser.GameObjects.Container[] = []
  private pageText?: Phaser.GameObjects.Text
  private bank!: ContentBank

  constructor() { super('WordBookScene') }

  create() {
    const w = this.scale.width
    const h = this.scale.height
    this.page = 0
    this.selected = undefined
    this.tabButtons = []
    this.bank = new ContentBank(this.cache)

    paintStage(this)
    addStarfieldBackdrop(this, 0.4)
    addVignette(this, 0.55, -4)
    Sfx.startMusic('menu')
    this.cameras.main.fadeIn(260, 7, 11, 20)

    const p = getProgress()
    const records = Object.values(p.words)
    const mastered = records.filter(r => masteryOf(r) === 'mastered').length
    const right = records.reduce((s, r) => s + r.correct, 0)
    const total = records.reduce((s, r) => s + r.correct + r.wrong, 0)

    this.add.text(w / 2, 44, '📖 WORD BOOK', {
      fontSize: '44px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      stroke: hexColor(COLORS.goldDeep), strokeThickness: 8,
    }).setOrigin(0.5)

    const back = createButton(this, 86, 46, '◀ MENU', COLORS.bgPanelAlt, COLORS.chromeDeep, 140, 50)
    back.on('pointerdown', () => this.scene.start('MenuScene'))

    const stats = [
      `${records.length} words seen`,
      `${mastered} mastered`,
      total > 0 ? `${Math.round((right / total) * 100)}% accuracy` : '— accuracy',
      `Parties won ${p.gamesWon}/${p.gamesPlayed}`,
      `Minigames won ${p.minigamesWon}/${p.minigamesPlayed}`,
    ]
    this.add.text(w / 2, 90, stats.join('   ·   '), {
      fontSize: '16px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5)

    // Mastery bar against the full word bank
    const barW = 520
    const bankSize = this.bank.allWords.length
    const masteredInBank = this.bank.allWords.filter(x => p.words[x.word] && masteryOf(p.words[x.word]) === 'mastered').length
    const bar = this.add.graphics()
    bar.fillStyle(0x000000, 0.5)
    bar.fillRoundedRect(w / 2 - barW / 2, 112, barW, 14, 7)
    bar.fillStyle(MASTERY_COLOR.mastered, 1)
    bar.fillRoundedRect(w / 2 - barW / 2 + 2, 114, Math.max(4, (barW - 4) * (masteredInBank / Math.max(1, bankSize))), 10, 5)
    this.add.text(w / 2 + barW / 2 + 12, 119, `${masteredInBank}/${bankSize} word-bank words mastered`, {
      fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
    }).setOrigin(0, 0.5)

    FILTERS.forEach((f, i) => {
      const btn = createButton(this, 140 + i * 186, 160, f.label, COLORS.bgPanelAlt, COLORS.chromeDeep, 176, 44)
      btn.on('pointerdown', () => this.setFilter(f.id))
      this.tabButtons.push(btn)
    })

    const prev = createButton(this, 300, h - 40, '◀', COLORS.bgPanelAlt, COLORS.chromeDeep, 70, 46)
    prev.on('pointerdown', () => this.turnPage(-1))
    const next = createButton(this, 560, h - 40, '▶', COLORS.bgPanelAlt, COLORS.chromeDeep, 70, 46)
    next.on('pointerdown', () => this.turnPage(1))
    this.pageText = this.add.text(430, h - 40, '', { fontSize: '16px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0.5)

    // Only lexicon words can drive the practice game.
    const lexSet = new Set(this.bank.allWords.map(x => x.word))
    const weak = weakWords(200).filter(x => lexSet.has(x)).slice(0, 40)
    const practice = createButton(this, 1050, 160, '🎯 PRACTICE WEAK WORDS', COLORS.warning, 0xd9800f, 340, 44)
    practice.on('pointerdown', () => {
      if (weak.length === 0) return
      const data: MinigameSceneData = {
        mode: 'practice',
        gameId: 'definition-dash',
        focusWords: weak,
        backScene: 'WordBookScene',
        participants: [{ id: 0, name: 'You', characterIndex: 0, color: COLORS.player[0], isCpu: false, cpuLevel: DEFAULT_CPU_LEVEL }],
      }
      this.scene.start('MinigameScene', data)
    })
    if (weak.length === 0) setButtonEnabled(practice, false)

    this.add.text(w / 2, h - 12, isTouchPreferred(this.sys.game) ? 'Tap a word for details' : '1–4 filters · ←/→ pages · click a word for details · Esc back', {
      fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
    }).setOrigin(0.5, 1)

    const onKey = (ev: KeyboardEvent) => {
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(ev.code)
      if (idx >= 0) this.setFilter(FILTERS[idx].id)
      else if (ev.code === 'ArrowLeft') this.turnPage(-1)
      else if (ev.code === 'ArrowRight') this.turnPage(1)
      else if (ev.code === 'Escape') this.scene.start('MenuScene')
    }
    this.input.keyboard?.on('keydown', onKey)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey))

    this.renderGrid()
    this.renderDetail()
  }

  private entries(): [string, WordRecord][] {
    return Object.entries(getProgress().words)
      .filter(([, r]) => this.filter === 'all' || masteryOf(r) === this.filter)
      .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
  }

  private setFilter(f: Filter) {
    if (this.filter === f) return
    this.filter = f
    this.page = 0
    Sfx.uiToggle()
    this.renderGrid()
  }

  private turnPage(d: number) {
    const pages = Math.max(1, Math.ceil(this.entries().length / PER_PAGE))
    const next = Phaser.Math.Clamp(this.page + d, 0, pages - 1)
    if (next === this.page) return
    this.page = next
    Sfx.uiClick()
    this.renderGrid()
  }

  private renderGrid() {
    this.gridLayer?.destroy()
    const layer = this.add.container(0, 0)
    this.gridLayer = layer
    this.tabButtons.forEach((b, i) => b.setAlpha(FILTERS[i].id === this.filter ? 1 : 0.6))

    const list = this.entries()
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
    this.pageText?.setText(`Page ${this.page + 1} / ${pages}`)
    const slice = list.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE)

    if (slice.length === 0) {
      layer.add(this.add.text(430, 400, this.filter === 'all'
        ? 'Your Word Book is empty.\nPlay a party or the Minigame Arcade —\nevery word you practice lands here!'
        : 'No words in this group yet.', {
        fontSize: '22px', fontFamily: FONT.display, color: hexColor(COLORS.mist), align: 'center',
      }).setOrigin(0.5))
      return
    }

    const chipW = 192
    const chipH = 62
    const x0 = 40 + chipW / 2
    const y0 = 214 + chipH / 2
    slice.forEach(([word, r], i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = x0 + col * (chipW + 10)
      const y = y0 + row * (chipH + 8)
      const m = masteryOf(r)
      const c = this.add.container(x, y)
      const g = this.add.graphics()
      const sel = this.selected === word
      g.fillStyle(sel ? 0x1f3050 : COLORS.bgPanel, 0.96)
      g.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 12)
      g.fillStyle(MASTERY_COLOR[m], 1)
      g.fillRoundedRect(-chipW / 2, -chipH / 2, 6, chipH, { tl: 12, bl: 12, tr: 0, br: 0 })
      g.lineStyle(sel ? 3 : 1.5, sel ? 0xffe066 : MASTERY_COLOR[m], sel ? 1 : 0.45)
      g.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 12)
      c.add(g)
      c.add(this.add.text(-chipW / 2 + 16, -12, word, {
        fontSize: word.length > 16 ? '14px' : '18px', fontFamily: FONT.display, color: '#ffffff',
        fixedWidth: chipW - 26,
      }).setOrigin(0, 0.5))
      c.add(this.add.text(-chipW / 2 + 16, 14, `✓ ${r.correct}   ✗ ${r.wrong}`, {
        fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
      }).setOrigin(0, 0.5))
      const hit = this.add.rectangle(0, 0, chipW, chipH, 0, 0.001).setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => {
        this.selected = word
        Sfx.uiClick()
        this.renderGrid()
        this.renderDetail()
      })
      c.add(hit)
      if (!shouldReduceMotion()) {
        c.setAlpha(0)
        this.tweens.add({ targets: c, alpha: 1, duration: 160, delay: i * 12 })
      }
      layer.add(c)
    })
  }

  private renderDetail() {
    this.detailLayer?.destroy()
    const layer = this.add.container(0, 0)
    this.detailLayer = layer
    const x = 1050
    const top = 200
    const pw = 360
    const ph = 470
    const g = this.add.graphics()
    g.fillStyle(COLORS.bgPanel, 0.96)
    g.fillRoundedRect(x - pw / 2, top, pw, ph, 18)
    g.lineStyle(2, COLORS.gold, 0.5)
    g.strokeRoundedRect(x - pw / 2, top, pw, ph, 18)
    layer.add(g)

    if (!this.selected) {
      layer.add(this.add.text(x, top + ph / 2, 'Select a word to see\nits meaning, synonyms,\nand an example.', {
        fontSize: '18px', fontFamily: FONT.display, color: hexColor(COLORS.mute), align: 'center',
      }).setOrigin(0.5))
      return
    }

    const word = this.selected
    const rec = getProgress().words[word]
    const lex = this.bank.allWords.find(x2 => x2.word === word)
    const m = rec ? masteryOf(rec) : 'learning'
    let y = top + 34
    const line = (text: string, size: number, color: string, gap = 10, family: string = FONT.body) => {
      const t = this.add.text(x - pw / 2 + 22, y, text, {
        fontSize: `${size}px`, fontFamily: family, color, wordWrap: { width: pw - 44 },
      })
      layer.add(t)
      y += t.height + gap
    }
    line(word, word.length > 14 ? 28 : 36, '#ffffff', 4, FONT.display)
    line(`${m === 'mastered' ? '⭐ Mastered' : m === 'practice' ? '🎯 Needs practice' : '📘 Learning'}${lex ? `  ·  ${lex.pos}` : ''}`, 15, hexColor(MASTERY_COLOR[m]), 14)
    if (lex) {
      line('MEANING', 12, hexColor(COLORS.gold), 2, FONT.display)
      line(lex.definition, 18, '#ffffff', 14)
      line('SYNONYMS', 12, hexColor(COLORS.gold), 2, FONT.display)
      line(lex.synonyms.join(', '), 16, hexColor(COLORS.frost), 14)
      if (lex.antonyms.length > 0) {
        line('OPPOSITES', 12, hexColor(COLORS.gold), 2, FONT.display)
        line(lex.antonyms.join(', '), 16, hexColor(COLORS.frost), 14)
      }
      line('EXAMPLE', 12, hexColor(COLORS.gold), 2, FONT.display)
      line(`“${lex.sentence}”`, 16, '#c8d8ff', 14)
    } else if (rec?.note) {
      line('NOTE', 12, hexColor(COLORS.gold), 2, FONT.display)
      line(rec.note, 17, '#ffffff', 14)
    }
    if (rec) {
      const seen = new Date(rec.lastSeen)
      line(`Answered right ${rec.correct}× · missed ${rec.wrong}× · last seen ${seen.toLocaleDateString()}`, 13, hexColor(COLORS.mute), 0)
    }
  }
}
