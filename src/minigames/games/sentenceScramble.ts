import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { createButton } from '../../ui/Button'
import { COLORS, FONT, hexColor } from '../../ui/Theme'
import { shuffled, type LexWord } from '../ContentBank'
import type { MinigameDef } from '../types'
import { drawCard } from '../ui'

interface Tile {
  c: Phaser.GameObjects.Container
  text: string
  w: number
  homeX: number
  homeY: number
  used: boolean
}

function tokenize(sentence: string): string[] {
  return sentence.replace(/\s+/g, ' ').trim().split(' ')
}

export const sentenceScramble: MinigameDef = {
  id: 'sentence-scramble',
  title: 'Sentence Scramble',
  icon: '🧱',
  accent: 0x2ec4b6,
  category: 'Grammar',
  tagline: 'Put the jumbled words back in order.',
  howTo: [
    'A sentence has been shuffled into word tiles.',
    'Tap the words in the right order to rebuild it.',
    'Long sentences (10+ words) are worth double.',
  ],
  controls: { keys: 'Click words in order · Backspace undo · Space skip', touch: 'Tap words in order · ⌫ undo' },
  durationMs: 45000,
  cpu: { easy: [1, 3], normal: [3, 5], hard: [5, 7] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    let tiles: Tile[] = []
    let placed: Tile[] = []
    let target: string[] = []
    let word: LexWord
    let objs: Phaser.GameObjects.GameObject[] = []
    let busy = false
    const lineY = area.top + 210
    const poolTop = area.top + 330

    const makeTile = (text: string): Tile => {
      const w = Math.max(54, text.length * 13 + 28)
      const c = scene.add.container(0, 0)
      const g = scene.add.graphics()
      g.fillStyle(0x000000, 0.35)
      g.fillRoundedRect(-w / 2 + 2, -20, w, 44, 10)
      g.fillStyle(0xe6f2ff, 1)
      g.fillRoundedRect(-w / 2, -24, w, 44, 10)
      g.lineStyle(2, accent, 1)
      g.strokeRoundedRect(-w / 2, -24, w, 44, 10)
      const t = scene.add.text(0, -2, text, { fontSize: '21px', fontFamily: FONT.display, color: '#1a1a2e' }).setOrigin(0.5)
      const hit = scene.add.rectangle(0, -2, w, 48, 0, 0.001).setInteractive({ useHandCursor: true })
      c.add([g, t, hit])
      root.add(c)
      objs.push(c)
      const tile: Tile = { c, text, w, homeX: 0, homeY: 0, used: false }
      hit.on('pointerdown', () => (tile.used ? undefined : place(tile)))
      return tile
    }

    /** Lay out tiles in wrapped rows centered on the play area. */
    const flow = (list: Tile[], top: number, maxW: number, gap = 10) => {
      const rows: Tile[][] = [[]]
      let rowW = 0
      for (const t of list) {
        if (rowW + t.w > maxW && rows[rows.length - 1].length > 0) {
          rows.push([])
          rowW = 0
        }
        rows[rows.length - 1].push(t)
        rowW += t.w + gap
      }
      return rows.flatMap((row, r) => {
        const total = row.reduce((s, t) => s + t.w, 0) + gap * (row.length - 1)
        let x = area.cx - total / 2
        return row.map(t => {
          const pos = { t, x: x + t.w / 2, y: top + r * 58 }
          x += t.w + gap
          return pos
        })
      })
    }

    const relayoutPlaced = () => {
      flow(placed, lineY, area.width - 80).forEach(({ t, x, y }) => {
        scene.tweens.add({ targets: t.c, x, y, duration: 120, ease: 'Cubic.easeOut' })
      })
    }

    const place = (t: Tile) => {
      if (busy || ctx.isOver()) return
      t.used = true
      placed.push(t)
      Sfx.uiClick()
      relayoutPlaced()
      if (placed.length === target.length) check()
    }

    const undo = () => {
      if (busy || placed.length === 0) return
      const t = placed.pop()!
      t.used = false
      scene.tweens.add({ targets: t.c, x: t.homeX, y: t.homeY, duration: 120 })
      relayoutPlaced()
    }

    const check = () => {
      busy = true
      const built = placed.map(t => t.text).join(' ')
      if (built === target.join(' ')) {
        Sfx.correct()
        const pts = target.length >= 10 ? 2 : 1
        ctx.addScore(pts, area.cx, lineY - 50)
        ctx.recordWord(word.word, true, word.sentence)
        placed.forEach((t, i) => scene.tweens.add({ targets: t.c, y: t.c.y - 12, duration: 110, delay: i * 25, yoyo: true }))
        ctx.after(650, next)
      } else {
        Sfx.wrong()
        if (!ctx.reduceMotion) placed.forEach(t => scene.tweens.add({ targets: t.c, x: t.c.x + 6, duration: 40, yoyo: true, repeat: 3 }))
        ctx.after(420, () => {
          // Keep the correct prefix, return the rest.
          let keep = 0
          while (keep < placed.length && placed[keep].text === target[keep]) keep++
          while (placed.length > keep) {
            const t = placed.pop()!
            t.used = false
            scene.tweens.add({ targets: t.c, x: t.homeX, y: t.homeY, duration: 140 })
          }
          relayoutPlaced()
          busy = false
        })
      }
    }

    const skip = () => {
      if (busy || ctx.isOver()) return
      busy = true
      ctx.recordWord(word.word, false, word.sentence)
      ctx.flash('⏭ Skipped', '#ffb3b3')
      Sfx.wrong()
      ctx.after(700, next)
    }

    const next = () => {
      if (ctx.isOver()) return
      objs.forEach(o => o.destroy())
      objs = []
      tiles = []
      placed = []
      busy = false
      word = ctx.bank.word(w => {
        const n = tokenize(w.sentence).length
        return n >= 5 && n <= 13
      }, 'scramble')
      target = tokenize(word.sentence)

      const card = scene.add.container(area.cx, area.top + 60)
      card.add(drawCard(scene, Math.min(area.width - 20, 860), 100, accent))
      card.add(scene.add.text(0, -24, `REBUILD THE SENTENCE · ${target.length} WORDS`, {
        fontSize: '15px', fontFamily: FONT.display, color: hexColor(accent),
      }).setOrigin(0.5))
      card.add(scene.add.text(0, 14, `Key word: ${word.word.toUpperCase()} — ${word.definition}`, {
        fontSize: '19px', fontFamily: FONT.body, color: '#ffffff', align: 'center', wordWrap: { width: 800 },
      }).setOrigin(0.5))
      root.add(card)
      objs.push(card)

      const guide = scene.add.graphics()
      guide.lineStyle(2, accent, 0.4)
      guide.lineBetween(area.left + 40, lineY + 30, area.right - 40, lineY + 30)
      root.add(guide)
      objs.push(guide)

      // Avoid shuffles that leave the sentence already in order.
      let order = shuffled(target)
      for (let i = 0; i < 6 && order.join(' ') === target.join(' '); i++) order = shuffled(target)
      tiles = order.map(makeTile)
      // Reserve as many answer rows as the full sentence needs, then start the pool below them.
      const answerRows = new Set(flow(tiles, lineY, area.width - 80).map(p => p.y)).size
      const top = Math.max(poolTop, lineY + answerRows * 58 + 40)
      guide.clear()
      guide.lineStyle(2, accent, 0.4)
      guide.lineBetween(area.left + 40, top - 46, area.right - 40, top - 46)
      flow(tiles, top, area.width - 60).forEach(({ t, x, y }, i) => {
        t.homeX = x
        t.homeY = y
        t.c.setPosition(x, y)
        if (!ctx.reduceMotion) {
          t.c.setScale(0)
          scene.tweens.add({ targets: t.c, scale: 1, duration: 180, delay: i * 25, ease: 'Back.easeOut' })
        }
      })
    }

    const undoBtn = createButton(scene, area.cx - 150, area.bottom - 40, '⌫  UNDO', COLORS.chrome, COLORS.chromeDeep, 200, 52)
    undoBtn.on('pointerdown', undo)
    const skipBtn = createButton(scene, area.cx + 150, area.bottom - 40, 'SKIP  ⏭', COLORS.chrome, COLORS.chromeDeep, 200, 52)
    skipBtn.on('pointerdown', skip)
    root.add([undoBtn, skipBtn])

    ctx.onKey(ev => {
      if (ev.key === 'Backspace') { undo(); return true }
      if (ev.code === 'Space') { skip(); return true }
      return false
    })

    next()
    return { stop() { busy = true } }
  },
}
