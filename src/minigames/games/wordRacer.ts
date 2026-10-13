import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { characterTextureKey } from '../../systems/SpriteFactory'
import { COLORS, FONT, hexColor } from '../../ui/Theme'
import type { LexWord } from '../ContentBank'
import type { MinigameDef, RivalView } from '../types'
import { drawCard } from '../ui'

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

interface Kart {
  c: Phaser.GameObjects.Container
  laneY: number
  shown: number
}

export const wordRacer: MinigameDef = {
  id: 'word-racer',
  title: 'Word Racer',
  icon: '🏎️',
  accent: 0x00d1b2,
  category: 'Spelling',
  tagline: 'Type the word from its definition to zoom ahead!',
  howTo: [
    'Read the definition and type the word — the first letter is free.',
    'Wrong letters bounce off (and slow you down). Finish the word to boost!',
    'Stuck? Hints reveal letters (💡 or Enter) — lean on them too much and the word scores nothing. Tab skips.',
  ],
  controls: { keys: 'Type letters · Enter = hint · Tab = skip', touch: 'Tap letters · 💡 hint · ⏭ skip' },
  durationMs: 45000,
  cpu: { easy: [3, 6], normal: [6, 10], hard: [10, 13] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    const goal = wordRacer.cpu.hard[1]
    let word!: LexWord
    let typed = ''
    let busy = false
    let myScore = 0
    let wordObjs: Phaser.GameObjects.GameObject[] = []
    /** Letters revealed by hints (typed for the player). */
    let hinted = 0
    /** How many letters hints gave away on this word (manual or automatic). */
    let hintCount = 0
    let lastHintAt = -Infinity
    let wordStartedAt = 0
    let lastProgressAt = 0
    let lockUntil = 0
    let elapsed = 0
    const keyViews = new Map<string, Phaser.GameObjects.Container>()

    // ── Track ──
    const trackTop = area.top + 6
    const trackLeft = area.left + 30
    const trackRight = area.right - 40
    const startX = trackLeft + 60
    const finishX = trackRight - 30
    const rivals = ctx.rivals().slice(0, 3)
    const lanes = 1 + Math.max(rivals.length, 0)
    const laneH = Math.min(46, 168 / Math.max(2, lanes))
    const trackH = laneH * Math.max(2, lanes) + 12

    const track = scene.add.graphics()
    track.fillStyle(0x23262e, 1)
    track.fillRoundedRect(trackLeft, trackTop, trackRight - trackLeft, trackH, 12)
    track.lineStyle(3, 0xffffff, 0.5)
    track.strokeRoundedRect(trackLeft, trackTop, trackRight - trackLeft, trackH, 12)
    for (let i = 1; i < Math.max(2, lanes); i++) {
      const y = trackTop + 6 + i * laneH
      for (let x = trackLeft + 12; x < trackRight - 12; x += 28) track.lineBetween(x, y, x + 14, y)
    }
    // checkered finish
    for (let r = 0; r < Math.ceil(trackH / 8); r++) {
      for (let k = 0; k < 2; k++) {
        track.fillStyle((r + k) % 2 === 0 ? 0xffffff : 0x111111, 1)
        track.fillRect(finishX + k * 8, trackTop + r * 8, 8, Math.min(8, trackTop + trackH - (trackTop + r * 8)))
      }
    }
    root.add(track)

    const progressX = (score: number) => startX + (finishX - startX - 20) * Math.min(1, score / goal)

    // Practice mode: medal pace markers instead of rivals
    if (rivals.length === 0) {
      ([['🥉', wordRacer.cpu.easy[1]], ['🥈', wordRacer.cpu.normal[1]], ['🥇', wordRacer.cpu.hard[1]]] as const).forEach(([m, v]) => {
        const x = progressX(v) + 20
        track.lineStyle(2, COLORS.gold, 0.5)
        track.lineBetween(x, trackTop + 4, x, trackTop + trackH - 4)
        root.add(scene.add.text(x, trackTop + trackH + 10, m, { fontSize: '16px' }).setOrigin(0.5))
      })
    }

    const makeKart = (laneIdx: number, color: number, characterIndex: number, label: string): Kart => {
      const laneY = trackTop + 6 + laneIdx * laneH + laneH / 2
      const c = scene.add.container(startX, laneY)
      const g = scene.add.graphics()
      g.fillStyle(0x000000, 0.4)
      g.fillRoundedRect(-30, -8, 60, 22, 8)
      g.fillStyle(color, 1)
      g.fillRoundedRect(-32, -12, 60, 22, 8)
      g.fillStyle(0x111111, 1)
      g.fillCircle(-18, 11, 6)
      g.fillCircle(16, 11, 6)
      c.add(g)
      const tex = characterTextureKey(characterIndex)
      if (characterIndex >= 0 && scene.textures.exists(tex)) c.add(scene.add.image(-2, -16, tex).setDisplaySize(26, 32))
      // Name rides on the kart's bumper so it never leaves the track.
      c.add(scene.add.text(-2, 2, label, {
        fontSize: '10px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5))
      root.add(c)
      return { c, laneY, shown: 0 }
    }
    const me = makeKart(0, COLORS.player[0], 0, 'YOU')
    const placeBadge = scene.add.text(0, -40, '', {
      fontSize: '14px', fontFamily: FONT.display, color: '#0a101c', backgroundColor: '#ffe066', padding: { x: 5, y: 1 },
    }).setOrigin(0.5)
    me.c.add(placeBadge)
    const ORD = ['1st', '2nd', '3rd', '4th']
    /** My current race position (ties go in my favour), and who I was ahead of last time. */
    /** Rivals actually racing (CPUs, or humans who already played) — unplayed humans don't count. */
    const racing = new Set<number>()
    const shownOf = (id: number) => rivalKarts.get(id)?.shown ?? 0
    const active = () => rivals.filter(r => racing.has(r.id))
    const myPlace = () => 1 + active().filter(r => shownOf(r.id) > myScore).length
    /** Rivals strictly ahead of me — passing one of these is what earns a callout. */
    let behindOf = new Set<number>()
    /** Highest-priority callout from this frame (FINISH > PASSED > SPEEDY), shown once. */
    let pendingCallout: { pri: number; text: string; color: string } | null = null
    const callout = (pri: number, text: string, color: string) => {
      if (!pendingCallout || pri > pendingCallout.pri) pendingCallout = { pri, text, color }
    }
    const refreshPlace = () => {
      if (active().length === 0) {
        placeBadge.setVisible(false)
        return
      }
      placeBadge.setVisible(true)
      const pl = myPlace()
      const tied = active().some(r => shownOf(r.id) === myScore)
      placeBadge.setText(`${tied ? '=' : ''}${ORD[pl - 1] ?? `${pl}th`}`)
      placeBadge.setBackgroundColor(pl === 1 ? '#ffe066' : '#cfd8e6')
      const nowBehind = new Set(active().filter(r => shownOf(r.id) > myScore).map(r => r.id))
      for (const id of behindOf) {
        if (!nowBehind.has(id) && shownOf(id) < myScore) {
          const r = rivals.find(x => x.id === id)
          if (r) callout(2, `💨 PASSED ${r.name.toUpperCase()}!`, '#7dffb0')
        }
      }
      behindOf = nowBehind
    }
    const rivalKarts = new Map<number, Kart>()
    rivals.forEach((r: RivalView, i) => rivalKarts.set(r.id, makeKart(i + 1, r.color, r.characterIndex, r.name.slice(0, 8))))

    const moveKart = (k: Kart, score: number) => {
      if (k.shown === score) return
      k.shown = score
      scene.tweens.add({ targets: k.c, x: progressX(score), duration: 420, ease: 'Cubic.easeOut' })
      refreshPlace()
    }

    // ── Prompt + input ──
    const cardY = trackTop + trackH + 74
    const inputY = cardY + 92
    // Letter slots: typed letters in green, hint letters in gold, blanks for the rest.
    const inputText = scene.add.text(area.cx, inputY, '', {
      fontSize: '40px', fontFamily: FONT.display, color: '#7dffb0', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5)
    root.add(inputText)

    const renderInput = () => {
      const letters = word.word.split('').map((ch, i) => (i < typed.length ? ch.toUpperCase() : '_'))
      inputText.setText(letters.join(' '))
      inputText.setColor(hinted > 0 && typed.length <= hinted ? '#ffd24a' : '#7dffb0')
    }

    const nextWord = () => {
      if (ctx.isOver()) return
      wordObjs.forEach(o => o.destroy())
      wordObjs = []
      busy = false
      hinted = 0
      hintCount = 0
      word = ctx.bank.word(w => w.word.length >= 4 && w.word.length <= 10 && /^[a-z]+$/.test(w.word), 'racer')
      typed = word.word[0]
      wordStartedAt = elapsed
      lastProgressAt = elapsed
      const card = scene.add.container(area.cx, cardY)
      card.add(drawCard(scene, Math.min(area.width - 40, 860), 104, accent))
      card.add(scene.add.text(0, -30, `TYPE THE WORD · ${word.word.length} LETTERS · ${word.pos.toUpperCase()}`, {
        fontSize: '14px', fontFamily: FONT.display, color: hexColor(accent),
      }).setOrigin(0.5))
      card.add(scene.add.text(0, 12, `“${word.definition}”`, {
        fontSize: word.definition.length > 44 ? '22px' : '27px', fontFamily: FONT.display, color: '#ffffff',
        stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 800 },
      }).setOrigin(0.5))
      root.add(card)
      wordObjs.push(card)
      renderInput()
    }

    const flashKey = (letter: string, color: number) => {
      const k = keyViews.get(letter)
      if (!k) return
      const glow = scene.add.rectangle(0, 0, keyW, keyH, color, 0.55)
      k.add(glow)
      scene.tweens.add({ targets: glow, alpha: 0, duration: 220, onComplete: () => glow.destroy() })
    }

    const complete = () => {
      busy = true
      Sfx.correct()
      // A word mostly spelled by hints is practice, not a point — otherwise Enter-spam wins races.
      const earned = hintCount * 2 < word.word.length
      if (earned) {
        myScore++
        ctx.addScore(1, me.c.x, me.c.y - 30)
      } else {
        callout(0, '💡 Hint-built — no point', '#ffd24a')
      }
      // Solving with hints still counts, but the Word Book notes it as practice.
      ctx.recordWord(word.word, hinted === 0, word.definition)
      moveKart(me, myScore)
      if (!ctx.reduceMotion) {
        const trail = scene.add.text(me.c.x - 40, me.laneY, '💨', { fontSize: '22px' }).setOrigin(0.5)
        root.add(trail)
        scene.tweens.add({ targets: trail, x: trail.x - 40, alpha: 0, duration: 500, onComplete: () => trail.destroy() })
        scene.tweens.add({ targets: inputText, scale: 1.15, duration: 90, yoyo: true })
      }
      if (myScore === goal) callout(3, '🏁 FINISH LINE!', '#7dffb0')
      if (elapsed - wordStartedAt < 4000 && hinted === 0) callout(1, '⚡ SPEEDY!', '#ffe066')
      ctx.after(380, nextWord)
    }

    /** Reveal the next letter (button, Enter, or automatically when stuck). */
    const hint = (manual = true) => {
      if (busy || ctx.isOver()) return
      // Give the player a real try first, and rate-limit manual hints.
      if (manual && (elapsed - wordStartedAt < 2500 || elapsed - lastHintAt < 1200)) {
        Sfx.clunk()
        return
      }
      if (typed.length >= word.word.length - 1) {
        // Hints never give away the final letter.
        lastProgressAt = elapsed
        const nudge = scene.add.text(area.cx, inputY + 40, 'Type the last letter!', {
          fontSize: '16px', fontFamily: FONT.display, color: '#ffd24a', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5)
        root.add(nudge)
        scene.tweens.add({ targets: nudge, alpha: 0, delay: 700, duration: 300, onComplete: () => nudge.destroy() })
        Sfx.clunk()
        return
      }
      typed += word.word[typed.length]
      hinted = typed.length
      hintCount++
      lastHintAt = elapsed
      lastProgressAt = elapsed
      Sfx.uiToggle()
      renderInput()
    }

    const skip = () => {
      if (busy || ctx.isOver()) return
      busy = true
      ctx.recordWord(word.word, false, word.definition)
      Sfx.clunk()
      inputText.setText(word.word.toUpperCase().split('').join(' ')).setColor('#ffcc66')
      ctx.after(1100, nextWord)
    }

    const type = (letter: string) => {
      if (busy || ctx.isOver() || elapsed < lockUntil) return
      const need = word.word[typed.length]
      if (letter === need) {
        typed += letter
        lastProgressAt = elapsed
        Sfx.uiHover()
        flashKey(letter, 0x44ff88)
        renderInput()
        if (typed === word.word) complete()
      } else {
        // Wrong letters bounce off with a short stall, so mashing the keyboard doesn't pay.
        lockUntil = elapsed + 250
        Sfx.clunk()
        flashKey(letter, 0xff4444)
        scene.tweens.killTweensOf(inputText)
        inputText.x = area.cx
        if (!ctx.reduceMotion) scene.tweens.add({ targets: inputText, x: area.cx + 8, duration: 40, yoyo: true, repeat: 2 })
      }
    }

    const backspace = () => {
      // Typed letters are always correct, so Backspace only undoes letters you typed (not free/hint ones).
      if (busy || typed.length <= Math.max(1, hinted)) return
      typed = typed.slice(0, -1)
      renderInput()
    }

    // ── On-screen keyboard (touch + mouse) ──
    const keyW = Math.min(52, (area.width - 60) / 11 - 6)
    const keyH = 44
    const kbTop = area.bottom - 3 * (keyH + 6) - 2
    const makeKey = (label: string, x: number, y: number, w: number, onTap: () => void, fill = 0x1b2942) => {
      const c = scene.add.container(x, y)
      const g = scene.add.graphics()
      g.fillStyle(0x000000, 0.35)
      g.fillRoundedRect(-w / 2 + 1, -keyH / 2 + 3, w, keyH, 8)
      g.fillStyle(fill, 1)
      g.fillRoundedRect(-w / 2, -keyH / 2, w, keyH, 8)
      g.lineStyle(2, accent, 0.5)
      g.strokeRoundedRect(-w / 2, -keyH / 2, w, keyH, 8)
      const t = scene.add.text(0, -1, label, { fontSize: '20px', fontFamily: FONT.display, color: '#ffffff' }).setOrigin(0.5)
      const hit = scene.add.rectangle(0, 0, w, keyH, 0, 0.001).setInteractive({ useHandCursor: true })
      hit.on('pointerdown', onTap)
      c.add([g, t, hit])
      root.add(c)
      if (/^[A-Z]$/.test(label)) keyViews.set(label.toLowerCase(), c)
    }
    ROWS.forEach((row, r) => {
      const extra = r === 2 ? 2 : 0
      const rowW = (row.length + extra) * (keyW + 6) - 6 + (r === 2 ? keyW : 0)
      let x = area.cx - rowW / 2
      if (r === 2) {
        makeKey('⏭', x + keyW * 0.75, kbTop + keyH / 2 + r * (keyH + 6), keyW * 1.5, skip, 0x3a2a40)
        x += keyW * 1.5 + 6
      }
      row.split('').forEach(letter => {
        makeKey(letter, x + keyW / 2, kbTop + keyH / 2 + r * (keyH + 6), keyW, () => type(letter.toLowerCase()))
        x += keyW + 6
      })
      if (r === 1) makeKey('⌫', x + keyW * 0.75, kbTop + keyH / 2 + r * (keyH + 6), keyW * 1.5, backspace, 0x3a2a40)
      if (r === 2) makeKey('💡', x + keyW * 0.75, kbTop + keyH / 2 + r * (keyH + 6), keyW * 1.5, () => hint(), 0x5a4a10)
    })

    ctx.onKey(ev => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false
      if (ev.key === 'Backspace') { backspace(); return true }
      if (ev.key === 'Enter') { hint(); return true }
      if (ev.key === 'Tab') { skip(); return true }
      const k = ev.key.toLowerCase()
      if (/^[a-z]$/.test(k)) { type(k); return true }
      return false
    })

    nextWord()
    refreshPlace()
    return {
      update(_time, delta) {
        elapsed += delta
        for (const r of ctx.rivals()) {
          const k = rivalKarts.get(r.id)
          if (!k || r.score === null) continue
          if (!racing.has(r.id)) {
            racing.add(r.id)
            refreshPlace()
          }
          moveKart(k, r.score)
        }
        if (pendingCallout) {
          ctx.flash(pendingCallout.text, pendingCallout.color)
          pendingCallout = null
        }
        // Stuck for a while? A free letter keeps the race moving.
        if (!busy && elapsed - lastProgressAt > 7000) hint(false)
      },
      stop() { busy = true },
    }
  },
}
