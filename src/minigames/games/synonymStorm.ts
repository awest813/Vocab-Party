import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { COLORS, FONT, hexColor } from '../../ui/Theme'
import { pickDistinct, type LexWord } from '../ContentBank'
import type { MinigameDef } from '../types'
import { drawCard } from '../ui'

interface Drop {
  c: Phaser.GameObjects.Container
  lane: number
  good: boolean
  speed: number
  dead: boolean
  word: string
}

const LANES = 4

export const synonymStorm: MinigameDef = {
  id: 'synonym-storm',
  title: 'Synonym Storm',
  icon: '🌧️',
  accent: COLORS.sky,
  category: 'Vocabulary',
  tagline: 'Words rain down — catch only the synonyms!',
  howTo: [
    'Catch falling words that MEAN THE SAME as the target.',
    'Catching a wrong word costs a point. Opposites are traps!',
    'The target word changes as the storm rolls on.',
  ],
  controls: { keys: 'Click words · or keys 1–4 catch the lowest word in a lane', touch: 'Tap the matching words' },
  durationMs: 35000,
  cpu: { easy: [4, 8], normal: [9, 13], hard: [13, 16] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    const drops: Drop[] = []
    let target: LexWord
    let goodQueue: string[] = []
    let badPool: string[] = []
    let targetAge = 0
    let spawnIn = 400
    let switching = false

    const fieldTop = area.top + 120
    const fieldBottom = area.bottom - 46
    const laneW = Math.min(230, (area.width - 40) / LANES)
    const laneX = (i: number) => area.cx + (i - (LANES - 1) / 2) * laneW

    // Lane guides + key labels
    const lanes = scene.add.graphics()
    for (let i = 0; i < LANES; i++) {
      lanes.fillStyle(i % 2 === 0 ? 0xffffff : 0x000000, 0.035)
      lanes.fillRect(laneX(i) - laneW / 2, fieldTop, laneW, fieldBottom - fieldTop)
    }
    lanes.lineStyle(3, 0xff6b6b, 0.5)
    lanes.lineBetween(area.cx - (laneW * LANES) / 2, fieldBottom, area.cx + (laneW * LANES) / 2, fieldBottom)
    root.add(lanes)
    if (!ctx.touch) {
      for (let i = 0; i < LANES; i++) {
        root.add(scene.add.text(laneX(i), fieldBottom + 20, `${i + 1}`, {
          fontSize: '18px', fontFamily: FONT.display, color: hexColor(COLORS.mute),
        }).setOrigin(0.5))
      }
    }

    const banner = scene.add.container(area.cx, area.top + 54)
    banner.add(drawCard(scene, Math.min(area.width - 20, 760), 100, accent))
    const bannerKicker = scene.add.text(0, -20, 'CATCH WORDS THAT MEAN…', {
      fontSize: '15px', fontFamily: FONT.display, color: hexColor(accent),
    }).setOrigin(0.5)
    const bannerWord = scene.add.text(0, 18, '', {
      fontSize: '42px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5)
    banner.add([bannerKicker, bannerWord])
    root.add(banner)

    const newTarget = () => {
      target = ctx.bank.word(w => w.synonyms.length >= 3, 'storm')
      goodQueue = [...target.synonyms]
      const decoys = ctx.bank.unrelatedTo(target, 8, x => x.pos === target.pos).flatMap(w => [w.word, ...pickDistinct(w.synonyms, 1)])
      badPool = [...target.antonyms, ...decoys]
      targetAge = 0
      switching = false
      drops.forEach(o => { if (!o.dead) kill(o, 'miss') })
      bannerWord.setText(target.word.toUpperCase())
      if (!ctx.reduceMotion) {
        banner.setScale(1.12)
        scene.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.easeOut' })
      }
    }

    const spawn = () => {
      const busyLanes = new Set(drops.filter(d => !d.dead && d.c.y < fieldTop + 70).map(d => d.lane))
      const free = Array.from({ length: LANES }, (_, i) => i).filter(i => !busyLanes.has(i))
      if (free.length === 0) return
      const lane = Phaser.Utils.Array.GetRandom(free) as number
      // Never have two copies of the same synonym falling at once.
      const falling = new Set(drops.filter(d => !d.dead && d.good).map(d => d.word))
      const available = goodQueue.filter(g => !falling.has(g))
      const good = available.length > 0 && Math.random() < 0.45
      const word = good
        ? available[Math.floor(Math.random() * available.length)]
        : (Phaser.Utils.Array.GetRandom(badPool) as string)
      const c = scene.add.container(laneX(lane), fieldTop - 10)
      const g = scene.add.graphics()
      const w = Math.max(120, Math.min(laneW - 16, word.length * 15 + 44))
      g.fillStyle(0x000000, 0.35)
      g.fillRoundedRect(-w / 2 + 2, -22, w, 48, 24)
      g.fillStyle(0x24406a, 1)
      g.fillRoundedRect(-w / 2, -26, w, 48, 24)
      g.fillStyle(0xffffff, 0.14)
      g.fillRoundedRect(-w / 2 + 6, -23, w - 12, 16, 10)
      g.lineStyle(2.5, 0x9fd4ff, 0.85)
      g.strokeRoundedRect(-w / 2, -26, w, 48, 24)
      const t = scene.add.text(0, -2, word, {
        fontSize: '22px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5)
      const hit = scene.add.rectangle(0, -2, w + 16, 60, 0, 0.001).setInteractive({ useHandCursor: true })
      c.add([g, t, hit])
      root.add(c)
      const drop: Drop = { c, lane, good, speed: Phaser.Math.Between(95, 135) + Math.min(60, (synonymStorm.durationMs - ctx.timeLeftMs()) / 600), dead: false, word }
      hit.on('pointerdown', () => catchDrop(drop))
      drops.push(drop)
    }

    const kill = (d: Drop, how: 'good' | 'bad' | 'miss') => {
      d.dead = true
      if (how === 'miss') {
        scene.tweens.add({ targets: d.c, alpha: 0, duration: 200, onComplete: () => d.c.destroy() })
        return
      }
      scene.tweens.add({
        targets: d.c, scale: how === 'good' ? 1.35 : 0.7, alpha: 0, angle: how === 'bad' ? 12 : 0,
        duration: 220, onComplete: () => d.c.destroy(),
      })
    }

    const catchDrop = (d: Drop) => {
      if (d.dead || ctx.isOver()) return
      if (d.good) {
        Sfx.correct()
        ctx.addScore(1, d.c.x, d.c.y - 20)
        ctx.recordWord(target.word, true, `${d.word} ≈ ${target.word}`)
        goodQueue = goodQueue.filter(x => x !== d.word)
        kill(d, 'good')
        if (goodQueue.length === 0) {
          ctx.flash('⚡ ALL CAUGHT! NEW WORD', '#9fd4ff')
          switching = true
          drops.forEach(o => { if (!o.dead) kill(o, 'miss') })
          ctx.after(300, newTarget)
        }
      } else {
        Sfx.wrong()
        ctx.addScore(-1, d.c.x, d.c.y - 20)
        const trap = target.antonyms.includes(d.word)
        ctx.recordWord(target.word, false, trap ? `${d.word} is the OPPOSITE of ${target.word}` : `${d.word} ≠ ${target.word}`)
        kill(d, 'bad')
        if (!ctx.reduceMotion) scene.cameras.main.shake(90, 0.004)
      }
    }

    ctx.onKey(ev => {
      const map: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }
      const lane = map[ev.code]
      if (lane === undefined) return false
      const lowest = drops.filter(d => !d.dead && d.lane === lane).sort((a, b) => b.c.y - a.c.y)[0]
      if (lowest) catchDrop(lowest)
      return true
    })

    newTarget()

    return {
      update(_time, delta) {
        if (ctx.isOver()) return
        const dt = delta / 1000
        targetAge += delta
        spawnIn -= delta
        if (spawnIn <= 0 && !switching) {
          spawn()
          spawnIn = Phaser.Math.Between(520, 820)
        }
        for (const d of drops) {
          if (d.dead) continue
          d.c.y += d.speed * dt
          if (d.c.y >= fieldBottom) kill(d, 'miss')
        }
        for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead && !drops[i].c.active) drops.splice(i, 1)
        if (targetAge > 11000 && !switching) {
          // Teach the ones that got away: record them and show one before moving on.
          if (goodQueue.length > 0) {
            ctx.recordWord(target.word, false, `${target.word} ≈ ${goodQueue.join(', ')}`)
            ctx.flash(`${target.word.toUpperCase()} ≈ ${goodQueue.slice(0, 2).join(', ')}`, '#9fd4ff')
          } else {
            ctx.flash('🌀 NEW WORD!', '#9fd4ff')
          }
          newTarget()
        }
      },
      stop() {
        drops.forEach(d => { d.dead = true })
      },
    }
  },
}
