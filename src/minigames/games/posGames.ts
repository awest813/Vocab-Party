import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { COLORS, FONT, hexColor } from '../../ui/Theme'
import type { LexWord, PartOfSpeech } from '../ContentBank'
import type { MinigameDef } from '../types'
import { drawCard } from '../ui'

const POS_LIST: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
const POS_PLURAL: Record<PartOfSpeech, string> = { noun: 'NOUNS', verb: 'VERBS', adjective: 'ADJECTIVES', adverb: 'ADVERBS' }
const POS_COLOR: Record<PartOfSpeech, number> = { noun: 0x3d8fff, verb: 0xff6b6b, adjective: 0x44dd88, adverb: 0xffb84a }
const POS_HINT: Record<PartOfSpeech, string> = {
  noun: 'person, place, thing, or idea',
  verb: 'action or state of being',
  adjective: 'describes a noun',
  adverb: 'describes a verb — often ends in -ly',
}

/**
 * Words commonly used as more than one part of speech. Whack-a-Word shows words with no
 * context sentence, so these would be unfair there (Word Sorter shows a sentence and keeps them).
 */
const DUAL_POS = new Set([
  'benefit', 'bottom', 'compromise', 'conflict', 'debate', 'display', 'encounter', 'finish', 'grab', 'hurry',
  'journey', 'lift', 'mess', 'mistake', 'noise', 'praise', 'promise', 'puzzle', 'quarrel', 'remedy', 'repair',
  'reward', 'rumor', 'shelter', 'storm', 'struggle', 'treasure', 'triumph', 'venture', 'whisper', 'wander',
  'scatter', 'tumble', 'climb', 'complex', 'hollow', 'yearn', 'admit', 'invite', 'dawn', 'fragment',
  'surplus',
])

interface Mole {
  hole: number
  c: Phaser.GameObjects.Container
  word: LexWord
  good: boolean
  dead: boolean
  ttl: number
}

/** Numpad-style mapping so the 3×3 grid matches the keyboard layout. */
const HOLE_KEYS: Record<string, number> = {
  Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8,
  Digit7: 0, Digit8: 1, Digit9: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit1: 6, Digit2: 7, Digit3: 8,
  KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8,
}

