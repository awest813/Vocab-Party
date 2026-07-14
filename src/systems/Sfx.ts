/**
 * Lightweight procedural SFX via Web Audio API.
 * No external audio files required — works offline and unlocks on first gesture.
 */

import { getSettings, onSettingsChange } from './GameSettings'

type ToneOpts = {
  freq: number
  endFreq?: number
  type?: OscillatorType
  duration?: number
  gain?: number
  delay?: number
  filterFreq?: number
}

class SfxSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private musicNodes: AudioNode[] = []
  private musicPlaying = false
  private unlocked = false
  private detachSettings?: () => void

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!this.ctx) {
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.musicGain = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.musicGain.connect(this.master)
      this.applyVolumes()
      this.detachSettings = onSettingsChange(() => this.applyVolumes())
    }
    return this.ctx
  }

  /** Call from any user gesture so browsers allow audio. */
  unlock() {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    this.unlocked = true
    this.applyVolumes()
  }

  private applyVolumes() {
    if (!this.master || !this.musicGain || !this.ctx) return
    const s = getSettings()
    const mute = s.muted ? 0 : 1
    this.master.gain.setTargetAtTime(mute, this.ctx.currentTime, 0.02)
    this.musicGain.gain.setTargetAtTime(s.musicVolume * mute, this.ctx.currentTime, 0.05)
  }

  private sfxGain(): number {
    const s = getSettings()
    if (s.muted) return 0
    return s.sfxVolume
  }

  private tone(opts: ToneOpts) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const now = ctx.currentTime + (opts.delay ?? 0)
    const dur = opts.duration ?? 0.12
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const vol = this.sfxGain() * (opts.gain ?? 0.2)
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(opts.freq, now)
    if (opts.endFreq != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), now + dur)
    }
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    if (opts.filterFreq) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = opts.filterFreq
      osc.connect(filter)
      filter.connect(gain)
    } else {
      osc.connect(gain)
    }
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + dur + 0.02)
  }

  private noiseBurst(duration = 0.08, gain = 0.12, filterFreq = 1800) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const samples = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 0.8
    const g = ctx.createGain()
    const vol = this.sfxGain() * gain
    const now = ctx.currentTime
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(now)
    src.stop(now + duration)
  }

  uiClick() {
    this.unlock()
    this.tone({ freq: 660, endFreq: 880, type: 'triangle', duration: 0.06, gain: 0.12 })
  }

  uiHover() {
    if (this.sfxGain() <= 0) return
    this.tone({ freq: 520, type: 'sine', duration: 0.04, gain: 0.04 })
  }

  uiToggle() {
    this.unlock()
    this.tone({ freq: 440, endFreq: 660, type: 'square', duration: 0.08, gain: 0.08 })
  }

  roll() {
    this.unlock()
    this.noiseBurst(0.1, 0.1, 1200)
    this.tone({ freq: 180, endFreq: 90, type: 'sawtooth', duration: 0.12, gain: 0.08, filterFreq: 600 })
    this.tone({ freq: 320, type: 'triangle', duration: 0.05, gain: 0.06, delay: 0.08 })
  }

  correct() {
    this.unlock()
    this.tone({ freq: 523.25, type: 'sine', duration: 0.1, gain: 0.14 })
    this.tone({ freq: 659.25, type: 'sine', duration: 0.12, gain: 0.12, delay: 0.08 })
    this.tone({ freq: 783.99, type: 'triangle', duration: 0.18, gain: 0.1, delay: 0.16 })
  }

  wrong() {
    this.unlock()
    this.tone({ freq: 220, endFreq: 110, type: 'sawtooth', duration: 0.18, gain: 0.1, filterFreq: 500 })
    this.noiseBurst(0.08, 0.06, 400)
  }

  coin() {
    this.unlock()
    this.tone({ freq: 988, type: 'square', duration: 0.06, gain: 0.07 })
    this.tone({ freq: 1319, type: 'square', duration: 0.1, gain: 0.06, delay: 0.05 })
  }

  whoosh() {
    this.unlock()
    this.noiseBurst(0.16, 0.08, 900)
    this.tone({ freq: 400, endFreq: 120, type: 'triangle', duration: 0.16, gain: 0.06 })
  }

  battle() {
    this.unlock()
    this.tone({ freq: 120, type: 'sawtooth', duration: 0.2, gain: 0.12, filterFreq: 400 })
    this.tone({ freq: 180, type: 'square', duration: 0.12, gain: 0.08, delay: 0.05 })
    this.noiseBurst(0.12, 0.1, 700)
  }

  win() {
    this.unlock()
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      this.tone({ freq: f, type: 'triangle', duration: 0.22, gain: 0.12, delay: i * 0.12 })
    })
  }

  star() {
    this.unlock()
    this.tone({ freq: 740, type: 'sine', duration: 0.12, gain: 0.12 })
    this.tone({ freq: 988, type: 'sine', duration: 0.18, gain: 0.1, delay: 0.1 })
    this.tone({ freq: 1480, type: 'triangle', duration: 0.25, gain: 0.08, delay: 0.2 })
  }

  pause() {
    this.unlock()
    this.tone({ freq: 360, endFreq: 240, type: 'triangle', duration: 0.12, gain: 0.08 })
  }

  /** Minigame splash / countdown sting. */
  splash() {
    this.unlock()
    this.tone({ freq: 392, endFreq: 587, type: 'triangle', duration: 0.14, gain: 0.1 })
    this.tone({ freq: 784, type: 'sine', duration: 0.16, gain: 0.08, delay: 0.1 })
    this.noiseBurst(0.1, 0.06, 1400)
  }

  /** Item activated from inventory. */
  item() {
    this.unlock()
    this.tone({ freq: 520, endFreq: 780, type: 'square', duration: 0.1, gain: 0.09 })
    this.tone({ freq: 390, type: 'triangle', duration: 0.12, gain: 0.06, delay: 0.06 })
  }

  /** Soft looping ambient pad for menus / board. */
  startMusic() {
    this.unlock()
    const ctx = this.ensure()
    if (!ctx || !this.musicGain || this.musicPlaying) return
    if (getSettings().muted || getSettings().musicVolume <= 0.01) return

    this.musicPlaying = true
    const now = ctx.currentTime
    const freqs = [110, 164.81, 196]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      osc.type = i === 0 ? 'sine' : 'triangle'
      osc.frequency.value = freq
      filter.type = 'lowpass'
      filter.frequency.value = 480
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.045 / freqs.length, now + 1.2)
      osc.connect(filter)
      filter.connect(g)
      g.connect(this.musicGain!)
      osc.start(now)
      this.musicNodes.push(osc, g, filter)
    })
  }

  stopMusic(fade = true) {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) {
      this.musicPlaying = false
      this.musicNodes = []
      return
    }
    const now = ctx.currentTime
    if (fade) {
      this.musicGain.gain.cancelScheduledValues(now)
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now)
      this.musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.4)
    }
    const nodes = [...this.musicNodes]
    this.musicNodes = []
    this.musicPlaying = false
    window.setTimeout(() => {
      nodes.forEach(n => {
        try {
          if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
            (n as OscillatorNode).stop()
          }
          n.disconnect()
        } catch { /* already stopped */ }
      })
      this.applyVolumes()
    }, fade ? 450 : 0)
  }
}

export const Sfx = new SfxSystem()

/** Install a one-time unlock on the first pointer/key interaction with the page. */
export function installAudioUnlock() {
  if (typeof window === 'undefined') return
  const unlock = () => {
    Sfx.unlock()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}
