import Phaser from 'phaser'
import { Sfx } from '../systems/Sfx'
import { FONT, hexColor } from '../ui/Theme'
import type { MinigameContext, MinigameInstance } from './types'
import { createChoiceTile, drawCard, KEY_TO_INDEX, type ChoiceTile } from './ui'

export interface RapidQuestion {
  /** Small label above the prompt, e.g. "WHAT DOES IT MEAN?" */
  kicker: string
  prompt: string
  promptSize?: number
  /** Optional smaller line under the prompt (example sentence, hint…). */
  detail?: string
  choices: string[]
  correct: number
  /** Word recorded for the study sheet. */
  word?: string
  /** Short explanation recorded with misses. */
  note?: string
  layout?: 'grid' | 'stack'
}

export interface RapidFireOptions {
  /** Pause after a miss while the right answer is shown. */
  missPauseMs?: number
  /** Every N correct in a row grants +1 bonus. */
  streakEvery?: number
  /** Shuffle answer order (default true). */
  shuffle?: boolean
}

/**
 * Shared rapid-fire quiz loop: answer as many as you can before the clock runs out.
 * Correct = +1 (streak bonus every N), miss = shows the answer and costs time.
 */
export function runRapidFire(ctx: MinigameContext, next: () => RapidQuestion, opts: RapidFireOptions = {}): MinigameInstance {
  const { scene, root, area, accent } = ctx
  const missPause = opts.missPauseMs ?? 1100
  const streakEvery = opts.streakEvery ?? 4
  let streak = 0
  let locked = false
  let current: { q: RapidQuestion; tiles: ChoiceTile[]; card: Phaser.GameObjects.Container } | null = null

  const streakText = scene.add.text(area.cx, area.bottom - 18, '', {
    fontSize: '18px', fontFamily: FONT.display, color: '#ffb84a', stroke: '#000000', strokeThickness: 4,
  }).setOrigin(0.5)
  root.add(streakText)

  const renderStreak = () => {
    streakText.setText(streak >= 2 ? `🔥 ${streak} in a row${streak % streakEvery === streakEvery - 1 ? ' — one more for a bonus!' : ''}` : '')
  }

  const show = () => {
    if (ctx.isOver()) return
    const raw = next()
    const q = { ...raw }
    if (opts.shuffle !== false) {
      const order = q.choices.map((_, i) => i)
      Phaser.Utils.Array.Shuffle(order)
      q.choices = order.map(i => raw.choices[i])
      q.correct = order.indexOf(raw.correct)
    }
    const layout = q.layout ?? (q.choices.some(c => c.length > 28) ? 'stack' : 'grid')

    const card = scene.add.container(area.cx, 0)
    root.add(card)
    const cardH = q.detail ? 200 : 170
    // Vertically center the whole question block (card + answers) in the play area.
    const n0 = q.choices.length
    const tilesH = layout === 'stack'
      ? n0 * ((n0 > 3 ? 62 : 70) + 12) - 12
      : Math.ceil(n0 / 2) * (84 + 16) - 16
    const blockH = cardH + 26 + tilesH
    const usable = area.bottom - area.top - 40
    const cardY = area.top + Math.max(6, (usable - blockH) / 2) + cardH / 2
    card.setY(cardY)
    card.add(drawCard(scene, Math.min(area.width - 20, 900), cardH, accent))
    card.add(scene.add.text(0, -cardH / 2 + 30, q.kicker, {
      fontSize: '16px', fontFamily: FONT.display, color: hexColor(accent), letterSpacing: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5))
    const promptSize = q.promptSize ?? (q.prompt.length > 60 ? 24 : q.prompt.length > 30 ? 30 : q.prompt.length > 14 ? 44 : 56)
    card.add(scene.add.text(0, q.detail ? -12 : 10, q.prompt, {
      fontSize: `${promptSize}px`, fontFamily: FONT.display, color: '#ffffff',
      stroke: '#000000', strokeThickness: 5, align: 'center', wordWrap: { width: 840 },
    }).setOrigin(0.5))
    if (q.detail) {
      card.add(scene.add.text(0, cardH / 2 - 34, q.detail, {
        fontSize: '19px', fontFamily: FONT.body, color: '#c8d8ff', fontStyle: 'italic',
        align: 'center', wordWrap: { width: 820 },
      }).setOrigin(0.5))
    }

    const tiles: ChoiceTile[] = []
    const startY = cardY + cardH / 2 + 26
    const n = q.choices.length
    q.choices.forEach((choice, i) => {
      let x: number, y: number, w: number, h: number
      if (layout === 'stack') {
        w = Math.min(area.width - 40, 880)
        h = n > 3 ? 62 : 70
        x = area.cx
        y = startY + h / 2 + i * (h + 12)
      } else {
        w = Math.min(420, (area.width - 60) / 2)
        h = 84
        const col = i % 2
        const row = Math.floor(i / 2)
        x = area.cx + (col === 0 ? -1 : 1) * (w / 2 + 10)
        if (n === 3 && i === 2) x = area.cx
        y = startY + h / 2 + row * (h + 16)
      }
      const tile = createChoiceTile(scene, x, y, w, h, choice, String(i + 1), accent, () => pick(i))
      tile.choiceIndex = i
      root.add(tile)
      tiles.push(tile)
    })

    if (!ctx.reduceMotion) {
      card.setAlpha(0).setScale(0.94)
      scene.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 160, ease: 'Back.easeOut' })
      tiles.forEach((t, i) => {
        t.setAlpha(0).setY(t.y + 14)
        scene.tweens.add({ targets: t, alpha: 1, y: t.y - 14, duration: 150, delay: 30 + i * 30, ease: 'Cubic.easeOut' })
      })
    }
    current = { q, tiles, card }
    locked = false
  }

  const clear = () => {
    if (!current) return
    current.tiles.forEach(t => t.destroy())
    current.card.destroy()
    current = null
  }

  const pick = (i: number) => {
    if (!current || locked || ctx.isOver()) return
    const { q, tiles } = current
    if (i < 0 || i >= tiles.length) return
    locked = true
    const tile = tiles[i]
    if (i === q.correct) {
      streak++
      tile.setChoiceState('correct')
      tiles.forEach((t, j) => { if (j !== i) t.setChoiceState('off') })
      Sfx.correct()
      ctx.addScore(1, tile.x, tile.y - 30)
      if (streak % streakEvery === 0) {
        ctx.after(120, () => {
          ctx.addScore(1, tile.x + 70, tile.y - 60)
          ctx.flash(`🔥 STREAK BONUS ×${streak}`, '#ffb84a')
        })
      }
      if (q.word) ctx.recordWord(q.word, true, q.note)
      renderStreak()
      ctx.after(260, () => { clear(); show() })
    } else {
      streak = 0
      renderStreak()
      tile.setChoiceState('wrong')
      tiles[q.correct]?.setChoiceState('reveal')
      tiles.forEach((t, j) => { if (j !== i && j !== q.correct) t.setChoiceState('off') })
      Sfx.wrong()
      if (!ctx.reduceMotion) {
        scene.tweens.add({ targets: tile, x: tile.x + 8, duration: 45, yoyo: true, repeat: 3 })
      }
      if (q.word) ctx.recordWord(q.word, false, q.note)
      ctx.after(missPause, () => { clear(); show() })
    }
  }

  ctx.onKey(ev => {
    const idx = KEY_TO_INDEX[ev.code]
    if (idx === undefined) return false
    pick(idx)
    return true
  })

  show()

  return {
    stop() {
      locked = true
      current?.tiles.forEach(t => t.setChoiceState('off'))
    },
  }
}
