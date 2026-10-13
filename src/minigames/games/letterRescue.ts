import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { FONT, hexColor } from '../../ui/Theme'
import type { LexWord } from '../ContentBank'
import type { MinigameDef } from '../types'
import { drawCard } from '../ui'

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const LIVES = 6
const BALLOON_COLORS = [0xff5c5c, 0xffb84a, 0xf4c430, 0x44dd88, 0x5eb7ff, 0xb45cff]

export const letterRescue: MinigameDef = {
  id: 'letter-rescue',
  title: 'Letter Rescue',
  icon: '🎈',
  accent: 0xff7a59,
  category: 'Spelling',
  tagline: 'Guess the hidden word letter by letter before the balloons pop!',
  howTo: [
    'Read the clue and guess letters to reveal the hidden word.',
    'Each wrong letter pops a balloon — lose all six and the word escapes.',
    'Solve it for +1 (long words +2). Pop 1 balloon or fewer for +1 bonus!',
  ],
  controls: { keys: 'Type letters on your keyboard', touch: 'Tap the letter keys' },
  durationMs: 50000,
  cpu: { easy: [3, 6], normal: [6, 10], hard: [10, 14] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    let word!: LexWord
    let guessed = new Set<string>()
    let lives = LIVES
    let busy = false
    let objs: Phaser.GameObjects.GameObject[] = []
    let slotTexts: Phaser.GameObjects.Text[] = []
    let balloons: Phaser.GameObjects.Container[] = []
    const keyButtons = new Map<string, { g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Rectangle }>()

    const keyW = Math.min(58, (area.width - 60) / 10 - 6)
    const keyH = 52
    const kbTop = area.bottom - 3 * (keyH + 8) - 6

    const drawKey = (letter: string, state: 'idle' | 'hit' | 'miss') => {
      const k = keyButtons.get(letter)
      if (!k) return
      const fill = state === 'hit' ? 0x1fae55 : state === 'miss' ? 0x3a2030 : 0x1b2942
      k.g.clear()
      k.g.fillStyle(0x000000, 0.35)
      k.g.fillRoundedRect(-keyW / 2 + 1, -keyH / 2 + 4, keyW, keyH, 10)
      k.g.fillStyle(fill, 1)
      k.g.fillRoundedRect(-keyW / 2, -keyH / 2, keyW, keyH, 10)
      k.g.lineStyle(2, state === 'idle' ? accent : 0x2a3548, state === 'idle' ? 0.7 : 1)
      k.g.strokeRoundedRect(-keyW / 2, -keyH / 2, keyW, keyH, 10)
      k.t.setAlpha(state === 'miss' ? 0.3 : 1)
      if (state !== 'idle') k.hit.disableInteractive()
      else k.hit.setInteractive({ useHandCursor: true })
    }

    ROWS.forEach((row, r) => {
      const rowW = row.length * (keyW + 6) - 6
      row.split('').forEach((letter, i) => {
        const x = area.cx - rowW / 2 + keyW / 2 + i * (keyW + 6)
        const y = kbTop + keyH / 2 + r * (keyH + 8)
        const c = scene.add.container(x, y)
        const g = scene.add.graphics()
        const t = scene.add.text(0, -2, letter, { fontSize: '24px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0.5)
        const hit = scene.add.rectangle(0, 0, keyW, keyH, 0, 0.001).setInteractive({ useHandCursor: true })
        hit.on('pointerdown', () => guess(letter.toLowerCase()))
        c.add([g, t, hit])
        root.add(c)
        keyButtons.set(letter.toLowerCase(), { g, t, hit })
        drawKey(letter.toLowerCase(), 'idle')
      })
    })

    const renderSlots = (revealAll = false) => {
      slotTexts.forEach((t, i) => {
        const ch = word.word[i]
        const shown = revealAll || guessed.has(ch)
        t.setText(shown ? ch.toUpperCase() : '')
        if (revealAll && !guessed.has(ch)) t.setColor('#ff8888')
      })
    }

    const popBalloon = () => {
      const b = balloons[lives]
      if (!b) return
      if (ctx.reduceMotion) {
        b.setVisible(false)
        return
      }
      scene.tweens.add({ targets: b, scale: 1.5, alpha: 0, duration: 180, ease: 'Cubic.easeOut' })
    }

    const finishWord = (solved: boolean) => {
      busy = true
      if (solved) {
        Sfx.correct()
        const pts = (word.word.length >= 7 ? 2 : 1) + (lives >= LIVES - 1 ? 1 : 0)
        ctx.addScore(pts, area.cx, area.top + 220)
        ctx.recordWord(word.word, true, word.definition)
        if (!ctx.reduceMotion) slotTexts.forEach((t, i) => scene.tweens.add({ targets: t, y: t.y - 14, duration: 120, delay: i * 30, yoyo: true }))
        ctx.after(800, nextWord)
      } else {
        Sfx.wrong()
        renderSlots(true)
        ctx.recordWord(word.word, false, word.definition)
        ctx.flash(`It was “${word.word.toUpperCase()}”`, '#ffb3b3')
        ctx.after(1400, nextWord)
      }
    }

    const guess = (letter: string) => {
      if (busy || ctx.isOver() || guessed.has(letter) || !/^[a-z]$/.test(letter)) return
      guessed.add(letter)
      if (word.word.includes(letter)) {
        Sfx.uiClick()
        drawKey(letter, 'hit')
        renderSlots()
        if (word.word.split('').every(ch => guessed.has(ch))) finishWord(true)
      } else {
        Sfx.clunk()
        drawKey(letter, 'miss')
        lives--
        popBalloon()
        if (lives <= 0) finishWord(false)
      }
    }

    const nextWord = () => {
      if (ctx.isOver()) return
      objs.forEach(o => o.destroy())
      objs = []
      slotTexts = []
      balloons = []
      guessed = new Set()
      lives = LIVES
      busy = false
      keyButtons.forEach((_, letter) => drawKey(letter, 'idle'))
      word = ctx.bank.word(w => w.word.length >= 4 && w.word.length <= 10 && /^[a-z]+$/.test(w.word), 'rescue')

      const card = scene.add.container(area.cx, area.top + 66)
      card.add(drawCard(scene, Math.min(area.width - 20, 860), 116, accent))
      card.add(scene.add.text(0, -34, `CLUE · ${word.pos.toUpperCase()} · ${word.word.length} LETTERS`, {
        fontSize: '14px', fontFamily: FONT.display, color: hexColor(accent),
      }).setOrigin(0.5))
      card.add(scene.add.text(0, 10, `“${word.definition}”`, {
        fontSize: word.definition.length > 44 ? '22px' : '27px', fontFamily: FONT.display, color: '#ffffff',
        stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 800 },
      }).setOrigin(0.5))
      root.add(card)
      objs.push(card)

      // Letter slots
      const n = word.word.length
      const gap = Math.min(60, (area.width - 120) / n)
      const slotY = area.top + 200
      const x0 = area.cx - ((n - 1) * gap) / 2
      for (let i = 0; i < n; i++) {
        const line = scene.add.graphics()
        line.lineStyle(4, 0xffffff, 0.8)
        line.lineBetween(x0 + i * gap - gap * 0.36, slotY + 26, x0 + i * gap + gap * 0.36, slotY + 26)
        const t = scene.add.text(x0 + i * gap, slotY, '', {
          fontSize: '40px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5)
        root.add([line, t])
        objs.push(line, t)
        slotTexts.push(t)
      }

      // Balloons (lives)
      const by = area.top + 290
      for (let i = 0; i < LIVES; i++) {
        const bx = area.cx + (i - (LIVES - 1) / 2) * 54
        const b = scene.add.container(bx, by)
        const g = scene.add.graphics()
        g.lineStyle(2, 0xffffff, 0.5)
        g.lineBetween(0, 18, 0, 40)
        g.fillStyle(BALLOON_COLORS[i], 1)
        g.fillEllipse(0, 0, 34, 42)
        g.fillStyle(0xffffff, 0.45)
        g.fillEllipse(-7, -8, 9, 13)
        b.add(g)
        root.add(b)
        objs.push(b)
        balloons.push(b)
        if (!ctx.reduceMotion) scene.tweens.add({ targets: b, y: by - 5, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }

      // Free first letter so every word is approachable.
      guess(word.word[0])
    }

    ctx.onKey(ev => {
      // Leave browser shortcuts (Ctrl/Cmd+R, etc.) alone.
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false
      const k = ev.key.toLowerCase()
      if (/^[a-z]$/.test(k)) {
        guess(k)
        return true
      }
      return false
    })

    nextWord()
    return { stop() { busy = true } }
  },
}
