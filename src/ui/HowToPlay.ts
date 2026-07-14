import Phaser from 'phaser'
import { createButton } from './Button'
import { createDimmer, createPanel, addVignette } from './Panel'
import {
  HOW_TO_CONTROLS_DESKTOP,
  HOW_TO_CONTROLS_TOUCH,
  HOW_TO_INTRO,
  HOW_TO_RULES,
  HOW_TO_TILES,
} from './HowToPlayContent'
import { isTouchPreferred } from '../systems/GameSettings'
import { COLORS, FONT, hexColor } from './Theme'

type HowToOpts = {
  mode?: 'tiles' | 'rules'
  onClose?: () => void
}

/**
 * Shared How-to-Play modal. Returns destroy().
 * Callers (Menu/Pause) own Esc — this modal does not register its own key handler
 * to avoid Esc stacking bugs with parent pause/menu listeners.
 */
export function openHowToPlay(scene: Phaser.Scene, opts: HowToOpts = {}): () => void {
  const w = scene.scale.width
  const h = scene.scale.height
  const touch = isTouchPreferred(scene.sys.game)
  const mode = opts.mode ?? 'rules'
  let alive = true

  const root = scene.add.container(0, 0).setDepth(3900)
  const overlay = createDimmer(scene, 0.6)
  overlay.setDepth(3900)
  const vig = addVignette(scene, 0.5, 3900)
  root.add(vig)

  const panelW = mode === 'tiles' ? 780 : 640
  const panelH = mode === 'tiles' ? 540 : 460
  const panel = createPanel(scene, {
    x: w / 2,
    y: h / 2,
    width: panelW,
    height: panelH,
    fill: COLORS.bgPanel,
    border: COLORS.gold,
    borderAlpha: 0.38,
    headerColor: COLORS.skyDeep,
    headerHeight: 48,
    title: 'HOW TO PLAY',
    titleColor: hexColor(COLORS.gold),
    depth: 3901,
    animateIn: true,
  })

  const intro = scene.add.text(0, -panelH / 2 + 72, HOW_TO_INTRO, {
    fontSize: '15px',
    fontFamily: FONT.body,
    color: hexColor(COLORS.mist),
    align: 'center',
    wordWrap: { width: panelW - 60 },
  }).setOrigin(0.5)
  panel.add(intro)

  if (mode === 'tiles') {
    const cols = 2
    const itemW = 340
    const itemH = 54
    const gridX = -itemW - 10
    const gridStartY = -panelH / 2 + 110
    HOW_TO_TILES.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = gridX + col * (itemW + 20)
      const y = gridStartY + row * (itemH + 10)
      const cell = scene.add.rectangle(x + itemW / 2, y + itemH / 2, itemW, itemH, item.color, 0.15)
      cell.setStrokeStyle(1.5, item.color, 0.6)
      const emojiT = scene.add.text(x + 10, y + itemH / 2, item.emoji, { fontSize: '22px' }).setOrigin(0, 0.5)
      const labelT = scene.add.text(x + 44, y + itemH / 2 - 8, item.label, {
        fontSize: '15px', fontFamily: FONT.display, color: hexColor(COLORS.frost),
      }).setOrigin(0, 0.5)
      const descT = scene.add.text(x + 44, y + itemH / 2 + 10, item.desc, {
        fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mute),
      }).setOrigin(0, 0.5)
      panel.add([cell, emojiT, labelT, descT])
    })
  } else {
    HOW_TO_RULES.forEach((rule, i) => {
      const t = scene.add.text(0, -panelH / 2 + 110 + i * 34, rule, {
        fontSize: '16px',
        fontFamily: FONT.body,
        color: hexColor(COLORS.frost),
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
    fontFamily: FONT.display,
    color: hexColor(COLORS.mist),
  }).setOrigin(0.5)
  panel.add(controlsTitle)
  controls.forEach((line, i) => {
    panel.add(
      scene.add.text(0, controlsY + 22 + i * 18, line, {
        fontSize: '13px',
        fontFamily: FONT.body,
        color: hexColor(COLORS.mute),
      }).setOrigin(0.5)
    )
  })

  const closeBtn = createButton(scene, 0, panelH / 2 - 36, '✕  CLOSE', COLORS.danger, COLORS.dangerDeep, 200, 46)
  panel.add(closeBtn)

  root.add([overlay, panel])

  const destroy = () => {
    if (!alive) return
    alive = false
    root.destroy(true)
    opts.onClose?.()
  }
  closeBtn.on('pointerdown', destroy)
  overlay.on('pointerdown', destroy)
  return destroy
}
