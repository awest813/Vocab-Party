import Phaser from 'phaser'
import { getSettings, type WordLevel } from '../../systems/GameSettings'
import { isAutoSimMode } from '../../systems/gameFlags'
import { Sfx } from '../../systems/Sfx'
import { FONT, hexColor } from '../../ui/Theme'
import type { LexWord } from '../ContentBank'
import type { MinigameDef } from '../types'
import { drawCard } from '../ui'

/** Classic fret colors: green, red, yellow, blue. */
const LANE_COLORS = [0x2ad46a, 0xe84a4a, 0xf4c430, 0x3d8fff]
const LANE_KEYS: Record<string, number> = {
  KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
  Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3,
  ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
}
const KEY_LABELS = ['D', 'F', 'J', 'K']

/** A minor pentatonic riff (MIDI) — each correct strum plays the next note. */
const RIFF = [57, 60, 62, 64, 67, 64, 62, 60, 57, 60, 62, 67, 69, 67, 64, 62]

const PERFECT_MS = 75
const GOOD_MS = 150
/** Song tempo (start → end BPM) and note travel time, by word level: younger players get a gentler song. */
const TEMPO: Record<WordLevel, { start: number; end: number; travel: number }> = {
  starter: { start: 88, end: 104, travel: 2700 },
  all: { start: 104, end: 128, travel: 2300 },
  standard: { start: 104, end: 128, travel: 2300 },
  challenge: { start: 112, end: 140, travel: 2100 },
}

type Mode = 'synonym' | 'antonym'

interface Section {
  target: LexWord
  mode: Mode
  goodPool: string[]
  badPool: string[]
}

interface Note {
  lane: number
  hitAt: number
  word: string
  good: boolean
  section: Section
  c: Phaser.GameObjects.Container
  label: Phaser.GameObjects.Text
  done: boolean
}

