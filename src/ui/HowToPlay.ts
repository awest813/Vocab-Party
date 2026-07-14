import Phaser from 'phaser'
import { createButton } from './Button'
import {
  HOW_TO_CONTROLS_DESKTOP,
  HOW_TO_CONTROLS_TOUCH,
  HOW_TO_INTRO,
  HOW_TO_RULES,
  HOW_TO_TILES,
} from './HowToPlayContent'
import { isTouchPreferred } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'

type HowToOpts = {
  mode?: 'tiles' | 'rules'
  onClose?: () => void
}

/**
 * Shared How-to-Play modal. Returns destroy().
 */
export function openHowToPlay(scene: Phaser.Scene, opts: HowToOpts = {}): () => void {
  const w = scene.scale.width
  const h = scene.scale.height
  const touch = isTouchPreferred(scene.sys.game)
  const mode = opts.mode ?? 'rules'
  let alive = true

  const root = scene.add.container(0, 0).setDepth(3900)
  const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setInteractive()
  const panelW = mode === 'tiles' ? 780 : 640
  const panelH = mode === 'tiles' ? 540 : 460
  const panel = scene.add.container(w / 2, h / 2)
  const bg = scene.add.rectangle(0, 0, panelW, panelH, 0x141430, 0.96)
  bg.setStrokeStyle(3, 0x6688cc, 0.85)

  const title = scene.add.text(0, -panelH / 2 + 36, '🎲 HOW TO PLAY', {
    fontSize: '30px',
    fontFamily: 'Fredoka, Arial Black',
    color: '#FFD700',
    stroke: '#664400',
    strokeThickness: 5,
  }).setOrigin(0.5)

  const intro = scene.add.text(0, -panelH / 2 + 78, HOW_TO_INTRO, {
    fontSize: '15px',
    fontFamily: 'Fredoka, Arial',
    color: '#aabbdd',
    align: 'center',
    wordWrap: { width: panelW - 60 },
  }).setOrigin(0.5)

  panel.add([bg, title, intro])

  if (mode === 'tiles') {
    const cols = 2
    const itemW = 340
    const itemH = 54
    const gridX = -itemW - 10
    const gridStartY = -panelH / 2 + 120
    HOW_TO_TILES.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = gridX + col * (itemW + 20)
      const y = gridStartY + row * (itemH + 10)
      const cell = scene.add.rectangle(x + itemW / 2, y + itemH / 2, itemW, itemH, item.color, 0.15)
      cell.setStrokeStyle(1.5, item.color, 0.6)
      const emojiT = scene.add.text(x + 10, y + itemH / 2, item.emoji, { fontSize: '22px' }).setOrigin(0, 0.5)
      const labelT = scene.add.text(x + 44, y + itemH / 2 - 8, item.label, {
        fontSize: '15px', fontFamily: 'Fredoka, Arial Black', color: '#eeeeff'
      }).setOrigin(0, 0.5)
      const descT = scene.add.text(x + 44, y + itemH / 2 + 10, item.desc, {
        fontSize: '12px', fontFamily: 'Fredoka, Arial', color: '#9999bb'
      }).setOrigin(0, 0.5)
      panel.add([cell, emojiT, labelT, descT])
    })
  } else {
    HOW_TO_RULES.forEach((rule, i) => {
      const t = scene.add.text(0, -panelH / 2 + 120 + i * 34, rule, {
        fontSize: '16px',
        fontFamily: 'Fredoka, Arial',
        color: '#ccd6ff',
        wordWrap: { width: panelW - 80 },
        align: 'center',
      }).setOrigin(0.5)
      panel.add(t)
    })
  }

  const controls = touch ? HOW_TO_CONTROLS_TOUCH : HOW_TO_CONTROLS_DESKTOP
  const controlsY = panelH / 2 - 110
  const controlsTitle = scene.add.text(0, controlsY, touch ? 'TOUCH CONTROLS' : 'KEYBOARD CONTROLS', {
    fontSize: '13px',
    fontFamily: 'Fredoka, Arial Black',
    color: '#88aacc',
  }).setOrigin(0.5)
  panel.add(controlsTitle)
  controls.forEach((line, i) => {
    panel.add(
      scene.add.text(0, controlsY + 22 + i * 18, line, {
        fontSize: '13px',
        fontFamily: 'Fredoka, Arial',
        color: '#99aacc',
      }).setOrigin(0.5)
    )
  })

  const closeBtn = createButton(scene, 0, panelH / 2 - 36, '✕  CLOSE', 0xdd3333, 0xaa2222, 200, 46)
  panel.add(closeBtn)

  root.add([overlay, panel])
  panel.setScale(0.88).setAlpha(0)
  scene.tweens.add({
    targets: panel,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    duration: 220,
    ease: 'Back.easeOut',
  })

  const destroy = () => {
    if (!alive) return
    alive = false
    scene.input.keyboard?.off('keydown-ESC', onEsc)
    root.destroy(true)
    opts.onClose?.()
  }
  const onEsc = () => destroy()
  closeBtn.on('pointerdown', () => {
    Sfx.uiClick()
    destroy()
  })
  overlay.on('pointerdown', destroy)
  scene.input.keyboard?.on('keydown-ESC', onEsc)
  return destroy
}
