import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { COLORS, FONT } from '../../ui/Theme'
import { shuffled, type LexWord } from '../ContentBank'
import type { MinigameDef } from '../types'

interface Card {
  c: Phaser.GameObjects.Container
  face: Phaser.GameObjects.Container
  back: Phaser.GameObjects.Container
  pairId: number
  open: boolean
  matched: boolean
}

const COLS = 4
const ROWS = 3

export const memoryMatch: MinigameDef = {
  id: 'memory-match',
  title: 'Memory Match',
  icon: '🃏',
  accent: COLORS.party,
  category: 'Vocabulary',
  tagline: 'Flip cards to pair every word with its meaning.',
  howTo: [
    'Flip two cards: a WORD and its DEFINITION make a pair.',
    'Each pair is +1. Clear the board for a +2 bonus.',
    'Remember where the cards are hiding!',
  ],
  controls: { keys: 'Arrows move · Space/Enter flips · or click', touch: 'Tap cards to flip' },
  durationMs: 50000,
  cpu: { easy: [2, 4], normal: [4, 7], hard: [6, 10] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    let cards: Card[] = []
    let first: Card | null = null
    let busy = false
    let cursor = 0
    let pairWords: LexWord[] = []

    const gapX = 14
    const gapY = 14
    const cardW = Math.min(220, (area.width - 40 - gapX * (COLS - 1)) / COLS)
    const cardH = Math.min(140, (area.bottom - area.top - 40 - gapY * (ROWS - 1)) / ROWS)
    const gridW = COLS * cardW + (COLS - 1) * gapX
    const gridH = ROWS * cardH + (ROWS - 1) * gapY
    const x0 = area.cx - gridW / 2 + cardW / 2
    const y0 = area.top + (area.bottom - area.top - gridH) / 2 + cardH / 2

    const cursorBox = scene.add.graphics()
    const drawCursor = () => {
      cursorBox.clear()
      if (ctx.touch || cards.length === 0) return
      const card = cards[cursor]
      cursorBox.lineStyle(4, 0xffe066, 1)
      cursorBox.strokeRoundedRect(card.c.x - cardW / 2 - 6, card.c.y - cardH / 2 - 6, cardW + 12, cardH + 12, 16)
    }

    const panel = (fill: number, edge: number) => {
      const g = scene.add.graphics()
      g.fillStyle(0x000000, 0.35)
      g.fillRoundedRect(-cardW / 2 + 2, -cardH / 2 + 5, cardW, cardH, 14)
      g.fillStyle(fill, 1)
      g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14)
      g.lineStyle(3, edge, 0.9)
      g.strokeRoundedRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2, 14)
      return g
    }

    const flipTo = (card: Card, open: boolean, onDone?: () => void) => {
      card.open = open
      if (ctx.reduceMotion) {
        card.face.setVisible(open)
        card.back.setVisible(!open)
        onDone?.()
        return
      }
      scene.tweens.add({
        targets: card.c, scaleX: 0, duration: 90, ease: 'Sine.easeIn',
        onComplete: () => {
          card.face.setVisible(open)
          card.back.setVisible(!open)
          scene.tweens.add({ targets: card.c, scaleX: 1, duration: 90, ease: 'Sine.easeOut', onComplete: () => onDone?.() })
        },
      })
    }

    const deal = () => {
      cards.forEach(c => c.c.destroy())
      cards = []
      first = null
      busy = false
      pairWords = []
      const used = new Set<string>()
      for (let tries = 0; pairWords.length < (COLS * ROWS) / 2 && tries < 60; tries++) {
        const w = ctx.bank.word(x => x.definition.length <= 42, 'memory')
        if (used.has(w.word)) continue
        used.add(w.word)
        pairWords.push(w)
      }
      const faces = shuffled(pairWords.flatMap((w, i) => [
        { pairId: i, text: w.word.toUpperCase(), kind: 'word' as const },
        { pairId: i, text: w.definition, kind: 'def' as const },
      ]))
      faces.forEach((f, i) => {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const c = scene.add.container(x0 + col * (cardW + gapX), y0 + row * (cardH + gapY))
        const back = scene.add.container(0, 0)
        back.add(panel(0x2a2060, accent))
        back.add(scene.add.text(0, 0, '?', { fontSize: '54px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0.5).setAlpha(0.35))
        const face = scene.add.container(0, 0).setVisible(false)
        face.add(panel(f.kind === 'word' ? 0xfff3d6 : 0xe6f2ff, f.kind === 'word' ? 0xc49212 : 0x3d8fff))
        face.add(scene.add.text(0, -cardH / 2 + 16, f.kind === 'word' ? 'WORD' : 'MEANING', {
          fontSize: '11px', fontFamily: FONT.display, color: f.kind === 'word' ? '#9a6a00' : '#2a6fd4',
        }).setOrigin(0.5))
        face.add(scene.add.text(0, 6, f.text, {
          fontSize: f.kind === 'word' ? (f.text.length > 9 ? '22px' : '26px') : f.text.length > 28 ? '15px' : '17px',
          fontFamily: FONT.display, color: '#1a1a2e', align: 'center', wordWrap: { width: cardW - 20 },
        }).setOrigin(0.5))
        const hit = scene.add.rectangle(0, 0, cardW, cardH, 0, 0.001).setInteractive({ useHandCursor: true })
        c.add([back, face, hit])
        root.add(c)
        const card: Card = { c, face, back, pairId: f.pairId, open: false, matched: false }
        hit.on('pointerdown', () => { cursor = i; drawCursor(); flip(card) })
        cards.push(card)
        if (!ctx.reduceMotion) {
          c.setScale(0)
          scene.tweens.add({ targets: c, scale: 1, duration: 220, delay: i * 30, ease: 'Back.easeOut' })
        }
      })
      root.bringToTop(cursorBox)
      cursor = Math.min(cursor, cards.length - 1)
      drawCursor()
    }

    const flip = (card: Card) => {
      if (busy || card.open || card.matched || ctx.isOver()) return
      Sfx.uiClick()
      if (!first) {
        first = card
        flipTo(card, true)
        return
      }
      const a = first
      first = null
      busy = true
      flipTo(card, true, () => {
        const w = pairWords[a.pairId]
        if (a.pairId === card.pairId) {
          a.matched = card.matched = true
          Sfx.correct()
          ctx.addScore(1, (a.c.x + card.c.x) / 2, Math.min(a.c.y, card.c.y) - 40)
          ctx.recordWord(w.word, true, w.definition)
          ;[a, card].forEach(m => {
            const glow = scene.add.graphics()
            glow.lineStyle(4, 0x44ff88, 1)
            glow.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14)
            m.c.add(glow)
            m.c.setAlpha(0.82)
          })
          busy = false
          if (cards.every(x => x.matched)) {
            ctx.addScore(2, area.cx, area.top + 40)
            ctx.flash('🎉 BOARD CLEARED +2', '#44ff88')
            ctx.after(700, deal)
          }
        } else {
          Sfx.wrong()
          ctx.after(650, () => {
            flipTo(a, false)
            flipTo(card, false, () => { busy = false })
          })
        }
      })
    }

    root.add(cursorBox)
    ctx.onKey(ev => {
      const col = cursor % COLS
      const row = Math.floor(cursor / COLS)
      switch (ev.code) {
        case 'ArrowLeft': cursor = row * COLS + ((col + COLS - 1) % COLS); break
        case 'ArrowRight': cursor = row * COLS + ((col + 1) % COLS); break
        case 'ArrowUp': cursor = ((row + ROWS - 1) % ROWS) * COLS + col; break
        case 'ArrowDown': cursor = ((row + 1) % ROWS) * COLS + col; break
        case 'Space':
        case 'Enter':
          if (cards[cursor]) flip(cards[cursor])
          return true
        default: return false
      }
      drawCursor()
      return true
    })

    deal()
    return {
      stop() {
        busy = true
        cursorBox.clear()
      },
    }
  },
}
