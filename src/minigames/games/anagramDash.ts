import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { createButton } from '../../ui/Button'
import { COLORS, FONT, hexColor } from '../../ui/Theme'
import type { LexWord } from '../ContentBank'
import type { MinigameDef } from '../types'
import { drawCard } from '../ui'

interface LetterTile {
  c: Phaser.GameObjects.Container
  letter: string
  homeX: number
  homeY: number
  used: boolean
}

function scramble(word: string): string[] {
  const letters = word.split('')
  for (let tries = 0; tries < 12; tries++) {
    Phaser.Utils.Array.Shuffle(letters)
    if (letters.join('') !== word) break
  }
  return letters
}

export const anagramDash: MinigameDef = {
  id: 'anagram-dash',
  title: 'Anagram Dash',
  icon: '🔤',
  accent: 0x7c5cff,
  category: 'Spelling',
  tagline: 'Unscramble the letters to spell the mystery word.',
  howTo: [
    'Read the definition, then rebuild the scrambled word.',
    'Long words (7+ letters) are worth double.',
    'Stuck? A hint letter appears — or skip it.',
  ],
  controls: { keys: 'Type letters · Backspace undo · Tab skip', touch: 'Tap letters · ⌫ undo' },
  durationMs: 45000,
  cpu: { easy: [2, 4], normal: [4, 6], hard: [6, 8] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    let word: LexWord
    let tiles: LetterTile[] = []
    let slots: { x: number; y: number; box: Phaser.GameObjects.Graphics }[] = []
    let placed: LetterTile[] = []
    let hinted = 0
    let busy = false
    let missedThis = false
    let wordObjs: Phaser.GameObjects.GameObject[] = []
    let hintTimer: Phaser.Time.TimerEvent | undefined

    const cardY = area.top + 92
    const slotY = area.top + 262
    const tileY = area.top + 372

    const pickWord = (): LexWord => ctx.bank.word(w => w.word.length >= 4 && w.word.length <= 9 && /^[a-z]+$/.test(w.word), 'anagram')

    const drawSlot = (g: Phaser.GameObjects.Graphics, state: 'empty' | 'filled' | 'good' | 'bad') => {
      g.clear()
      const fill = state === 'good' ? 0x1fae55 : state === 'bad' ? 0xc63b3b : 0x0c1424
      g.fillStyle(fill, state === 'empty' ? 0.85 : 1)
      g.fillRoundedRect(-30, -34, 60, 68, 12)
      g.lineStyle(3, state === 'empty' ? accent : 0xffffff, state === 'empty' ? 0.55 : 0.7)
      g.strokeRoundedRect(-30, -34, 60, 68, 12)
    }

    const makeTile = (letter: string, x: number, y: number): Phaser.GameObjects.Container => {
      const c = scene.add.container(x, y)
      const g = scene.add.graphics()
      g.fillStyle(0x000000, 0.35)
      g.fillRoundedRect(-28, -28, 56, 62, 12)
      g.fillStyle(0xfff3d6, 1)
      g.fillRoundedRect(-28, -32, 56, 60, 12)
      g.fillStyle(0xffffff, 0.6)
      g.fillRoundedRect(-24, -29, 48, 16, 8)
      g.lineStyle(2, 0xc49212, 1)
      g.strokeRoundedRect(-28, -32, 56, 60, 12)
      const t = scene.add.text(0, -2, letter.toUpperCase(), {
        fontSize: '34px', fontFamily: FONT.display, color: '#3a2a10',
      }).setOrigin(0.5)
      const hit = scene.add.rectangle(0, -2, 60, 64, 0, 0.001).setInteractive({ useHandCursor: true })
      c.add([g, t, hit])
      c.setSize(60, 64)
      root.add(c)
      return c
    }

    const clearWord = () => {
      hintTimer?.remove()
      wordObjs.forEach(o => o.destroy())
      wordObjs = []
      tiles = []
      slots = []
      placed = []
    }

    const placeTile = (tile: LetterTile) => {
      if (busy || tile.used || placed.length >= slots.length || ctx.isOver()) return
      tile.used = true
      const slot = slots[placed.length]
      placed.push(tile)
      drawSlot(slot.box, 'filled')
      scene.tweens.add({ targets: tile.c, x: slot.x, y: slot.y, duration: 110, ease: 'Cubic.easeOut' })
      Sfx.uiClick()
      if (placed.length === slots.length) check()
    }

    const undo = () => {
      if (busy || placed.length <= hinted) return
      const tile = placed.pop()!
      tile.used = false
      drawSlot(slots[placed.length].box, 'empty')
      scene.tweens.add({ targets: tile.c, x: tile.homeX, y: tile.homeY, duration: 110, ease: 'Cubic.easeOut' })
    }

    const resetPlaced = () => {
      while (placed.length > hinted) {
        const tile = placed.pop()!
        tile.used = false
        drawSlot(slots[placed.length].box, 'empty')
        scene.tweens.add({ targets: tile.c, x: tile.homeX, y: tile.homeY, duration: 140, ease: 'Cubic.easeOut' })
      }
    }

    const giveHint = () => {
      if (ctx.isOver() || hinted >= word.word.length - 2) return
      // Don't lose the hint if it lands during a wrong-answer flash or skip.
      if (busy) {
        hintTimer = ctx.after(1000, giveHint)
        return
      }
      // Keep a correct start the player already built (lock it in); only clear a wrong one.
      if (placed.every((t, i) => t.letter === word.word[i])) {
        for (let i = hinted; i < placed.length; i++) {
          drawSlot(slots[i].box, 'good')
          placed[i].c.list.forEach(o => { if (o instanceof Phaser.GameObjects.Rectangle) o.disableInteractive() })
        }
        hinted = placed.length
        if (hinted >= word.word.length - 1) return
      } else {
        resetPlaced()
      }
      const need = word.word[hinted]
      const tile = tiles.find(t => !t.used && t.letter === need)
      if (!tile) return
      hinted++
      tile.used = true
      const slot = slots[placed.length]
      placed.push(tile)
      drawSlot(slot.box, 'good')
      scene.tweens.add({ targets: tile.c, x: slot.x, y: slot.y, duration: 160, ease: 'Back.easeOut' })
      tile.c.list.forEach(o => { if (o instanceof Phaser.GameObjects.Rectangle) o.disableInteractive() })
      ctx.flash('💡 HINT', '#ffe066')
      hintTimer = ctx.after(7000, giveHint)
    }

    const check = () => {
      const guess = placed.map(t => t.letter).join('')
      busy = true
      if (guess === word.word) {
        slots.forEach(s => drawSlot(s.box, 'good'))
        Sfx.correct()
        const pts = word.word.length >= 7 ? 2 : 1
        ctx.addScore(pts, area.cx, slotY - 50)
        ctx.recordWord(word.word, true, word.definition)
        if (!ctx.reduceMotion) {
          placed.forEach((t, i) => scene.tweens.add({ targets: t.c, y: t.c.y - 16, duration: 120, delay: i * 25, yoyo: true }))
        }
        ctx.after(520, nextWord)
      } else {
        slots.forEach(s => drawSlot(s.box, 'bad'))
        Sfx.wrong()
        if (!missedThis) {
          missedThis = true
          ctx.recordWord(word.word, false, word.definition)
        }
        const x = scene.add.text(area.cx, slotY + 52, '✗ Try again', {
          fontSize: '20px', fontFamily: FONT.display, color: '#ff8888', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5)
        root.add(x)
        scene.tweens.add({ targets: x, alpha: 0, delay: 350, duration: 250, onComplete: () => x.destroy() })
        if (!ctx.reduceMotion) placed.forEach(t => scene.tweens.add({ targets: t.c, x: t.c.x + 7, duration: 40, yoyo: true, repeat: 3 }))
        ctx.after(380, () => {
          busy = false
          slots.forEach((s, i) => drawSlot(s.box, i < hinted ? 'good' : 'filled'))
          resetPlaced()
        })
      }
    }

    const skip = () => {
      if (busy || ctx.isOver()) return
      busy = true
      if (!missedThis) ctx.recordWord(word.word, false, word.definition)
      ctx.flash(`It was “${word.word.toUpperCase()}”`, '#ffb3b3')
      Sfx.wrong()
      ctx.after(900, nextWord)
    }

    const nextWord = () => {
      if (ctx.isOver()) return
      clearWord()
      busy = false
      missedThis = false
      hinted = 0
      word = pickWord()

      const card = scene.add.container(area.cx, cardY)
      card.add(drawCard(scene, Math.min(area.width - 20, 860), 150, accent))
      card.add(scene.add.text(0, -46, `UNSCRAMBLE · ${word.word.length} LETTERS${word.pos ? ` · ${word.pos.toUpperCase()}` : ''}`, {
        fontSize: '15px', fontFamily: FONT.display, color: hexColor(accent),
      }).setOrigin(0.5))
      card.add(scene.add.text(0, 12, `“${word.definition}”`, {
        fontSize: word.definition.length > 44 ? '26px' : '32px', fontFamily: FONT.display, color: '#ffffff',
        stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 800 },
      }).setOrigin(0.5))
      root.add(card)
      wordObjs.push(card)

      const n = word.word.length
      const gap = 68
      const x0 = area.cx - ((n - 1) * gap) / 2
      for (let i = 0; i < n; i++) {
        const box = scene.add.graphics()
        box.setPosition(x0 + i * gap, slotY)
        drawSlot(box, 'empty')
        root.add(box)
        wordObjs.push(box)
        slots.push({ x: x0 + i * gap, y: slotY, box })
      }

      const letters = scramble(word.word)
      letters.forEach((letter, i) => {
        const x = x0 + i * gap
        const c = makeTile(letter, x, tileY)
        const tile: LetterTile = { c, letter, homeX: x, homeY: tileY, used: false }
        tiles.push(tile)
        wordObjs.push(c)
        c.list.forEach(o => {
          if (o instanceof Phaser.GameObjects.Rectangle) o.on('pointerdown', () => placeTile(tile))
        })
        if (!ctx.reduceMotion) {
          c.setScale(0)
          scene.tweens.add({ targets: c, scale: 1, duration: 200, delay: i * 35, ease: 'Back.easeOut' })
        }
      })
      hintTimer = ctx.after(8000, giveHint)
    }

    if (!ctx.touch) {
      root.add(scene.add.text(area.cx, area.bottom - 92, '⌨ Type the letters on your keyboard', {
        fontSize: '15px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
      }).setOrigin(0.5))
    }

    const undoBtn = createButton(scene, area.cx - 150, area.bottom - 50, '⌫  UNDO', COLORS.chrome, COLORS.chromeDeep, 200, 56)
    undoBtn.on('pointerdown', undo)
    const skipBtn = createButton(scene, area.cx + 150, area.bottom - 50, 'SKIP  ⏭', COLORS.chrome, COLORS.chromeDeep, 200, 56)
    skipBtn.on('pointerdown', skip)
    root.add([undoBtn, skipBtn])

    ctx.onKey(ev => {
      if (ev.key === 'Backspace') { undo(); return true }
      if (ev.code === 'Tab') { skip(); return true }
      const k = ev.key.toLowerCase()
      if (/^[a-z]$/.test(k)) {
        const tile = tiles.find(t => !t.used && t.letter === k)
        if (tile) placeTile(tile)
        return true
      }
      return false
    })

    nextWord()
    return {
      stop() {
        busy = true
        hintTimer?.remove()
      },
    }
  },
}
