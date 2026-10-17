import Phaser from 'phaser'
import { Sfx } from '../../systems/Sfx'
import { COLORS, FONT, hexColor } from '../../ui/Theme'
import { pickDistinct, shuffled, type LexWord } from '../ContentBank'
import type { MinigameDef } from '../types'

interface Node {
  c: Phaser.GameObjects.Container
  g: Phaser.GameObjects.Graphics
  text: string
  pair: number
  side: 'L' | 'R'
  done: boolean
  x: number
  y: number
}

const PAIRS = 5
const NODE_W = 230
const NODE_H = 58

export const linkUp: MinigameDef = {
  id: 'link-up',
  title: 'Link Up',
  icon: '🔗',
  accent: 0xff5cad,
  category: 'Vocabulary',
  tagline: 'Draw lines between words that mean the same thing.',
  howTo: [
    'Pick a word on the left, then its synonym on the right.',
    'Each correct link is +1. Clear all five for a +2 bonus.',
    'Wrong links cost a point and freeze the board — think first!',
  ],
  controls: { keys: 'Click a left word, then a right word (or 1–5 then Q–T)', touch: 'Tap a left word, then its match' },
  durationMs: 40000,
  cpu: { easy: [5, 9], normal: [9, 14], hard: [14, 18] },
  start(ctx) {
    const { scene, root, area, accent } = ctx
    let nodes: Node[] = []
    let lines: Phaser.GameObjects.Graphics
    let picked: Node | null = null
    let words: LexWord[] = []
    let objs: Phaser.GameObjects.GameObject[] = []
    let locked = false

    const leftX = area.cx - 220
    const rightX = area.cx + 220
    const top = area.top + 100

    const paint = (n: Node, state: 'idle' | 'picked' | 'done' | 'bad') => {
      const fill = state === 'done' ? 0x1f7a4a : state === 'bad' ? 0xc63b3b : state === 'picked' ? 0x3a2a60 : 0x1b2942
      const edge = state === 'picked' ? 0xffe066 : state === 'done' ? 0x44ff88 : accent
      n.g.clear()
      n.g.fillStyle(0x000000, 0.35)
      n.g.fillRoundedRect(-NODE_W / 2 + 2, -NODE_H / 2 + 5, NODE_W, NODE_H, 14)
      n.g.fillStyle(fill, 1)
      n.g.fillRoundedRect(-NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 14)
      n.g.lineStyle(state === 'picked' ? 4 : 2.5, edge, 0.9)
      n.g.strokeRoundedRect(-NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 14)
      // connector dot
      n.g.fillStyle(edge, 1)
      n.g.fillCircle(n.side === 'L' ? NODE_W / 2 : -NODE_W / 2, 0, 7)
    }

    const redrawLines = () => {
      lines.clear()
      for (let i = 0; i < PAIRS; i++) {
        const [a, b] = nodes.filter(n => n.pair === i)
        if (!a?.done) continue
        const l = a.side === 'L' ? a : b
        const r = a.side === 'L' ? b : a
        lines.lineStyle(5, 0x44ff88, 0.85)
        lines.lineBetween(l.x + NODE_W / 2, l.y, r.x - NODE_W / 2, r.y)
      }
    }

    const tryLink = (n: Node) => {
      if (locked || n.done || ctx.isOver()) return
      if (!picked || picked.side === n.side) {
        if (picked) paint(picked, 'idle')
        picked = n
        paint(n, 'picked')
        Sfx.uiClick()
        return
      }
      const a = picked
      picked = null
      if (a.pair === n.pair) {
        a.done = n.done = true
        paint(a, 'done')
        paint(n, 'done')
        redrawLines()
        Sfx.zip()
        Sfx.correct()
        ctx.addScore(1, (a.x + n.x) / 2, (a.y + n.y) / 2 - 30)
        const w = words[a.pair]
        ctx.recordWord(w.word, true, `${w.word} ≈ ${a.side === 'L' ? n.text : a.text}`)
        if (nodes.every(x => x.done)) {
          ctx.addScore(2, area.cx, top - 40)
          ctx.flash('🔗 ALL LINKED +2', '#44ff88')
          locked = true
          ctx.after(650, deal)
        }
      } else {
        locked = true
        paint(a, 'bad')
        paint(n, 'bad')
        Sfx.wrong()
        ctx.addScore(-1, (a.x + n.x) / 2, (a.y + n.y) / 2 - 30)
        const left = a.side === 'L' ? a : n
        ctx.recordWord(words[left.pair].word, false, `${words[left.pair].word} means “${words[left.pair].definition}”`)
        // Guess-spamming shouldn't pay: a wrong link freezes the board briefly, with a visible ✗.
        const mark = scene.add.text((a.x + n.x) / 2, (a.y + n.y) / 2, '✗', {
          fontSize: '44px', fontFamily: FONT.display, color: '#ff6b6b', stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5)
        root.add(mark)
        objs.push(mark)
        ctx.after(1500, () => {
          mark.destroy()
          paint(a, 'idle')
          paint(n, 'idle')
          locked = false
        })
      }
    }

    const deal = () => {
      if (ctx.isOver()) return
      objs.forEach(o => o.destroy())
      objs = []
      nodes = []
      picked = null
      locked = false
      // Pick words whose chosen synonyms don't collide with each other.
      words = []
      const used = new Set<string>()
      for (let tries = 0; words.length < PAIRS && tries < 80; tries++) {
        const w = ctx.bank.word(x => x.synonyms.length > 0, 'linkup')
        if (used.has(w.word) || w.synonyms.some(s => used.has(s))) continue
        used.add(w.word)
        w.synonyms.forEach(s => used.add(s))
        words.push(w)
      }
      lines = scene.add.graphics()
      root.add(lines)
      objs.push(lines)
      const syns = words.map(w => pickDistinct(w.synonyms, 1)[0] ?? w.synonyms[0])
      const rightOrder = shuffled(words.map((_, i) => i))
      const make = (text: string, pair: number, side: 'L' | 'R', row: number, key: string) => {
        const x = side === 'L' ? leftX : rightX
        const y = top + row * (NODE_H + 18)
        const c = scene.add.container(x, y)
        const g = scene.add.graphics()
        const t = scene.add.text(0, -1, text, {
          fontSize: text.length > 12 ? '19px' : '23px', fontFamily: FONT.display, color: '#ffffff',
        }).setOrigin(0.5)
        c.add([g, t])
        if (!ctx.touch) {
          c.add(scene.add.text(side === 'L' ? -NODE_W / 2 + 16 : NODE_W / 2 - 16, -1, key, {
            fontSize: '13px', fontFamily: FONT.display, color: hexColor(COLORS.mute),
          }).setOrigin(0.5))
        }
        const hit = scene.add.rectangle(0, 0, NODE_W, NODE_H, 0, 0.001).setInteractive({ useHandCursor: true })
        c.add(hit)
        root.add(c)
        objs.push(c)
        const node: Node = { c, g, text, pair, side, done: false, x, y }
        hit.on('pointerdown', () => tryLink(node))
        paint(node, 'idle')
        nodes.push(node)
        if (!ctx.reduceMotion) {
          c.setAlpha(0).setX(x + (side === 'L' ? -30 : 30))
          scene.tweens.add({ targets: c, alpha: 1, x, duration: 200, delay: row * 40 })
        }
      }
      words.forEach((w, i) => make(w.word.toUpperCase(), i, 'L', i, String(i + 1)))
      rightOrder.forEach((pair, row) => make(syns[pair], pair, 'R', row, 'QWERT'[row]))
    }

    const LEFT_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }
    const RIGHT_KEYS: Record<string, number> = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3, KeyT: 4 }
    ctx.onKey(ev => {
      if (ev.code in LEFT_KEYS) {
        const n = nodes.filter(x => x.side === 'L')[LEFT_KEYS[ev.code]]
        if (n) tryLink(n)
        return true
      }
      if (ev.code in RIGHT_KEYS) {
        const row = RIGHT_KEYS[ev.code]
        const n = nodes.filter(x => x.side === 'R')[row]
        if (n) tryLink(n)
        return true
      }
      return false
    })

    deal()
    return { stop() { locked = true } }
  },
}
