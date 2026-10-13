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

  /** Pluck a guitar-ish note (rhythm minigame). `midi` is a MIDI note number. */
  pluck(midi: number, strong = false) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    this.tone({ freq, type: 'sawtooth', duration: strong ? 0.32 : 0.22, gain: strong ? 0.11 : 0.08, filterFreq: 2400 })
    this.tone({ freq: freq * 2, type: 'square', duration: 0.12, gain: 0.03, filterFreq: 3200 })
  }

  /** Drum hit for the rhythm minigame groove: kick, snare or hat. */
  drum(kind: 'kick' | 'snare' | 'hat') {
    if (this.sfxGain() <= 0) return
    if (kind === 'kick') this.tone({ freq: 140, endFreq: 45, type: 'sine', duration: 0.14, gain: 0.32 })
    else if (kind === 'snare') this.noiseBurst(0.1, 0.1, 1800)
    else this.noiseBurst(0.03, 0.035, 7000)
  }

  /** Muted "clunk" for a missed or wrong rhythm note. */
  clunk() {
    this.unlock()
    this.tone({ freq: 110, endFreq: 70, type: 'square', duration: 0.12, gain: 0.07, filterFreq: 500 })
  }

  /** Countdown beep; `final` is the higher GO tone. */
  tick(final = false) {
    this.unlock()
    this.tone({ freq: final ? 1046.5 : 659.25, type: 'square', duration: final ? 0.22 : 0.09, gain: 0.07 })
  }

  /** Minigame clock expired. */
  timeUp() {
    this.unlock()
    this.tone({ freq: 880, endFreq: 440, type: 'square', duration: 0.18, gain: 0.08 })
    this.tone({ freq: 660, endFreq: 330, type: 'square', duration: 0.24, gain: 0.07, delay: 0.16 })
  }

  /** Slot-reel tick for the minigame roulette. */
  reel() {
    if (this.sfxGain() <= 0) return
    this.tone({ freq: 1200, type: 'triangle', duration: 0.03, gain: 0.05 })
  }

  /** Item activated from inventory. */
  item() {
    this.unlock()
    this.tone({ freq: 520, endFreq: 780, type: 'square', duration: 0.1, gain: 0.09 })
    this.tone({ freq: 390, type: 'triangle', duration: 0.12, gain: 0.06, delay: 0.06 })
  }

  // ───────────────────────── procedural music ─────────────────────────

  /** Start (or switch to) a looping chiptune track. No-arg resumes the last track. */
  startMusic(track?: MusicTrack) {
    this.unlock()
    const next = track ?? this.currentTrack
    const ctx = this.ensure()
    if (!ctx || !this.musicGain) return
    if (getSettings().muted || getSettings().musicVolume <= 0.01) {
      this.currentTrack = next
      return
    }
    if (this.musicPlaying && this.currentTrack === next) return
    if (this.musicPlaying) this.stopMusic(true)
    this.currentTrack = next
    this.musicPlaying = true
    this.applyVolumes()
    this.step = 0
    this.nextStepTime = ctx.currentTime + 0.08
    const tick = () => this.scheduleMusic()
    tick()
    this.schedulerId = window.setInterval(tick, 25)
  }

  stopMusic(fade = true) {
    if (this.schedulerId !== undefined) {
      window.clearInterval(this.schedulerId)
      this.schedulerId = undefined
    }
    const ctx = this.ctx
    this.musicPlaying = false
    if (!ctx || !this.musicGain) {
      this.musicNodes = []
      return
    }
    const now = ctx.currentTime
    const nodes = [...this.musicNodes]
    this.musicNodes = []
    if (fade) {
      this.musicGain.gain.cancelScheduledValues(now)
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now)
      this.musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.3)
    }
    window.setTimeout(() => {
      nodes.forEach(n => {
        try {
          if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') (n as OscillatorNode).stop()
          n.disconnect()
        } catch { /* already stopped */ }
      })
      if (!this.musicPlaying) this.applyVolumes()
    }, fade ? 320 : 0)
    if (fade) {
      // Restore the bus level for the next track once the fade is done.
      window.setTimeout(() => this.applyVolumes(), 340)
    }
  }

  private currentTrack: MusicTrack = 'menu'
  private schedulerId?: number
  private step = 0
  private nextStepTime = 0

  private scheduleMusic() {
    const ctx = this.ctx
    if (!ctx || !this.musicGain || !this.musicPlaying) return
    const def = MUSIC_TRACKS[this.currentTrack]
    const stepDur = 60 / def.bpm / 4
    // After a throttled/background tab, skip missed steps instead of firing them all at once.
    if (this.nextStepTime < ctx.currentTime) this.nextStepTime = ctx.currentTime + 0.05
    if (typeof document !== 'undefined' && document.hidden) return
    // Drop stale nodes so the list doesn't grow forever.
    if (this.musicNodes.length > 400) this.musicNodes.splice(0, this.musicNodes.length - 200)
    while (this.nextStepTime < ctx.currentTime + 0.14) {
      this.playStep(def, this.step, this.nextStepTime, stepDur)
      this.nextStepTime += stepDur
      this.step = (this.step + 1) % (16 * def.chords.length)
    }
  }

  private playStep(def: TrackDef, step: number, t: number, stepDur: number) {
    const bar = Math.floor(step / 16)
    const s = step % 16
    const chord = def.chords[bar]
    if (def.bass.includes(s)) {
      this.musicVoice(midiFreq(chord[0] - 12), t, stepDur * 1.8, 'triangle', 0.32, 900)
    }
    if (s % 2 === 0) {
      const tone = chord[def.arp[(s / 2) % def.arp.length] % chord.length] + 12
      this.musicVoice(midiFreq(tone), t, stepDur * 0.9, 'square', 0.05, 2200)
    }
    const lead = def.lead[bar]?.[s]
    if (lead !== undefined && lead !== null) {
      this.musicVoice(midiFreq(lead), t, stepDur * 1.6, 'triangle', 0.13, 3200)
    }
    if (def.kick.includes(s)) this.musicKick(t)
    if (def.snare.includes(s)) this.musicNoise(t, 0.09, 0.12, 1800, 'bandpass')
    if (def.hat.includes(s)) this.musicNoise(t, 0.03, 0.05, 7000, 'highpass')
  }

  private musicVoice(freq: number, t: number, dur: number, type: OscillatorType, gain: number, cutoff: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    const f = ctx.createBiquadFilter()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    f.type = 'lowpass'
    f.frequency.value = cutoff
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(f)
    f.connect(g)
    g.connect(this.musicGain!)
    osc.start(t)
    osc.stop(t + dur + 0.02)
    this.musicNodes.push(osc, g, f)
  }

  private musicKick(t: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    g.gain.setValueAtTime(0.42, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(g)
    g.connect(this.musicGain!)
    osc.start(t)
    osc.stop(t + 0.18)
    this.musicNodes.push(osc, g)
  }

  private noiseBuffer?: AudioBuffer
  private musicNoise(t: number, dur: number, gain: number, freq: number, type: BiquadFilterType) {
    const ctx = this.ctx!
    if (!this.noiseBuffer) {
      const n = Math.floor(ctx.sampleRate * 0.2)
      this.noiseBuffer = ctx.createBuffer(1, n, ctx.sampleRate)
      const data = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
    }
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.musicGain!)
    src.start(t)
    src.stop(t + dur + 0.02)
    this.musicNodes.push(src, f, g)
  }
}