export const wordHero: MinigameDef = {
  id: 'word-hero',
  title: 'Word Hero',
  icon: '🎸',
  accent: 0xff4fa3,
  category: 'Vocabulary',
  tagline: 'Rock the fretboard — strum only the words that match!',
  howTo: [
    'Strum a note as it crosses the line — but only if its word MATCHES the target.',
    'Let non-matching words pass. Streaks raise your multiplier up to ×4.',
    'Fill the meter with clean play to unleash WORD POWER: double points!',
  ],
  controls: { keys: 'D F J K (or 1–4 / arrows) to strum each lane', touch: 'Tap the colored frets' },
  durationMs: 40000,
  // Simulated: Easy ≈ 70% accuracy, Normal ≈ 80%, Hard ≈ 90% (a flawless song scores 100+).
  cpu: { easy: [10, 20], normal: [20, 36], hard: [34, 52] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    const notes: Note[] = []
    let t = 0
    let nextBeat = 2700
    let beatIndex = 0
    let streak = 0
    let riffStep = 0
    let rock = 0.5
    /** Section new notes are spawned for (runs one section ahead of the banner during a hand-off). */
    let spawning!: Section
    let goodHitsForTarget = 0
    let targetSince = 0
    /** Scheduled beat times not yet reached — drums fire exactly when notes land. */
    const beatQueue: number[] = []
    let lastBeatAt = -1
    let beatCount = 0
    /** Set while the next section's notes are already falling but the old ones haven't landed yet. */
    let pendingSwitch = false
    let lastWord = ''
    /** WORD POWER (star power): doubles points until this time. */
    let powerUntil = -1
    const stats = { hits: 0, perfects: 0, wrong: 0, missed: 0, bestStreak: 0 }
    /** Count-in clicks before the first note lands. */
    const countIn: number[] = []

    // Highway geometry (pseudo-3D trapezoid)
    const topY = area.top + 136
    const strikeY = area.bottom - 104
    const nearW = Math.min(560, area.width - 80)
    const farW = nearW * 0.34
    const tempo = TEMPO[getSettings().wordLevel] ?? TEMPO.all
    const travelMs = () => tempo.travel - Math.min(500, t / 80)
    const scaleAt = (p: number) => 0.34 + 0.66 * p
    const yAt = (p: number) => topY + (strikeY - topY) * p
    const laneX = (lane: number, p: number) => area.cx + (lane - 1.5) * (nearW / 4) * scaleAt(p)

    const hwy = scene.add.graphics()
    const drawHighway = (pulse: number) => {
      hwy.clear()
      const bottomY = strikeY + 60
      const pb = (strikeY + 60 - topY) / (strikeY - topY)
      const wAt = (p: number) => farW + (nearW - farW) * p
      hwy.fillStyle(powerOn() ? 0x0d2a3a : 0x0b0f1c, 0.95)
      hwy.fillPoints([
        new Phaser.Geom.Point(area.cx - farW / 2, topY),
        new Phaser.Geom.Point(area.cx + farW / 2, topY),
        new Phaser.Geom.Point(area.cx + wAt(pb) / 2, bottomY),
        new Phaser.Geom.Point(area.cx - wAt(pb) / 2, bottomY),
      ], true)
      // lane dividers
      for (let i = 0; i <= 4; i++) {
        const xf = area.cx + (i - 2) * (farW / 4)
        const xn = area.cx + (i - 2) * (wAt(pb) / 4)
        const edge = powerOn() ? 0x6ff7ff : accent
        hwy.lineStyle(i === 0 || i === 4 ? 4 : 2, i === 0 || i === 4 ? edge : 0x2a3a5a, i === 0 || i === 4 ? 0.8 : 0.7)
        hwy.lineBetween(xf, topY, xn, bottomY)
      }
      // scrolling fret bars: one per scheduled beat still in flight
      for (const hitAt of beatQueue) {
        const p = 1 - (hitAt - t) / travelMs()
        if (p < 0 || p > 1.15) continue
        const y = yAt(p)
        const half = (farW + (nearW - farW) * p) / 2
        hwy.lineStyle(2, 0xffffff, 0.08 + 0.12 * p)
        hwy.lineBetween(area.cx - half, y, area.cx + half, y)
      }
      // strike line
      hwy.lineStyle(6, 0xffffff, 0.35 + pulse * 0.5)
      hwy.lineBetween(area.cx - nearW / 2, strikeY, area.cx + nearW / 2, strikeY)
    }
    root.add(hwy)

    // Frets (tap targets on touch)
    const frets: Phaser.GameObjects.Container[] = []
    for (let lane = 0; lane < 4; lane++) {
      const x = laneX(lane, 1)
      const c = scene.add.container(x, strikeY)
      const g = scene.add.graphics()
      g.fillStyle(0x000000, 0.5)
      g.fillEllipse(0, 4, 104, 40)
      g.lineStyle(5, LANE_COLORS[lane], 1)
      g.strokeEllipse(0, 0, 100, 36)
      g.fillStyle(LANE_COLORS[lane], 0.18)
      g.fillEllipse(0, 0, 96, 32)
      c.add(g)
      if (!ctx.touch) {
        c.add(scene.add.text(0, 46, KEY_LABELS[lane], {
          fontSize: '18px', fontFamily: FONT.display, color: hexColor(LANE_COLORS[lane]), stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5))
      }
      const hit = scene.add.rectangle(0, 10, nearW / 4 - 6, 130, 0, 0.001).setInteractive()
      hit.on('pointerdown', () => strum(lane))
      c.add(hit)
      root.add(c)
      frets.push(c)
    }

    // Target banner
    const banner = scene.add.container(area.cx, area.top + 58)
    banner.add(drawCard(scene, Math.min(area.width - 20, 720), 96, accent))
    const kicker = scene.add.text(0, -20, '', { fontSize: '15px', fontFamily: FONT.display, color: hexColor(accent) }).setOrigin(0.5)
    // Upcoming target, shown under the banner during a hand-off so the current instruction stays put.
    const nextText = scene.add.text(area.cx, area.top + 120, '', {
      fontSize: '16px', fontFamily: FONT.display, color: '#ffe066', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5)
    const bigWord = scene.add.text(0, 16, '', {
      fontSize: '38px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5)
    banner.add([kicker, bigWord])
    root.add([banner, nextText])

    // HUD: streak, multiplier, rock meter
    const comboText = scene.add.text(area.cx + nearW / 2 + 18, strikeY - 120, '', {
      fontSize: '22px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0, 0.5)
    const multText = scene.add.text(area.cx + nearW / 2 + 18, strikeY - 80, '×1', {
      fontSize: '40px', fontFamily: FONT.display, color: hexColor(accent), stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0, 0.5)
    const meter = scene.add.graphics()
    const meterLabel = scene.add.text(area.cx - nearW / 2 - 40, topY - 14, '⚡', { fontSize: '18px' }).setOrigin(0.5)
    root.add([comboText, multText, meter, meterLabel])
    const drawMeter = () => {
      const x = area.cx - nearW / 2 - 40
      const h = strikeY - topY
      meter.clear()
      meter.fillStyle(0x000000, 0.6)
      meter.fillRoundedRect(x - 10, topY, 20, h, 8)
      const col = powerOn() ? 0x6ff7ff : rock > 0.66 ? 0x2ad46a : rock > 0.33 ? 0xf4c430 : 0xe84a4a
      meter.fillStyle(col, 1)
      if (rock > 0.02) {
        const fillH = Math.max(6, h * rock - 6)
        meter.fillRoundedRect(x - 7, Math.min(topY + h * (1 - rock) + 3, topY + h - 3 - fillH), 14, fillH, 6)
      }
    }

    const mult = () => Math.min(4, 1 + Math.floor(streak / 8))
    const powerOn = () => t < powerUntil
    const bpm = () => tempo.start + (tempo.end - tempo.start) * Math.min(1, t / 40000)

    const refreshHud = () => {
      comboText.setText(streak >= 2 ? `🔥 ${streak} streak` : '')
      multText.setText(powerOn() ? `×${mult() * 2}⚡` : `×${mult()}`)
      multText.setColor(powerOn() ? '#6ff7ff' : hexColor(accent))
      drawMeter()
    }

    const chooseSection = (): Section => {
      let mode: Mode = Math.random() < 0.7 ? 'synonym' : 'antonym'
      const target = ctx.bank.word(w => w.synonyms.length >= 3 && (mode === 'synonym' || w.antonyms.length >= 2), `hero:${mode}`)
      // Guard custom content: fall back to synonyms if this word has no opposites.
      if (mode === 'antonym' && target.antonyms.length < 2) mode = 'synonym'
      const goodPool = mode === 'synonym' ? [...target.synonyms] : [...target.antonyms]
      const decoys = ctx.bank.unrelatedTo(target, 6, x => x.pos === target.pos).map(x => x.word)
      const badPool = [...decoys, ...(mode === 'antonym' ? target.synonyms : target.antonyms)]
      return { target, mode, goodPool: goodPool.length > 0 ? goodPool : [target.word], badPool }
    }

    const showSection = (sec: Section) => {
      goodHitsForTarget = 0
      targetSince = t
      kicker.setText(sec.mode === 'synonym' ? 'STRUM WORDS THAT MEAN…' : 'STRUM THE OPPOSITES OF…')
      nextText.setText('')
      bigWord.setText(sec.target.word.toUpperCase())
      if (!ctx.reduceMotion) {
        banner.setScale(1.12)
        scene.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.easeOut' })
      }
    }

    const spawn = (hitAt: number) => {
      const lane = Phaser.Math.Between(0, 3)
      // Keep good notes a bit more common than decoys so there's always music to play.
      // Antonym pools are small, so fewer good notes keeps them from repeating every beat.
      const sec = spawning
      const good = Math.random() < (sec.mode === 'antonym' ? 0.45 : 0.58)
      // Avoid the same word twice in a row so every note needs a fresh read.
      const pool = (good ? sec.goodPool : sec.badPool).filter(x => x !== lastWord)
      const word = Phaser.Utils.Array.GetRandom(pool.length > 0 ? pool : (good ? sec.goodPool : sec.badPool)) as string
      lastWord = word
      const c = scene.add.container(laneX(lane, 0), topY)
      const g = scene.add.graphics()
      const col = LANE_COLORS[lane]
      g.fillStyle(0x000000, 0.45)
      g.fillEllipse(0, 6, 92, 34)
      g.fillStyle(col, 1)
      g.fillEllipse(0, 0, 88, 32)
      g.fillStyle(0xffffff, 0.35)
      g.fillEllipse(0, -6, 60, 12)
      g.lineStyle(3, 0xffffff, 0.8)
      g.strokeEllipse(0, 0, 88, 32)
      const label = scene.add.text(0, -32, word, {
        fontSize: '19px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5)
      c.add([g, label])
      c.setScale(scaleAt(0))
      root.add(c)
      notes.push({ lane, hitAt, word, good, section: sec, c, label, done: false })
    }

    const burst = (lane: number, color: number, text: string, textColor: string) => {
      const x = laneX(lane, 1)
      const flame = scene.add.graphics()
      flame.fillStyle(color, 0.9)
      flame.fillTriangle(x - 34, strikeY, x + 34, strikeY, x, strikeY - 90)
      flame.fillStyle(0xffffff, 0.7)
      flame.fillTriangle(x - 16, strikeY, x + 16, strikeY, x, strikeY - 50)
      root.add(flame)
      scene.tweens.add({ targets: flame, alpha: 0, duration: 260, onComplete: () => flame.destroy() })
      const tx = scene.add.text(x, strikeY - 110, text, {
        fontSize: '20px', fontFamily: FONT.display, color: textColor, stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5)
      root.add(tx)
      scene.tweens.add({ targets: tx, y: tx.y - 30, alpha: 0, duration: 520, onComplete: () => tx.destroy() })
      if (!ctx.reduceMotion) scene.tweens.add({ targets: frets[lane], scale: 1.12, duration: 70, yoyo: true })
    }

    /** WORD POWER: the full meter drains over ~8 beats while every hit scores double. */
    const activatePower = () => {
      const dur = 8 * (60000 / bpm())
      powerUntil = t + dur
      Sfx.star()
      ctx.flash('⚡ WORD POWER! ×2', '#6ff7ff')
      if (!ctx.reduceMotion) scene.cameras.main.flash(200, 110, 247, 255, true)
      refreshHud()
    }

    const breakStreak = () => {
      streak = 0
      refreshHud()
    }

    const strum = (lane: number) => {
      if (ctx.isOver()) return
      // Closest unresolved note in this lane within the timing window.
      let best: Note | undefined
      let bestDt = Infinity
      for (const n of notes) {
        if (n.done || n.lane !== lane) continue
        const dt = Math.abs(n.hitAt - t)
        if (dt <= GOOD_MS && dt < bestDt) {
          best = n
          bestDt = dt
        }
      }
      if (!best) {
        // Ghost strum: no note there — streak breaks (no points lost).
        Sfx.clunk()
        if (streak > 0) breakStreak()
        if (!ctx.reduceMotion) scene.tweens.add({ targets: frets[lane], scale: 0.92, duration: 60, yoyo: true })
        return
      }
      best.done = true
      if (best.good) {
        streak++
        stats.hits++
        stats.bestStreak = Math.max(stats.bestStreak, streak)
        const m = mult() * (powerOn() ? 2 : 1)
        const perfect = bestDt <= PERFECT_MS
        if (perfect) stats.perfects++
        Sfx.pluck(RIFF[riffStep++ % RIFF.length], perfect)
        ctx.addScore(m)
        if (!powerOn()) rock = Math.min(1, rock + (perfect ? 0.05 : 0.035))
        goodHitsForTarget++
        burst(lane, powerOn() ? 0x6ff7ff : LANE_COLORS[lane], `${perfect ? 'PERFECT' : 'GOOD'} +${m}`, perfect ? '#ffe066' : '#ffffff')
        if (rock >= 1 && !powerOn()) activatePower()
        const sec = best.section
        ctx.recordWord(sec.target.word, true, `${best.word} ${sec.mode === 'synonym' ? '≈' : '↔'} ${sec.target.word}`)
        // One callout per hit: WORD POWER outranks a multiplier step.
        if (streak % 8 === 0 && streak <= 24 && rock < 1) ctx.flash(`×${mult()} MULTIPLIER!`, '#ff9fd0')
      } else {
        Sfx.clunk()
        stats.wrong++
        ctx.addScore(-1)
        if (!powerOn()) rock = Math.max(0, rock - 0.1)
        burst(lane, 0x555555, 'WRONG WORD', '#ff8888')
        const sec = best.section
        ctx.recordWord(sec.target.word, false, `“${best.word}” doesn’t ${sec.mode === 'synonym' ? 'mean' : 'oppose'} ${sec.target.word}`)
        breakStreak()
        if (!ctx.reduceMotion) scene.cameras.main.shake(90, 0.004)
      }
      scene.tweens.add({ targets: best.c, scale: best.c.scale * 1.4, alpha: 0, duration: 140, onComplete: () => best!.c.destroy() })
      refreshHud()
    }

    ctx.onKey(ev => {
      const lane = LANE_KEYS[ev.code]
      if (lane === undefined) return false
      if (!ev.repeat) strum(lane)
      return true
    })

    Sfx.stopMusic(false)
    {
      const beat0 = 60000 / tempo.start
      // Leave room for a full four-click count-in, even at the slow Starter tempo.
      nextBeat = Math.max(nextBeat, 4 * beat0 + 300)
      for (let k = 4; k >= 1; k--) countIn.push(nextBeat - k * beat0)
    }
    spawning = chooseSection()
    showSection(spawning)
    refreshHud()
    drawHighway(0)

    const autoplay = () => isAutoSimMode() || Boolean((window as unknown as { __WORD_HERO_AUTOPLAY__?: boolean }).__WORD_HERO_AUTOPLAY__)

    const tick = (delta: number) => {
        t += delta
        const beatMs = 60000 / bpm()
        // Schedule notes so they reach the strike line exactly on the beat.
        while (t + travelMs() >= nextBeat) {
          // Rest on some off-beats so it isn't a wall of notes.
          if (!(beatIndex % 8 === 7 && Math.random() < 0.6)) spawn(nextBeat)
          beatQueue.push(nextBeat)
          nextBeat += beatMs
          beatIndex++
        }
        // Groove: kick / snare alternate on the same beats the notes land on.
        while (beatQueue.length > 0 && beatQueue[0] <= t) {
          lastBeatAt = beatQueue.shift()!
          Sfx.drum(beatCount++ % 2 === 1 ? 'snare' : 'kick')
        }
        // Count-in: four clicks (and big numbers) leading into the first note.
        while (countIn.length > 0 && countIn[0] <= t) {
          countIn.shift()
          Sfx.drum('hat')
          const n = countIn.length + 1
          const num = scene.add.text(area.cx, (topY + strikeY) / 2, String(n), {
            fontSize: '64px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 8,
          }).setOrigin(0.5).setAlpha(0.85)
          root.add(num)
          scene.tweens.add({ targets: num, alpha: 0, ...(ctx.reduceMotion ? {} : { scale: 1.4 }), duration: 380, onComplete: () => num.destroy() })
        }
        if (powerUntil > 0) {
          if (powerOn()) rock = Math.max(0, (powerUntil - t) / (8 * beatMs))
          else {
            powerUntil = -1
            rock = 0.5
            refreshHud()
          }
        }
        const phase = lastBeatAt < 0 ? 1 : (t - lastBeatAt) / beatMs
        drawHighway(Math.max(0, 1 - phase * 3))

        for (const n of notes) {
          if (n.done) continue
          const p = 1 - (n.hitAt - t) / travelMs()
          n.c.setPosition(laneX(n.lane, Math.min(1.15, p)), yAt(Math.min(1.15, p)))
          const sc = scaleAt(Math.min(1.15, Math.max(0, p)))
          n.c.setScale(sc)
          // Keep words readable far up the highway: the label never shrinks below ~85% size.
          n.label.setScale(Math.max(1, 0.85 / sc))
          n.c.setAlpha(p < 0.08 ? Math.max(0, p / 0.08) : 1)
          if (t - n.hitAt > GOOD_MS) {
            n.done = true
            if (n.good) {
              // Missed a note you should have played.
              stats.missed++
              if (!powerOn()) rock = Math.max(0, rock - 0.06)
              if (streak > 0) breakStreak()
              scene.tweens.add({ targets: n.c, alpha: 0, duration: 160, onComplete: () => n.c.destroy() })
            } else {
              // Correctly let a decoy pass.
              scene.tweens.add({ targets: n.c, alpha: 0, scale: n.c.scale * 0.6, duration: 160, onComplete: () => n.c.destroy() })
            }
          }
        }
        // Test autopilot (?autoSim, or window.__WORD_HERO_AUTOPLAY__): strum every matching note on time.
        if (autoplay()) {
          for (const n of notes) if (!n.done && n.good && Math.abs(n.hitAt - t) <= PERFECT_MS / 2) strum(n.lane)
        }
        for (let i = notes.length - 1; i >= 0; i--) if (notes[i].done && !notes[i].c.active) notes.splice(i, 1)
        drawMeter()
        // New section: start spawning the next target's notes right away (one beat of rest),
        // and swap the banner once the last of the old section's notes has landed.
        if (!pendingSwitch && (goodHitsForTarget >= 8 || t - targetSince > 12000)) {
          pendingSwitch = true
          spawning = chooseSection()
          // Preview the next target so players can read it before its notes arrive.
          nextText.setText(`NEXT ▸ ${spawning.mode === 'synonym' ? 'means' : 'opposite of'} ${spawning.target.word.toUpperCase()}`)
          nextBeat += 60000 / bpm()
        }
        if (pendingSwitch && notes.every(n => n.done || n.section === spawning)) {
          pendingSwitch = false
          ctx.flash('🎸 NEW SONG SECTION!', '#ff9fd0')
          showSection(spawning)
        }
    }

    return {
      update(_time, delta) {
        if (ctx.isOver()) return
        // Autopilot steps in small slices so it plays correctly even on very slow renderers.
        if (autoplay()) {
          for (let left = delta; left > 0 && !ctx.isOver(); left -= 16) tick(Math.min(16, left))
        } else {
          tick(delta)
        }
      },
      stop() {
        notes.forEach(n => { n.done = true })
        Sfx.startMusic('minigame')
        // Song summary under the runner's TIME'S UP banner.
        const total = stats.hits + stats.missed
        const acc = total > 0 ? Math.round((stats.hits / total) * 100) : 0
        scene.add.text(scene.scale.width / 2, scene.scale.height / 2 + 120,
          `🎸 ${stats.hits}/${total} notes (${acc}%) · ${stats.perfects} perfect · best streak ${stats.bestStreak}${stats.wrong ? ` · ${stats.wrong} wrong` : ''}`, {
            fontSize: '22px', fontFamily: FONT.display, color: '#ffe0f0', stroke: '#000000', strokeThickness: 5,
          }).setOrigin(0.5).setDepth(82)
      },
    }
  },
}