export const whackAWord: MinigameDef = {
  id: 'whack-a-word',
  title: 'Whack-a-Word',
  icon: '🔨',
  accent: COLORS.warning,
  category: 'Grammar',
  tagline: 'Bonk the right part of speech when it pops up!',
  howTo: [
    'Words pop out of the holes. Whack only the kind on the sign.',
    'Right whack +1 · wrong whack −1.',
    'The sign changes — stay sharp!',
  ],
  controls: { keys: 'Click · or Q W E / A S D / Z X C (numpad 1–9 too)', touch: 'Tap the words' },
  durationMs: 30000,
  cpu: { easy: [5, 9], normal: [8, 12], hard: [13, 17] },
  start(ctx) {
    const { scene, root, area } = ctx
    let targetPos: PartOfSpeech = Phaser.Utils.Array.GetRandom(POS_LIST) as PartOfSpeech
    const moles: (Mole | null)[] = Array(9).fill(null)
    let spawnIn = 300
    let signAge = 0

    const sign = scene.add.container(area.cx, area.top + 46)
    const signBg = scene.add.graphics()
    const signText = scene.add.text(0, -6, '', {
      fontSize: '34px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5)
    const signHint = scene.add.text(0, 26, '', { fontSize: '15px', fontFamily: FONT.body, color: '#e8f2ff' }).setOrigin(0.5)
    sign.add([signBg, signText, signHint])
    root.add(sign)

    const renderSign = () => {
      const col = POS_COLOR[targetPos]
      signBg.clear()
      signBg.fillStyle(0x000000, 0.4)
      signBg.fillRoundedRect(-260, -38, 520, 82, 18)
      signBg.fillStyle(col, 0.95)
      signBg.fillRoundedRect(-260, -42, 520, 80, 18)
      signBg.lineStyle(3, 0xffffff, 0.6)
      signBg.strokeRoundedRect(-260, -42, 520, 80, 18)
      signText.setText(`🔨 WHACK THE ${POS_PLURAL[targetPos]}!`)
      signHint.setText(POS_HINT[targetPos])
      if (!ctx.reduceMotion) {
        sign.setScale(1.15)
        scene.tweens.add({ targets: sign, scale: 1, duration: 240, ease: 'Back.easeOut' })
      }
    }

    const gridTop = area.top + 128
    const cellW = Math.min(250, (area.width - 40) / 3)
    const cellH = Math.min(150, (area.bottom - gridTop - 10) / 3)
    const holePos = (i: number) => ({
      x: area.cx + ((i % 3) - 1) * cellW,
      y: gridTop + Math.floor(i / 3) * cellH + cellH * 0.62,
    })

    const holes = scene.add.graphics()
    const lips = scene.add.graphics()
    for (let i = 0; i < 9; i++) {
      const { x, y } = holePos(i)
      holes.fillStyle(0x3b2a1a, 1)
      holes.fillEllipse(x, y + 4, 190, 50)
      holes.fillStyle(0x0b0705, 1)
      holes.fillEllipse(x, y, 170, 40)
      lips.fillStyle(0x5a4028, 1)
      lips.fillRect(x - 100, y + 4, 200, 30)
      lips.fillStyle(0x6e5034, 1)
      lips.fillEllipse(x, y + 6, 196, 22)
    }
    root.add(holes)

    const moleLayer = scene.add.container(0, 0)
    root.add(moleLayer)
    root.add(lips)
    if (!ctx.touch) {
      // Key hints go on top of the lips so they stay readable.
      ['Q', 'W', 'E', 'A', 'S', 'D', 'Z', 'X', 'C'].forEach((label, i) => {
        const { x, y } = holePos(i)
        root.add(scene.add.text(x + 84, y + 22, label, {
          fontSize: '15px', fontFamily: FONT.display, color: '#f3d9b5', stroke: '#2a1a0a', strokeThickness: 3,
        }).setOrigin(0.5))
      })
    }

    const hideMole = (m: Mole, how: 'hit' | 'bad' | 'timeout') => {
      if (m.dead) return
      m.dead = true
      moles[m.hole] = null
      const { y } = holePos(m.hole)
      if (how === 'hit') {
        scene.tweens.add({ targets: m.c, scaleY: 0.4, y: y + 40, duration: 140, ease: 'Cubic.easeIn', onComplete: () => m.c.destroy() })
      } else {
        scene.tweens.add({ targets: m.c, y: y + 80, duration: 180, ease: 'Cubic.easeIn', onComplete: () => m.c.destroy() })
      }
    }

    const whack = (i: number) => {
      const m = moles[i]
      if (!m || m.dead || ctx.isOver()) return
      const { x, y } = holePos(i)
      if (m.good) {
        Sfx.bonk(true)
        ctx.addScore(1, x, y - 90)
        ctx.recordWord(m.word.word, true, `${m.word.pos}: ${m.word.definition}`)
        hideMole(m, 'hit')
      } else {
        Sfx.wrong()
        ctx.addScore(-1, x, y - 90)
        ctx.recordWord(m.word.word, false, `“${m.word.word}” is a${m.word.pos === 'adjective' || m.word.pos === 'adverb' ? 'n' : ''} ${m.word.pos}`)
        const nope = scene.add.text(x, y - 60, `${m.word.pos}!`, {
          fontSize: '20px', fontFamily: FONT.display, color: '#ffb3b3', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5)
        root.add(nope)
        scene.tweens.add({ targets: nope, alpha: 0, y: y - 90, duration: 700, onComplete: () => nope.destroy() })
        hideMole(m, 'bad')
      }
    }

    const spawn = () => {
      const free = moles.map((m, i) => (m ? -1 : i)).filter(i => i >= 0)
      if (free.length === 0) return
      const hole = Phaser.Utils.Array.GetRandom(free) as number
      const wantGood = Math.random() < 0.48
      const word = ctx.bank.word(
        w => !DUAL_POS.has(w.word) && (wantGood ? w.pos === targetPos : w.pos !== targetPos),
        `whack:${wantGood ? '' : 'not-'}${targetPos}`,
      )
      // Derive from the word itself, in case the filtered pool was empty and fell back.
      const good = word.pos === targetPos
      const { x, y } = holePos(hole)
      const c = scene.add.container(x, y + 80)
      const g = scene.add.graphics()
      const w = Math.max(130, Math.min(cellW - 30, word.word.length * 16 + 40))
      // critter body
      g.fillStyle(0x8a5a3c, 1)
      g.fillRoundedRect(-w / 2, -70, w, 96, 30)
      g.fillStyle(0xffffff, 0.12)
      g.fillRoundedRect(-w / 2 + 8, -64, w - 16, 22, 12)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(-18, -50, 7)
      g.fillCircle(18, -50, 7)
      g.fillStyle(0x111111, 1)
      g.fillCircle(-17, -49, 3.5)
      g.fillCircle(19, -49, 3.5)
      g.fillStyle(0xfff3d6, 1)
      g.fillRoundedRect(-w / 2 + 8, -34, w - 16, 40, 10)
      const t = scene.add.text(0, -14, word.word, {
        fontSize: word.word.length > 9 ? '19px' : '22px', fontFamily: FONT.display, color: '#3a2a10',
      }).setOrigin(0.5)
      const hit = scene.add.rectangle(0, -26, w + 10, 110, 0, 0.001).setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => whack(hole))
      c.add([g, t, hit])
      // Mask so the critter appears to rise out of the hole.
      const maskShape = scene.make.graphics({}, false)
      maskShape.fillStyle(0xffffff)
      maskShape.fillRect(x - cellW / 2, y - 140, cellW, 146)
      c.setMask(maskShape.createGeometryMask())
      c.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy())
      moleLayer.add(c)
      const m: Mole = { hole, c, word, good, dead: false, ttl: Phaser.Math.Between(1300, 1800) - Math.min(500, (30000 - ctx.timeLeftMs()) / 50) }
      moles[hole] = m
      scene.tweens.add({ targets: c, y: y - 14, duration: 140, ease: 'Back.easeOut' })
    }

    ctx.onKey(ev => {
      const i = HOLE_KEYS[ev.code]
      if (i === undefined) return false
      whack(i)
      return true
    })

    renderSign()
    return {
      update(_t, delta) {
        if (ctx.isOver()) return
        spawnIn -= delta
        signAge += delta
        if (spawnIn <= 0) {
          spawn()
          spawnIn = Phaser.Math.Between(420, 640)
        }
        for (const m of moles) {
          if (!m || m.dead) continue
          m.ttl -= delta
          if (m.ttl <= 0) hideMole(m, 'timeout')
        }
        if (signAge > 9000) {
          signAge = 0
          const others = POS_LIST.filter(p => p !== targetPos)
          targetPos = Phaser.Utils.Array.GetRandom(others) as PartOfSpeech
          moles.forEach(m => { if (m) hideMole(m, 'timeout') })
          renderSign()
          ctx.flash('🔔 NEW SIGN!', '#ffe066')
        }
      },
      stop() {
        moles.forEach(m => { if (m) m.dead = true })
      },
    }
  },
}

export const wordSorter: MinigameDef = {
  id: 'word-sorter',
  title: 'Word Sorter',
  icon: '📦',
  accent: 0x3d8fff,
  category: 'Grammar',
  tagline: 'Sort each word into the right part-of-speech bin.',
  howTo: [
    'Read the word in its sentence.',
    'Drop it in the NOUN, VERB, ADJECTIVE, or ADVERB bin.',
    'Fast sorting builds streak bonuses!',
  ],
  controls: { keys: 'Keys 1–4 or click a bin', touch: 'Tap a bin' },
  durationMs: 30000,
  cpu: { easy: [5, 9], normal: [9, 13], hard: [13, 16] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    let current: { w: LexWord; card: Phaser.GameObjects.Container } | null = null
    let locked = false
    let streak = 0

    const binY = area.bottom - 92
    const binW = Math.min(220, (area.width - 60) / 4)
    const binX = (i: number) => area.cx + (i - 1.5) * (binW + 14)
    const bins: { g: Phaser.GameObjects.Graphics; pos: PartOfSpeech }[] = []

    const drawBin = (g: Phaser.GameObjects.Graphics, pos: PartOfSpeech, state: 'idle' | 'good' | 'bad' | 'hint') => {
      const col = state === 'good' ? 0x1fae55 : state === 'bad' ? 0xc63b3b : POS_COLOR[pos]
      g.clear()
      g.fillStyle(0x000000, 0.35)
      g.fillRoundedRect(-binW / 2 + 3, -60, binW, 132, 18)
      g.fillStyle(col, state === 'idle' ? 0.85 : 1)
      g.fillRoundedRect(-binW / 2, -66, binW, 132, 18)
      g.fillStyle(0x000000, 0.25)
      g.fillRoundedRect(-binW / 2 + 12, -54, binW - 24, 30, 10)
      g.lineStyle(state === 'hint' ? 6 : 3, 0xffffff, state === 'hint' ? 1 : 0.6)
      g.strokeRoundedRect(-binW / 2, -66, binW, 132, 18)
    }

    POS_LIST.forEach((pos, i) => {
      const c = scene.add.container(binX(i), binY)
      const g = scene.add.graphics()
      drawBin(g, pos, 'idle')
      c.add(g)
      c.add(scene.add.text(0, -39, ctx.touch ? '' : `${i + 1}`, { fontSize: '18px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0.5))
      c.add(scene.add.text(0, 6, pos.toUpperCase(), {
        fontSize: binW < 200 ? '21px' : '24px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5))
      c.add(scene.add.text(0, 40, POS_HINT[pos], {
        fontSize: '12px', fontFamily: FONT.body, color: '#ffffff', align: 'center', wordWrap: { width: binW - 20 },
      }).setOrigin(0.5).setAlpha(0.85))
      const hit = scene.add.rectangle(0, 0, binW, 132, 0, 0.001).setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => sort(i))
      c.add(hit)
      root.add(c)
      bins.push({ g, pos })
    })

    const showWord = () => {
      if (ctx.isOver()) return
      const w = ctx.bank.word(x => x.sentence.toLowerCase().includes(x.word), 'sorter')
      const card = scene.add.container(area.cx, area.top + 130)
      card.add(drawCard(scene, Math.min(area.width - 40, 820), 210, accent))
      card.add(scene.add.text(0, -76, 'WHAT PART OF SPEECH?', { fontSize: '15px', fontFamily: FONT.display, color: hexColor(accent) }).setOrigin(0.5))
      card.add(scene.add.text(0, -20, w.word.toUpperCase(), {
        fontSize: '58px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5))
      const idx = w.sentence.toLowerCase().indexOf(w.word)
      const sentence = idx >= 0
        ? `${w.sentence.slice(0, idx)}${w.word.toUpperCase()}${w.sentence.slice(idx + w.word.length)}`
        : w.sentence
      card.add(scene.add.text(0, 56, `“${sentence}”`, {
        fontSize: '20px', fontFamily: FONT.body, color: '#c8d8ff', fontStyle: 'italic', align: 'center', wordWrap: { width: 760 },
      }).setOrigin(0.5))
      root.add(card)
      if (!ctx.reduceMotion) {
        card.setY(area.top + 70).setAlpha(0)
        scene.tweens.add({ targets: card, y: area.top + 130, alpha: 1, duration: 180, ease: 'Back.easeOut' })
      }
      current = { w, card }
      locked = false
    }

    const sort = (i: number) => {
      if (!current || locked || ctx.isOver()) return
      locked = true
      const { w, card } = current
      const chosen = bins[i]
      const rightIdx = POS_LIST.indexOf(w.pos)
      const fly = (toIdx: number, after: number) => {
        scene.tweens.add({
          targets: card, x: binX(toIdx), y: binY - 20, scale: 0.15, alpha: 0, duration: 260, ease: 'Cubic.easeIn',
          onComplete: () => card.destroy(),
        })
        ctx.after(after, () => {
          bins.forEach(b => drawBin(b.g, b.pos, 'idle'))
          showWord()
        })
      }
      if (chosen.pos === w.pos) {
        streak++
        Sfx.combo(streak)
        drawBin(chosen.g, chosen.pos, 'good')
        ctx.addScore(1, binX(i), binY - 90)
        if (streak % 5 === 0) {
          // Award now so the buzzer can't swallow it; only the flash is cosmetic.
          ctx.addScore(1, binX(i) + 60, binY - 120)
          Sfx.streakBonus()
          ctx.flash(`🔥 STREAK ×${streak}`, '#ffb84a')
        }
        ctx.recordWord(w.word, true, `${w.pos}: ${w.definition}`)
        fly(i, 300)
      } else {
        streak = 0
        Sfx.wrong()
        drawBin(chosen.g, chosen.pos, 'bad')
        drawBin(bins[rightIdx].g, bins[rightIdx].pos, 'hint')
        const tag = scene.add.text(binX(rightIdx), binY - 92, `✓ ${w.pos.toUpperCase()}`, {
          fontSize: '20px', fontFamily: FONT.display, color: '#7dffb0', stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5)
        root.add(tag)
        scene.tweens.add({ targets: tag, alpha: 0, delay: 900, duration: 250, onComplete: () => tag.destroy() })
        ctx.recordWord(w.word, false, `“${w.word}” is used as a${w.pos === 'adjective' || w.pos === 'adverb' ? 'n' : ''} ${w.pos} here`)
        if (!ctx.reduceMotion) scene.tweens.add({ targets: card, x: card.x + 10, duration: 45, yoyo: true, repeat: 3 })
        ctx.after(800, () => fly(rightIdx, 320))
      }
    }

    ctx.onKey(ev => {
      const map: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }
      const i = map[ev.code]
      if (i === undefined) return false
      sort(i)
      return true
    })

    showWord()
    return { stop() { locked = true } }
  },
}