export type MusicTrack = 'menu' | 'board' | 'minigame' | 'results'

interface TrackDef {
  bpm: number
  /** One chord (MIDI notes, root first) per bar. */
  chords: number[][]
  /** Chord-tone indices cycled on eighth notes. */
  arp: number[]
  /** Optional lead line: per bar, 16 steps of MIDI notes (null = rest). */
  lead: (number | null)[][]
  bass: number[]
  kick: number[]
  snare: number[]
  hat: number[]
}

const _ = null
const MUSIC_TRACKS: Record<MusicTrack, TrackDef> = {
  // Breezy C – Am – F – G
  menu: {
    bpm: 104,
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    arp: [0, 1, 2, 1, 0, 2, 1, 2],
    lead: [
      [76, _, _, 74, _, _, 72, _, 74, _, 76, _, 79, _, _, _],
      [76, _, _, 74, _, _, 72, _, 69, _, _, _, 72, _, _, _],
      [77, _, _, 76, _, _, 74, _, 72, _, 74, _, 77, _, _, _],
      [79, _, _, 77, _, _, 76, _, 74, _, _, _, 71, _, 74, _],
    ],
    bass: [0, 6, 8, 14],
    kick: [0, 8],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
  },
  // Bouncy F – G – Em – Am board groove
  board: {
    bpm: 112,
    chords: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]],
    arp: [0, 2, 1, 2, 0, 2, 1, 2],
    lead: [
      [72, _, 74, _, 76, _, _, _, 77, _, 76, _, 74, _, _, _],
      [74, _, 76, _, 77, _, _, _, 79, _, 77, _, 76, _, _, _],
      [76, _, _, _, 74, _, 72, _, 71, _, _, _, 72, _, 74, _],
      [76, _, _, _, _, _, _, _, 72, _, 74, _, 76, _, _, _],
    ],
    bass: [0, 3, 8, 11],
    kick: [0, 8, 10],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
  },
  // Driving Am – F – C – G for minigames
  minigame: {
    bpm: 138,
    chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]],
    arp: [0, 1, 2, 1, 2, 1, 0, 1],
    lead: [
      [81, _, 79, _, 76, _, 79, _, 81, _, _, 84, _, 81, _, _],
      [81, _, 79, _, 77, _, 76, _, 77, _, _, 72, _, _, _, _],
      [79, _, 76, _, 72, _, 76, _, 79, _, _, 84, _, 79, _, _],
      [79, _, 77, _, 74, _, 71, _, 74, _, 77, _, 79, _, 83, _],
    ],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15],
  },
  // Triumphant C – F – G – C
  results: {
    bpm: 96,
    chords: [[60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]],
    arp: [0, 1, 2, 1, 0, 1, 2, 1],
    lead: [
      [72, _, _, _, 76, _, _, _, 79, _, _, _, 84, _, _, _],
      [81, _, _, _, 77, _, _, _, 72, _, _, _, 77, _, _, _],
      [79, _, _, _, 74, _, _, _, 71, _, _, _, 74, _, 79, _],
      [84, _, _, _, _, _, _, _, 79, _, _, _, 84, _, _, _],
    ],
    bass: [0, 8],
    kick: [0, 8],
    snare: [12],
    hat: [4, 12],
  },
}

function midiFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
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
