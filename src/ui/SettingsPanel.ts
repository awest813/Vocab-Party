import Phaser from 'phaser'
import { createButton } from './Button'
import { getSettings, setSettings, type GameSettings } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'

type SettingsPanelOpts = {
  onClose?: () => void
  /** Called whenever a setting changes (so scenes can react). */
  onChange?: (s: GameSettings) => void
}

/**
 * Glass settings overlay: mute, SFX/music volume, reduced motion.
 * Returns a destroy function.
 */
export function openSettingsPanel(scene: Phaser.Scene, opts: SettingsPanelOpts = {}): () => void {
  const w = scene.scale.width
  const h = scene.scale.height
  let alive = true
  let settings = getSettings()

  const root = scene.add.container(0, 0).setDepth(4000)

  const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6).setInteractive()
  const panel = scene.add.container(w / 2, h / 2)
  const bg = scene.add.rectangle(0, 0, 520, 460, 0x141430, 0.96)
  bg.setStrokeStyle(3, 0x6688cc, 0.85)
  const header = scene.add.rectangle(0, -228, 512, 4, 0xffd700, 0.7)

  const title = scene.add.text(0, -195, '⚙️ SETTINGS', {
    fontSize: '32px',
    fontFamily: 'Fredoka, Arial Black',
    color: '#FFD700',
    stroke: '#553300',
    strokeThickness: 5,
  }).setOrigin(0.5)

  const hint = scene.add.text(0, -155, 'Audio unlocks after your first tap', {
    fontSize: '14px',
    fontFamily: 'Fredoka, Arial',
    color: '#8899bb',
  }).setOrigin(0.5)

  panel.add([bg, header, title, hint])

  const makeLabel = (y: number, text: string) => {
    const t = scene.add.text(-210, y, text, {
      fontSize: '18px',
      fontFamily: 'Fredoka, Arial Black',
      color: '#ddeeff',
    }).setOrigin(0, 0.5)
    panel.add(t)
    return t
  }

  // Mute toggle
  makeLabel(-95, 'Mute all sound')
  const muteBtn = createButton(scene, 140, -95, settings.muted ? 'MUTED' : 'ON', settings.muted ? 0xaa3344 : 0x22aa66, 0x115533, 140, 44)
  muteBtn.on('pointerdown', () => {
    settings = setSettings({ muted: !settings.muted })
    refreshMute()
    Sfx.uiToggle()
    opts.onChange?.(settings)
  })
  panel.add(muteBtn)

  const refreshMute = () => {
    const label = muteBtn.list.find(c => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined
    label?.setText(settings.muted ? 'MUTED' : 'ON')
  }

  // SFX slider
  makeLabel(-25, 'SFX volume')
  const sfxValue = scene.add.text(210, -25, `${Math.round(settings.sfxVolume * 100)}%`, {
    fontSize: '16px', fontFamily: 'Fredoka, Arial', color: '#aaccff'
  }).setOrigin(1, 0.5)
  panel.add(sfxValue)
  const sfxTrack = scene.add.rectangle(40, -25, 220, 14, 0x223355).setInteractive({ useHandCursor: true })
  const sfxFill = scene.add.rectangle(-70, -25, 220 * settings.sfxVolume, 14, 0x44ccff).setOrigin(0, 0.5)
  panel.add([sfxTrack, sfxFill])

  // Music slider
  makeLabel(45, 'Music volume')
  const musicValue = scene.add.text(210, 45, `${Math.round(settings.musicVolume * 100)}%`, {
    fontSize: '16px', fontFamily: 'Fredoka, Arial', color: '#aaccff'
  }).setOrigin(1, 0.5)
  panel.add(musicValue)
  const musicTrack = scene.add.rectangle(40, 45, 220, 14, 0x223355).setInteractive({ useHandCursor: true })
  const musicFill = scene.add.rectangle(-70, 45, 220 * settings.musicVolume, 14, 0xc084fc).setOrigin(0, 0.5)
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
  bindSlider(sfxTrack, sfxFill, sfxValue, 'sfxVolume', 0x44ccff)
  bindSlider(musicTrack, musicFill, musicValue, 'musicVolume', 0xc084fc)

  // Reduced motion
  makeLabel(115, 'Reduced motion')
  const motionBtn = createButton(
    scene,
    140,
    115,
    settings.reducedMotion ? 'ON' : 'OFF',
    settings.reducedMotion ? 0x4488ff : 0x334466,
    0x223355,
    140,
    44
  )
  motionBtn.on('pointerdown', () => {
    settings = setSettings({ reducedMotion: !settings.reducedMotion })
    const label = motionBtn.list.find(c => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined
    label?.setText(settings.reducedMotion ? 'ON' : 'OFF')
    Sfx.uiToggle()
    opts.onChange?.(settings)
  })
  panel.add(motionBtn)

  const controlsNote = scene.add.text(0, 165, 'Tip: Esc pauses · 1–4 answers questions', {
    fontSize: '13px',
    fontFamily: 'Fredoka, Arial',
    color: '#7788aa',
    align: 'center',
    wordWrap: { width: 460 },
  }).setOrigin(0.5)
  panel.add(controlsNote)

  const closeBtn = createButton(scene, 0, 205, '✕  CLOSE', 0xdd3333, 0xaa2222, 200, 48)
  panel.add(closeBtn)

  root.add([overlay, panel])
  panel.setScale(0.9).setAlpha(0)
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
  closeBtn.on('pointerdown', destroy)
  overlay.on('pointerdown', destroy)
  scene.input.keyboard?.on('keydown-ESC', onEsc)

  Sfx.unlock()
  return destroy
}
