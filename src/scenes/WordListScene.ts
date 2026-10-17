import Phaser from 'phaser'
import { isTouchPreferred, setSettings, getSettings, shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import {
  addSampleList,
  canCreateList,
  createList,
  deleteList,
  enrichEntry,
  getActiveList,
  getLexicon,
  getWordList,
  getWordLists,
  isListPlayable,
  lexiconWarnings,
  MAX_LISTS,
  MAX_NAME_LEN,
  MAX_SOURCE_LEN,
  MAX_WORDS_PER_LIST,
  MIN_PLAYABLE_WORDS,
  parseWordList,
  playableEntries,
  renameList,
  SAMPLE_LISTS,
  setActiveList,
  setLexiconFromCache,
  uniqueName,
  updateListSource,
  type WordList,
} from '../systems/WordLists'
import { createButton, setButtonEnabled, setButtonFill, setButtonLabel } from '../ui/Button'
import { addVignette, createInsetPlate, paintStage, showToast } from '../ui/Panel'
import { addStarfieldBackdrop } from '../ui/Starfield'
import { COLORS, FONT, hexColor } from '../ui/Theme'

export interface WordListSceneData {
  /** Scene to return to (Menu or Setup). */
  returnTo?: 'MenuScene' | 'SetupScene'
}

const LIST_ROWS = 7
const ROW_H = 52
const PREVIEW_ROWS = 12
/** Toasts sit above the DOM text fields (which always draw over the canvas). */
const TOAST_Y = 100

/** Design-space rectangles (1280×720) for the DOM text fields laid over the canvas. */
const NAME_RECT = { x: 372, y: 126, w: 330, h: 44 }
const TEXT_RECT = { x: 372, y: 204, w: 420, h: 396 }

const PLACEHOLDER = [
  'Paste one word per line, for example:',
  '',
  'orbit - the curved path around a planet | The moon is in orbit around Earth.',
  'habitat: the natural home of an animal',
  'courage',
  '',
  'Words the game already knows fill in by themselves.',
].join('\n')

/** Teacher mode: create, paste, preview and activate custom word lists. */
export class WordListScene extends Phaser.Scene {
  private returnTo: 'MenuScene' | 'SetupScene' = 'MenuScene'
  private selectedId: string | null = null
  private listPage = 0
  private previewPage = 0
  private listLayer?: Phaser.GameObjects.Container
  private previewLayer?: Phaser.GameObjects.Container
  private editorLayer?: Phaser.GameObjects.Container
  private emptyLayer?: Phaser.GameObjects.Container
  private modalLayer?: Phaser.GameObjects.Container
  private nameInput?: HTMLInputElement
  private textArea?: HTMLTextAreaElement
  private activeBtn?: Phaser.GameObjects.Container
  private deleteBtn?: Phaser.GameObjects.Container
  private playBtn?: Phaser.GameObjects.Container
  private newBtn?: Phaser.GameObjects.Container
  private savedText?: Phaser.GameObjects.Text
  private saveTimer?: number
  private deleteArmed = false
  private deleteTimer?: Phaser.Time.TimerEvent
  private leaving = false
  private teardown: (() => void)[] = []

  constructor() { super('WordListScene') }

  create(data: WordListSceneData = {}) {
    const w = this.scale.width
    const h = this.scale.height
    const touch = isTouchPreferred(this.sys.game)
    this.returnTo = data.returnTo === 'SetupScene' ? 'SetupScene' : 'MenuScene'
    this.listPage = 0
    this.previewPage = 0
    this.deleteArmed = false
    this.leaving = false
    this.modalLayer = undefined
    this.teardown = []
    setLexiconFromCache(this.cache)
    const lists = getWordLists()
    this.selectedId = getActiveList()?.id ?? lists[0]?.id ?? null

    paintStage(this)
    addStarfieldBackdrop(this, 0.4)
    addVignette(this, 0.55, -4)
    Sfx.startMusic('menu')
    this.cameras.main.fadeIn(260, 7, 11, 20)

    this.add.text(w / 2, 40, '📝 WORD LISTS', {
      fontSize: '40px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      stroke: hexColor(COLORS.goldDeep), strokeThickness: 7,
    }).setOrigin(0.5)
    this.add.text(w / 2, 80, 'Paste this week\'s vocabulary — board questions and minigames play with your words', {
      fontSize: '16px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5)

    const back = createButton(this, 86, 44, this.returnTo === 'SetupScene' ? '◀ SETUP' : '◀ MENU', COLORS.bgPanelAlt, COLORS.chromeDeep, 140, 50)
    back.on('pointerdown', () => this.leave())

    this.playBtn = createButton(this, w - 132, 44, '▶ PLAY THIS LIST', COLORS.party, COLORS.partyDeep, 236, 50)
    this.playBtn.on('pointerdown', () => this.playSelected())

    // ——— Left column: my lists ———
    createInsetPlate(this, 180, 400, 300, 580, { fill: COLORS.bgPanel, fillAlpha: 0.9, border: COLORS.teal, borderAlpha: 0.35, radius: 16 })
    this.add.text(180, 126, `MY LISTS`, { fontSize: '15px', fontFamily: FONT.display, color: hexColor(COLORS.teal) }).setOrigin(0.5)
    this.newBtn = createButton(this, 180, 600, '✚ NEW LIST', COLORS.skyBtn, COLORS.skyBtnDeep, 260, 46)
    this.newBtn.on('pointerdown', () => this.newList())
    const samplesBtn = createButton(this, 180, 656, '📚 TRY A SAMPLE', COLORS.warning, 0xd9800f, 260, 46)
    samplesBtn.on('pointerdown', () => this.openSamples())

    // ——— Right: editor ———
    createInsetPlate(this, 800, 400, 900, 580, { fill: COLORS.bgPanel, fillAlpha: 0.9, border: COLORS.sky, borderAlpha: 0.3, radius: 16 })
    this.buildEditorChrome()

    this.add.text(w / 2, h - 8, touch
      ? 'Tap a list to edit it · tap the text box to type or paste'
      : '↑/↓ lists · N new · S samples · A set active · E edit words · P play · Del delete · Esc back', {
      fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
    }).setOrigin(0.5, 1)

    this.createDom()

    const onKey = (ev: KeyboardEvent) => {
      if (this.leaving) return
      if (this.modalLayer) {
        const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(ev.code)
        if (ev.code === 'Escape') this.closeSamples()
        else if (idx >= 0 && SAMPLE_LISTS[idx]) this.addSample(idx)
        return
      }
      const ids = getWordLists().map(l => l.id)
      const cur = this.selectedId ? ids.indexOf(this.selectedId) : -1
      switch (ev.code) {
        case 'Escape': this.leave(); break
        case 'ArrowDown': if (ids.length) this.select(ids[Math.min(ids.length - 1, cur + 1)]); break
        case 'ArrowUp': if (ids.length) this.select(ids[Math.max(0, cur - 1)]); break
        case 'KeyN': this.newList(); break
        case 'KeyS': this.openSamples(); break
        case 'KeyA': this.toggleActive(); break
        case 'KeyP': this.playSelected(); break
        case 'KeyE':
        case 'Enter': if (this.selectedId) this.textArea?.focus(); break
        case 'Delete': this.deleteSelected(); break
        default: return
      }
      ev.preventDefault()
    }
    this.input.keyboard?.on('keydown', onKey)
    this.teardown.push(() => this.input.keyboard?.off('keydown', onKey))

    // Tapping the canvas (outside the text fields) closes the on-screen keyboard. A native listener
    // runs before Phaser's mouse/touch handlers, so buttons that focus a field (NEW LIST) still can.
    const canvas = this.game.canvas
    const onCanvasDown = () => {
      const el = document.activeElement
      if (el === this.textArea || el === this.nameInput) (el as HTMLElement).blur()
    }
    canvas.addEventListener('pointerdown', onCanvasDown)
    this.teardown.push(() => canvas.removeEventListener('pointerdown', onCanvasDown))

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownScene())
    this.refreshAll()
  }

  // ——— Layout ———

  private buildEditorChrome() {
    const layer = this.add.container(0, 0)
    this.editorLayer = layer
    layer.add(this.add.text(NAME_RECT.x, NAME_RECT.y - 14, 'LIST NAME', { fontSize: '12px', fontFamily: FONT.display, color: hexColor(COLORS.gold) }).setOrigin(0, 0.5))
    layer.add(this.add.text(TEXT_RECT.x, TEXT_RECT.y - 14, 'WORDS · one per line', { fontSize: '12px', fontFamily: FONT.display, color: hexColor(COLORS.gold) }).setOrigin(0, 0.5))
    this.savedText = this.add.text(TEXT_RECT.x + TEXT_RECT.w, TEXT_RECT.y - 14, '', { fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mint) }).setOrigin(1, 0.5)
    layer.add(this.savedText)
    layer.add(this.add.text(TEXT_RECT.x, TEXT_RECT.y + TEXT_RECT.h + 10,
      'Formats: word - definition | example sentence\nAlso: word: definition · word⇥definition (from a spreadsheet)\nor CSV with a header: word,definition,sentence,synonyms,antonyms', {
        fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mute), lineSpacing: 2,
      }))

    this.activeBtn = createButton(this, 848, 148, '⭐ SET ACTIVE', COLORS.gold, COLORS.goldDeep, 230, 46)
    this.activeBtn.on('pointerdown', () => this.toggleActive())
    this.deleteBtn = createButton(this, 1092, 148, '🗑 DELETE', COLORS.chrome, COLORS.chromeDeep, 210, 46)
    this.deleteBtn.on('pointerdown', () => this.deleteSelected())
    layer.add([this.activeBtn, this.deleteBtn])

    const empty = this.add.container(800, 400)
    this.emptyLayer = empty
    empty.add(this.add.text(0, -60, '📝', { fontSize: '64px' }).setOrigin(0.5))
    empty.add(this.add.text(0, 30, 'No word lists yet.\nTap ✚ NEW LIST and paste your vocabulary,\nor try a ready-made sample list.', {
      fontSize: '22px', fontFamily: FONT.display, color: hexColor(COLORS.mist), align: 'center', lineSpacing: 6,
    }).setOrigin(0.5))
  }

  private createDom() {
    const parent = document.body
    const baseStyle = (el: HTMLElement) => {
      Object.assign(el.style, {
        position: 'fixed',
        zIndex: '10',
        boxSizing: 'border-box',
        background: '#0b1222',
        color: '#e8f2ff',
        border: '2px solid rgba(94, 183, 255, 0.5)',
        borderRadius: '10px',
        fontFamily: 'Fredoka, Arial, sans-serif',
        outline: 'none',
        userSelect: 'text',
        webkitUserSelect: 'text',
        touchAction: 'auto',
        margin: '0',
      } as Partial<CSSStyleDeclaration>)
      const focus = () => { el.style.borderColor = hexColor(COLORS.gold) }
      const blur = () => { el.style.borderColor = 'rgba(94, 183, 255, 0.5)' }
      el.addEventListener('focus', focus)
      el.addEventListener('blur', blur)
      // Typing must not reach Phaser's window-level keyboard handlers (shortcuts, key captures).
      const stop = (ev: KeyboardEvent) => {
        ev.stopPropagation()
        if (ev.type === 'keydown' && ev.key === 'Escape') el.blur()
      }
      el.addEventListener('keydown', stop)
      el.addEventListener('keyup', stop)
      el.addEventListener('keypress', stop)
    }

    const name = document.createElement('input')
    name.type = 'text'
    name.maxLength = MAX_NAME_LEN
    name.placeholder = 'e.g. Week 7 science words'
    name.setAttribute('aria-label', 'List name')
    name.autocomplete = 'off'
    name.spellcheck = false
    baseStyle(name)
    name.style.padding = '0 12px'
    name.addEventListener('input', () => {
      if (!this.selectedId || !name.value.trim()) return
      renameList(this.selectedId, name.value)
      this.renderLists()
      this.flashSaved()
    })
    name.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault()
        this.textArea?.focus()
      }
    })
    name.addEventListener('blur', () => {
      // An emptied name snaps back to the stored one.
      const list = getWordList(this.selectedId)
      if (list && !name.value.trim()) name.value = list.name
    })

    const text = document.createElement('textarea')
    text.maxLength = MAX_SOURCE_LEN
    text.placeholder = PLACEHOLDER
    text.spellcheck = true
    text.setAttribute('aria-label', 'Words, one per line')
    text.wrap = 'soft'
    baseStyle(text)
    Object.assign(text.style, {
      padding: '10px 12px', resize: 'none', lineHeight: '1.35', whiteSpace: 'pre-wrap',
      overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#2a6fb0 #0b1222',
    } as Partial<CSSStyleDeclaration>)
    text.addEventListener('input', () => {
      this.previewPage = 0
      this.renderPreview()
      this.savedText?.setText('Saving…').setColor(hexColor(COLORS.mist))
      window.clearTimeout(this.saveTimer)
      this.saveTimer = window.setTimeout(() => this.saveText(), 400)
    })

    parent.appendChild(name)
    parent.appendChild(text)
    this.nameInput = name
    this.textArea = text

    const layout = () => this.layoutDom()
    layout()
    const onResize = () => {
      window.requestAnimationFrame(layout)
      window.setTimeout(layout, 250)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    this.scale.on(Phaser.Scale.Events.RESIZE, layout)
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(layout)
      observer.observe(this.game.canvas)
    }
    this.teardown.push(() => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      this.scale.off(Phaser.Scale.Events.RESIZE, layout)
      observer?.disconnect()
      name.remove()
      text.remove()
      this.nameInput = undefined
      this.textArea = undefined
    })
  }

  /** Keep the DOM fields glued to their design-space rectangles as the canvas scales. */
  private layoutDom() {
    const canvas = this.game.canvas
    if (!canvas || !this.textArea || !this.nameInput) return
    const r = canvas.getBoundingClientRect()
    const sx = r.width / this.scale.width
    const sy = r.height / this.scale.height
    const place = (el: HTMLElement, rect: { x: number; y: number; w: number; h: number }, font: number) => {
      el.style.left = `${r.left + rect.x * sx}px`
      el.style.top = `${r.top + rect.y * sy}px`
      el.style.width = `${rect.w * sx}px`
      el.style.height = `${rect.h * sy}px`
      el.style.fontSize = `${Math.max(12, font * sx)}px`
      el.style.borderRadius = `${Math.max(6, 12 * sx)}px`
    }
    place(this.nameInput, NAME_RECT, 20)
    place(this.textArea, TEXT_RECT, 16)
  }

  private setDomVisible(on: boolean) {
    const display = on ? 'block' : 'none'
    if (this.nameInput) this.nameInput.style.display = display
    if (this.textArea) this.textArea.style.display = display
  }

  // ——— State changes ———

  private refreshAll() {
    const list = getWordList(this.selectedId)
    if (!list && getWordLists().length > 0) this.selectedId = getWordLists()[0].id
    const sel = getWordList(this.selectedId)
    if (sel && this.textArea && this.nameInput) {
      this.textArea.value = sel.source
      this.nameInput.value = sel.name
    }
    this.editorLayer?.setVisible(Boolean(sel))
    this.emptyLayer?.setVisible(!sel)
    this.setDomVisible(Boolean(sel) && !this.modalLayer)
    this.savedText?.setText('')
    this.disarmDelete()
    this.renderLists()
    this.renderPreview()
  }

  private select(id: string) {
    if (id === this.selectedId) return
    this.saveText()
    this.selectedId = id
    this.previewPage = 0
    const idx = getWordLists().findIndex(l => l.id === id)
    if (idx >= 0) this.listPage = Math.floor(idx / LIST_ROWS)
    Sfx.uiClick()
    this.refreshAll()
  }

  private saveText() {
    window.clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    const list = getWordList(this.selectedId)
    if (!list || !this.textArea || this.textArea.value === list.source) return
    updateListSource(list.id, this.textArea.value)
    this.renderLists()
    this.refreshButtons()
    this.flashSaved()
  }

  private flashSaved() {
    this.savedText?.setText('✓ Saved on this device').setColor(hexColor(COLORS.mint))
  }

  private newList() {
    if (this.modalLayer) return
    if (!canCreateList()) {
      showToast(this, `You can keep up to ${MAX_LISTS} lists — delete one to make room.`, TOAST_Y, COLORS.warning)
      return
    }
    this.saveText()
    const list = createList(uniqueName('My word list'))
    if (!list) return
    Sfx.uiClick()
    this.selectedId = list.id
    this.listPage = Math.floor((getWordLists().length - 1) / LIST_ROWS)
    this.refreshAll()
    this.nameInput?.focus()
    this.nameInput?.select()
  }

  private toggleActive() {
    const list = getWordList(this.selectedId)
    if (!list || this.modalLayer) return
    this.saveText()
    if (getActiveList()?.id === list.id) {
      setActiveList(null)
      if (getSettings().wordLevel === 'custom') setSettings({ wordLevel: 'all' })
      showToast(this, 'No active list — the game uses its built-in words.', TOAST_Y, COLORS.sky)
    } else {
      setActiveList(list.id)
      if (isListPlayable(list)) {
        setSettings({ wordLevel: 'custom' })
        showToast(this, `“${list.name}” is active! Parties and the Arcade will use it (switch with the Words button).`, TOAST_Y, COLORS.mint)
      } else {
        const n = playableEntries(list).length
        showToast(this, `“${list.name}” is active, but it needs ${MIN_PLAYABLE_WORDS - n} more word${MIN_PLAYABLE_WORDS - n === 1 ? '' : 's'} with definitions before it can be played.`, TOAST_Y, COLORS.warning)
      }
    }
    Sfx.uiToggle()
    this.renderLists()
    this.refreshButtons()
  }

  private deleteSelected() {
    const list = getWordList(this.selectedId)
    if (!list || this.modalLayer) return
    if (!this.deleteArmed) {
      this.deleteArmed = true
      if (this.deleteBtn) {
        setButtonLabel(this.deleteBtn, '⚠ TAP AGAIN')
        setButtonFill(this.deleteBtn, COLORS.danger)
      }
      this.deleteTimer?.remove()
      this.deleteTimer = this.time.delayedCall(3000, () => this.disarmDelete())
      return
    }
    window.clearTimeout(this.saveTimer)
    const wasActive = getActiveList()?.id === list.id
    deleteList(list.id)
    if (wasActive && !getActiveList() && getSettings().wordLevel === 'custom') setSettings({ wordLevel: 'all' })
    showToast(this, `Deleted “${list.name}”.`, TOAST_Y, COLORS.coral)
    this.selectedId = getActiveList()?.id ?? getWordLists()[0]?.id ?? null
    this.listPage = 0
    this.refreshAll()
  }

  private disarmDelete() {
    this.deleteArmed = false
    this.deleteTimer?.remove()
    this.deleteTimer = undefined
    if (this.deleteBtn) {
      setButtonLabel(this.deleteBtn, '🗑 DELETE')
      setButtonFill(this.deleteBtn, COLORS.chrome)
    }
  }

  private playSelected() {
    const list = getWordList(this.selectedId)
    if (!list || this.modalLayer || this.leaving) return
    this.saveText()
    if (!isListPlayable(list)) {
      const n = playableEntries(list).length
      showToast(this, `Add ${MIN_PLAYABLE_WORDS - n} more word${MIN_PLAYABLE_WORDS - n === 1 ? '' : 's'} with definitions to play this list (it needs ${MIN_PLAYABLE_WORDS}).`, TOAST_Y, COLORS.warning)
      return
    }
    setActiveList(list.id)
    setSettings({ wordLevel: 'custom' })
    this.leaving = true
    Sfx.uiClick()
    this.scene.start('SetupScene')
  }

  private leave() {
    if (this.leaving) return
    this.leaving = true
    this.saveText()
    this.scene.start(this.returnTo)
  }

  private shutdownScene() {
    this.saveText()
    this.teardown.forEach(fn => fn())
    this.teardown = []
    this.deleteTimer = undefined
    this.listLayer = undefined
    this.previewLayer = undefined
  }

  // ——— Rendering ———

  private refreshButtons() {
    const list = getWordList(this.selectedId)
    const isActive = Boolean(list && getActiveList()?.id === list.id)
    if (this.activeBtn) {
      setButtonLabel(this.activeBtn, isActive ? '✓ ACTIVE LIST' : '⭐ SET ACTIVE')
      setButtonFill(this.activeBtn, isActive ? COLORS.mint : COLORS.gold)
    }
    if (this.playBtn) setButtonEnabled(this.playBtn, Boolean(list && isListPlayable(list)))
    if (this.newBtn) setButtonEnabled(this.newBtn, canCreateList())
  }

  private renderLists() {
    this.listLayer?.destroy()
    const layer = this.add.container(0, 0)
    this.listLayer = layer
    const lists = getWordLists()
    const pages = Math.max(1, Math.ceil(lists.length / LIST_ROWS))
    this.listPage = Phaser.Math.Clamp(this.listPage, 0, pages - 1)
    const activeId = getActiveList()?.id
    const slice = lists.slice(this.listPage * LIST_ROWS, (this.listPage + 1) * LIST_ROWS)
    const rowW = 268
    if (lists.length === 0) {
      layer.add(this.add.text(180, 300, 'Your lists will\nappear here.', {
        fontSize: '17px', fontFamily: FONT.display, color: hexColor(COLORS.mute), align: 'center',
      }).setOrigin(0.5))
    }
    slice.forEach((list, i) => {
      const y = 170 + i * (ROW_H + 6)
      const sel = list.id === this.selectedId
      const isActive = list.id === activeId
      const ready = playableEntries(list).length
      const c = this.add.container(180, y)
      const g = this.add.graphics()
      g.fillStyle(sel ? 0x1f3050 : COLORS.bgPanelAlt, 0.96)
      g.fillRoundedRect(-rowW / 2, -ROW_H / 2, rowW, ROW_H, 12)
      g.fillStyle(isActive ? COLORS.gold : ready >= MIN_PLAYABLE_WORDS ? COLORS.teal : COLORS.mute, 1)
      g.fillRoundedRect(-rowW / 2, -ROW_H / 2, 6, ROW_H, { tl: 12, bl: 12, tr: 0, br: 0 })
      g.lineStyle(sel ? 3 : 1.5, sel ? 0xffe066 : COLORS.strokeSoft, sel ? 1 : 0.15)
      g.strokeRoundedRect(-rowW / 2, -ROW_H / 2, rowW, ROW_H, 12)
      c.add(g)
      const name = list.name.length > 22 ? `${list.name.slice(0, 21)}…` : list.name
      c.add(this.add.text(-rowW / 2 + 18, -10, name, {
        fontSize: '17px', fontFamily: FONT.display, color: '#ffffff', fixedWidth: rowW - 60,
      }).setOrigin(0, 0.5))
      c.add(this.add.text(-rowW / 2 + 18, 13, ready >= MIN_PLAYABLE_WORDS ? `${ready} words ready` : `${ready} words · needs ${MIN_PLAYABLE_WORDS}`, {
        fontSize: '13px', fontFamily: FONT.body, color: hexColor(ready >= MIN_PLAYABLE_WORDS ? COLORS.mist : COLORS.warning),
      }).setOrigin(0, 0.5))
      if (isActive) {
        c.add(this.add.text(rowW / 2 - 12, 0, '⭐', { fontSize: '22px' }).setOrigin(1, 0.5))
      }
      const hit = this.add.rectangle(0, 0, rowW, ROW_H, 0, 0.001).setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => this.select(list.id))
      c.add(hit)
      layer.add(c)
    })
    if (pages > 1) {
      const py = 170 + LIST_ROWS * (ROW_H + 6) - 8
      const prev = createButton(this, 100, py, '◀', COLORS.bgPanelAlt, COLORS.chromeDeep, 56, 36)
      const next = createButton(this, 260, py, '▶', COLORS.bgPanelAlt, COLORS.chromeDeep, 56, 36)
      prev.on('pointerdown', () => { this.listPage = Math.max(0, this.listPage - 1); this.renderLists() })
      next.on('pointerdown', () => { this.listPage = Math.min(pages - 1, this.listPage + 1); this.renderLists() })
      setButtonEnabled(prev, this.listPage > 0)
      setButtonEnabled(next, this.listPage < pages - 1)
      layer.add([prev, next, this.add.text(180, py, `${this.listPage + 1} / ${pages}`, {
        fontSize: '14px', fontFamily: FONT.display, color: hexColor(COLORS.mist),
      }).setOrigin(0.5)])
    }
    this.refreshButtons()
  }

  /** Live preview of what the game will read from the text box. */
  private renderPreview() {
    this.previewLayer?.destroy()
    const layer = this.add.container(0, 0)
    this.previewLayer = layer
    const list = getWordList(this.selectedId)
    if (!list || !this.textArea) return

    const x0 = 818
    const pw = 412
    const parsed = parseWordList(this.textArea.value)
    const lex = getLexicon()
    const rows = parsed.entries.map(e => enrichEntry(e, lex))
    const ready = rows.filter(r => r.definition).length
    const filled = rows.filter(r => r.fromLexicon).length
    const warnings = [...parsed.warnings.map(wn => wn.message), ...lexiconWarnings(parsed.entries)]

    layer.add(this.add.text(x0, 190, 'PREVIEW', { fontSize: '12px', fontFamily: FONT.display, color: hexColor(COLORS.gold) }).setOrigin(0, 0.5))
    const ok = ready >= MIN_PLAYABLE_WORDS
    const status = ready === 0
      ? 'Paste or type your words on the left'
      : ok ? `✓ ${ready} words ready to play` : `${ready} ready · add ${MIN_PLAYABLE_WORDS - ready} more to play`
    layer.add(this.add.text(x0, 214, status, {
      fontSize: '20px', fontFamily: FONT.display, color: hexColor(ready === 0 ? COLORS.mist : ok ? COLORS.mint : COLORS.warning),
    }).setOrigin(0, 0.5))
    if (filled > 0) {
      layer.add(this.add.text(x0, 238, `📚 ${filled} filled in from the game's word bank`, {
        fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.sky),
      }).setOrigin(0, 0.5))
    }

    let y = 256
    if (warnings.length > 0) {
      const shown = warnings.slice(0, 3)
      const more = warnings.length - shown.length
      const t = this.add.text(x0, y, [...shown.map(m => `⚠ ${m}`), ...(more > 0 ? [`…and ${more} more`] : [])].join('\n'), {
        fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.warning), wordWrap: { width: pw }, lineSpacing: 2,
      })
      layer.add(t)
      y += t.height + 8
    }

    const perPage = Math.max(4, PREVIEW_ROWS - Math.ceil((y - 256) / 26))
    const pages = Math.max(1, Math.ceil(rows.length / perPage))
    this.previewPage = Phaser.Math.Clamp(this.previewPage, 0, pages - 1)
    const slice = rows.slice(this.previewPage * perPage, (this.previewPage + 1) * perPage)
    const g = this.add.graphics()
    layer.add(g)
    slice.forEach((r, i) => {
      const ry = y + i * 28
      g.fillStyle(i % 2 === 0 ? 0xffffff : 0x000000, i % 2 === 0 ? 0.04 : 0.12)
      g.fillRoundedRect(x0 - 6, ry - 2, pw + 12, 26, 6)
      const mark = !r.definition ? '⚠' : r.fromLexicon ? '📚' : '✓'
      const def = r.definition || 'needs a definition'
      const label = `${r.word} — ${def}`
      layer.add(this.add.text(x0, ry + 11, mark, {
        fontSize: '14px', fontFamily: FONT.body, color: hexColor(r.definition ? COLORS.mint : COLORS.warning),
      }).setOrigin(0, 0.5))
      layer.add(this.add.text(x0 + 26, ry + 11, label.length > 52 ? `${label.slice(0, 51)}…` : label, {
        fontSize: '14px', fontFamily: FONT.body, color: r.definition ? hexColor(COLORS.frost) : hexColor(COLORS.warning), fixedWidth: pw - 26,
      }).setOrigin(0, 0.5))
    })

    if (pages > 1) {
      const py = 668
      const prev = createButton(this, x0 + 40, py, '◀', COLORS.bgPanelAlt, COLORS.chromeDeep, 56, 34)
      const next = createButton(this, x0 + pw - 40, py, '▶', COLORS.bgPanelAlt, COLORS.chromeDeep, 56, 34)
      prev.on('pointerdown', () => { this.previewPage -= 1; this.renderPreview() })
      next.on('pointerdown', () => { this.previewPage += 1; this.renderPreview() })
      setButtonEnabled(prev, this.previewPage > 0)
      setButtonEnabled(next, this.previewPage < pages - 1)
      layer.add([prev, next, this.add.text(x0 + pw / 2, py, `Words ${this.previewPage * perPage + 1}–${Math.min(rows.length, (this.previewPage + 1) * perPage)} of ${rows.length}`, {
        fontSize: '13px', fontFamily: FONT.display, color: hexColor(COLORS.mist),
      }).setOrigin(0.5)])
    } else if (rows.length >= MAX_WORDS_PER_LIST) {
      layer.add(this.add.text(x0, 668, `Lists hold up to ${MAX_WORDS_PER_LIST} words.`, { fontSize: '13px', fontFamily: FONT.body, color: hexColor(COLORS.mute) }).setOrigin(0, 0.5))
    }
  }

  // ——— Samples ———

  private openSamples() {
    if (this.modalLayer || this.leaving) return
    this.saveText()
    Sfx.uiClick()
    this.setDomVisible(false)
    const w = this.scale.width
    const h = this.scale.height
    const layer = this.add.container(0, 0).setDepth(100)
    this.modalLayer = layer
    const dim = this.add.rectangle(0, 0, w, h, 0x000000, 0.75).setOrigin(0).setInteractive()
    dim.on('pointerdown', () => this.closeSamples())
    layer.add(dim)
    const pw = 1040
    const ph = 440
    const g = this.add.graphics()
    g.fillStyle(COLORS.bgPanel, 0.98)
    g.fillRoundedRect(w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, 20)
    g.lineStyle(3, COLORS.gold, 0.8)
    g.strokeRoundedRect(w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, 20)
    layer.add([g, this.add.rectangle(w / 2, h / 2, pw, ph, 0, 0.001).setInteractive()])
    layer.add(this.add.text(w / 2, h / 2 - ph / 2 + 38, '📚 SAMPLE LISTS', {
      fontSize: '30px', fontFamily: FONT.display, color: hexColor(COLORS.gold), stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5))
    layer.add(this.add.text(w / 2, h / 2 - ph / 2 + 74, 'Add one as a starting point — every sample can be edited like your own list.', {
      fontSize: '15px', fontFamily: FONT.body, color: hexColor(COLORS.mist),
    }).setOrigin(0.5))

    const cw = 310
    const chh = 240
    SAMPLE_LISTS.forEach((sample, i) => {
      const x = w / 2 + (i - 1) * (cw + 20)
      const y = h / 2 + 30
      const c = this.add.container(x, y)
      const cg = this.add.graphics()
      const draw = (hover: boolean) => {
        cg.clear()
        cg.fillStyle(hover ? 0x1f3050 : COLORS.bgPanelAlt, 1)
        cg.fillRoundedRect(-cw / 2, -chh / 2, cw, chh, 16)
        cg.lineStyle(hover ? 3 : 2, hover ? 0xffe066 : COLORS.teal, hover ? 1 : 0.5)
        cg.strokeRoundedRect(-cw / 2, -chh / 2, cw, chh, 16)
      }
      draw(false)
      c.add(cg)
      const parsed = parseWordList(sample.source)
      c.add(this.add.text(0, -76, sample.icon, { fontSize: '44px' }).setOrigin(0.5))
      c.add(this.add.text(0, -26, sample.name, { fontSize: '22px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0.5))
      c.add(this.add.text(0, 2, `${parsed.entries.length} words`, { fontSize: '14px', fontFamily: FONT.body, color: hexColor(COLORS.teal) }).setOrigin(0.5))
      c.add(this.add.text(0, 50, parsed.entries.slice(0, 6).map(e => e.word).join(' · ') + ' …', {
        fontSize: '14px', fontFamily: FONT.body, color: hexColor(COLORS.mist), align: 'center', wordWrap: { width: cw - 36 },
      }).setOrigin(0.5))
      c.add(this.add.text(0, chh / 2 - 22, isTouchPreferred(this.sys.game) ? 'Tap to add' : `Click or press ${i + 1}`, {
        fontSize: '13px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
      }).setOrigin(0.5))
      const hit = this.add.rectangle(0, 0, cw, chh, 0, 0.001).setInteractive({ useHandCursor: true })
      hit.on('pointerover', () => draw(true))
      hit.on('pointerout', () => draw(false))
      hit.on('pointerdown', () => this.addSample(i))
      c.add(hit)
      if (!shouldReduceMotion()) {
        c.setAlpha(0).setScale(0.92)
        this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 220, delay: 40 + i * 60, ease: 'Back.easeOut' })
      }
      layer.add(c)
    })
    const close = createButton(this, w / 2, h / 2 + ph / 2 - 6, 'CLOSE', COLORS.chrome, COLORS.chromeDeep, 180, 46)
    close.on('pointerdown', () => this.closeSamples())
    layer.add(close)
  }

  private closeSamples() {
    this.modalLayer?.destroy()
    this.modalLayer = undefined
    this.setDomVisible(Boolean(getWordList(this.selectedId)))
  }

  private addSample(i: number) {
    const sample = SAMPLE_LISTS[i]
    if (!sample) return
    const existed = getWordLists().some(l => l.name === sample.name)
    const list: WordList | null = addSampleList(sample)
    this.closeSamples()
    if (!list) {
      showToast(this, `You can keep up to ${MAX_LISTS} lists — delete one to make room.`, TOAST_Y, COLORS.warning)
      return
    }
    Sfx.uiToggle()
    this.selectedId = list.id
    this.listPage = Math.floor(getWordLists().findIndex(l => l.id === list.id) / LIST_ROWS)
    this.previewPage = 0
    this.refreshAll()
    showToast(this, existed ? `“${list.name}” is already in your lists.` : `Added “${list.name}” — edit it freely, then press ⭐ SET ACTIVE.`, TOAST_Y, COLORS.mint)
  }
}
