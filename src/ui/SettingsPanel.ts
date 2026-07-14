import Phaser from 'phaser'
import { createButton, setButtonFill, setButtonLabel } from './Button'
import { createDimmer, createPanel, addVignette, createInsetPlate } from './Panel'
import { getSettings, setSettings, type GameSettings } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'
import { COLORS, FONT, hexColor } from './Theme'

type SettingsPanelOpts = {
  onClose?: () => void
  /** Called whenever a setting changes (so scenes can react). */
  onChange?: (s: GameSettings) => void
}

/**
 * Glass settings overlay: mute, SFX/music volume, reduced motion.
 * Returns a destroy function.
 * Callers (Menu/Pause) own Esc — this panel does not register its own key handler
 * to avoid Esc stacking that can resume/close the wrong layer.
 */
export function openSettingsPanel(scene: Phaser.Scene, opts: SettingsPanelOpts = {}): () => void {
  const w = scene.scale.width
  const h = scene.scale.height
  let alive = true
  let settings = getSettings()

  const root = scene.add.container(0, 0).setDepth(4000)
  const overlay = createDimmer(scene, 0.62)
  overlay.setDepth(4000)
  const vig = addVignette(scene, 0.55, 4000)
  root.add(vig)

  const panel = createPanel(scene, {
    x: w / 2,
    y: h / 2,
    width: 520,
    height: 460,
    fill: COLORS.bgPanel,
    border: COLORS.gold,
    borderAlpha: 0.4,
    headerColor: COLORS.skyDeep,
    headerHeight: 48,
    title: 'SETTINGS',
    titleColor: hexColor(COLORS.gold),
    depth: 4001,
    animateIn: true,
  })

  const plate = createInsetPlate(scene, 0, 20, 460, 320, {
    fill: COLORS.bgDeep,
    fillAlpha: 0.35,
    border: COLORS.strokeSoft,
    borderAlpha: 0.1,
    radius: 14,
  })
  panel.add(plate)

  const hint = scene.add.text(0, -155, 'Audio unlocks after your first tap', {
    fontSize: '14px',
    fontFamily: FONT.body,
    color: hexColor(COLORS.mute),
  }).setOrigin(0.5)
  panel.add(hint)

  const makeLabel = (y: number, text: string) => {
    const t = scene.add.text(-210, y, text, {
      fontSize: '18px',
      fontFamily: FONT.display,
      color: hexColor(COLORS.frost),
    }).setOrigin(0, 0.5)
    panel.add(t)
    return t
  }

  // Mute toggle
  makeLabel(-95, 'Mute all sound')
  const muteBtn = createButton(
    scene,
    140,
    -95,
    settings.muted ? 'MUTED' : 'ON',
    settings.muted ? COLORS.danger : COLORS.party,
    settings.muted ? COLORS.dangerDeep : COLORS.partyDeep,
    140,
    44
  )
  muteBtn.on('pointerdown', () => {
    settings = setSettings({ muted: !settings.muted })
    refreshMute()
    Sfx.uiToggle()
    opts.onChange?.(settings)
  })
  panel.add(muteBtn)

  const refreshMute = () => {
    setButtonLabel(muteBtn, settings.muted ? 'MUTED' : 'ON')
    setButtonFill(muteBtn, settings.muted ? COLORS.danger : COLORS.party)
  }

  // SFX slider
  makeLabel(-25, 'SFX volume')
  const sfxValue = scene.add.text(210, -25, `${Math.round(settings.sfxVolume * 100)}%`, {
    fontSize: '16px', fontFamily: FONT.body, color: hexColor(COLORS.sky),
  }).setOrigin(1, 0.5)
  panel.add(sfxValue)
  const sfxTrack = scene.add.rectangle(40, -25, 220, 14, COLORS.bgPanelAlt).setInteractive({ useHandCursor: true })
  const sfxFill = scene.add.rectangle(-70, -25, 220 * settings.sfxVolume, 14, COLORS.sky).setOrigin(0, 0.5)
  panel.add([sfxTrack, sfxFill])

  // Music slider
  makeLabel(45, 'Music volume')
  const musicValue = scene.add.text(210, 45, `${Math.round(settings.musicVolume * 100)}%`, {
    fontSize: '16px', fontFamily: FONT.body, color: hexColor(COLORS.sky),
  }).setOrigin(1, 0.5)
  panel.add(musicValue)
  const musicTrack = scene.add.rectangle(40, 45, 220, 14, COLORS.bgPanelAlt).setInteractive({ useHandCursor: true })
  const musicFill = scene.add.rectangle(-70, 45, 220 * settings.musicVolume, 14, COLORS.teal).setOrigin(0, 0.5)
  panel.add([musicTrack, musicFill])

  const bindSlider = (
    track: Phaser.GameObjects.Rectangle,
    fill: Phaser.GameObjects.Rectangle,
    valueText: Phaser.GameObjects.Text,
    key: 'sfxVolume' | 'musicVolume',
    color: number
  ) => {
    const apply = (pointer: Phaser.Input.Pointer) => {
      const local = track.getBounds()
      const t = Phaser.Math.Clamp((pointer.x - local.left) / local.width, 0, 1)
      settings = setSettings({ [key]: t })
      fill.width = 220 * t
      fill.setFillStyle(color)
      valueText.setText(`${Math.round(t * 100)}%`)
      opts.onChange?.(settings)
      if (key === 'sfxVolume') Sfx.uiClick()
      if (key === 'musicVolume') {
        Sfx.stopMusic(false)
        if (!settings.muted && settings.musicVolume > 0.01) Sfx.startMusic()
      }
    }
    track.on('pointerdown', (p: Phaser.Input.Pointer) => apply(p))
    track.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) apply(p)
    })
  }
  bindSlider(sfxTrack, sfxFill, sfxValue, 'sfxVolume', COLORS.sky)
  bindSlider(musicTrack, musicFill, musicValue, 'musicVolume', COLORS.teal)

  // Reduced motion
  makeLabel(115, 'Reduced motion')
  const motionBtn = createButton(
    scene,
    140,
    115,
    settings.reducedMotion ? 'ON' : 'OFF',
    settings.reducedMotion ? COLORS.skyBtn : COLORS.chrome,
    settings.reducedMotion ? COLORS.skyBtnDeep : COLORS.chromeDeep,
    140,
    44
  )
  motionBtn.on('pointerdown', () => {
    settings = setSettings({ reducedMotion: !settings.reducedMotion })
    setButtonLabel(motionBtn, settings.reducedMotion ? 'ON' : 'OFF')
    setButtonFill(motionBtn, settings.reducedMotion ? COLORS.skyBtn : COLORS.chrome)
    Sfx.uiToggle()
    opts.onChange?.(settings)
  })
  panel.add(motionBtn)

  const controlsNote = scene.add.text(0, 165, 'Tip: Esc pauses · 1–4 answers questions', {
    fontSize: '13px',
    fontFamily: FONT.body,
    color: hexColor(COLORS.mute),
    align: 'center',
    wordWrap: { width: 460 },
  }).setOrigin(0.5)
  panel.add(controlsNote)

  const closeBtn = createButton(scene, 0, 205, '✕  CLOSE', COLORS.danger, COLORS.dangerDeep, 200, 48)
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

  Sfx.unlock()
  return destroy
}
