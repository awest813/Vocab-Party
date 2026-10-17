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

/**
 * Mix levels. SFX sit a few dB above the music bed so feedback cuts through, and everything
 * runs through a gentle compressor so stacked sounds (coin bursts, chords) can't clip.
 */
const SFX_LEVEL = 1.7
const MUSIC_LEVEL = 0.6
/** Music level while ducked (pause menu, big stings). */
const DUCK_LEVEL = 0.3
/** Same sound retriggered faster than this is dropped (coin spam, hover sweeps). */
const RETRIGGER_MS = 35

class SfxSystem {
  private ctx: AudioContext | null = null
  /** User mute → speakers. */
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  /** User music volume. */
  private musicGain: GainNode | null = null
  /** Ducking stage between the music volume and the mix. */
  private musicBus: GainNode | null = null
  /** The playing track's own fader, so tracks can crossfade without touching the volume. */
  private trackGain: GainNode | null = null
  private musicNodes: AudioNode[] = []
  private musicPlaying = false
  /** A scene asked for music (kept while muted so unmuting brings it back). */
  private wantMusic = false
  private ducked = false
  private duckPoll?: number
  private duckUntil = 0
  private unlocked = false
  private lastPlayed = new Map<string, number>()
  private detachSettings?: () => void

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!this.ctx) {
      this.ctx = new AC()
      this.buildBus(this.ctx)
      this.applyVolumes()
      this.detachSettings = onSettingsChange(() => this.onSettings())
      if (typeof document !== 'undefined') {
        // Don't leave synth voices running in a background tab.
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx || !this.unlocked) return
          if (document.hidden) void this.ctx.suspend()
          else void this.ctx.resume().then(() => this.applyDuck())
        })
      }
    }
    return this.ctx
  }

  /** speakers ← master(mute) ← limiter ← { sfxBus, musicBus ← musicGain(volume) ← trackGain }. */
  private buildBus(ctx: BaseAudioContext) {
    this.master = ctx.createGain()
    // Soft clipper as a safety limiter: transparent below ~-4 dBFS, rounds off peaks above.
    // (DynamicsCompressor was audibly uneven here — it dulled short clicks and pumped fanfares.)
    const limiter = ctx.createWaveShaper()
    limiter.curve = softClipCurve()
    limiter.oversample = '2x'
    const pre = ctx.createGain()
    pre.gain.value = 0.5
    const post = ctx.createGain()
    post.gain.value = 2
    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = SFX_LEVEL
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = MUSIC_LEVEL
    this.musicGain = ctx.createGain()
    this.sfxBus.connect(pre)
    this.musicGain.connect(this.musicBus)
    this.musicBus.connect(pre)
    pre.connect(limiter)
    limiter.connect(post)
    post.connect(this.master)
    this.master.connect(ctx.destination)
  }

  /** Call from any user gesture so browsers allow audio. */
  unlock() {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) {
      void ctx.resume()
    }
    this.unlocked = true
  }

  private applyVolumes() {
    if (!this.master || !this.musicGain || !this.ctx) return
    const s = getSettings()
    const mute = s.muted ? 0 : 1
    this.master.gain.setTargetAtTime(mute, this.ctx.currentTime, 0.02)
    this.musicGain.gain.setTargetAtTime(s.musicVolume * mute, this.ctx.currentTime, 0.05)
  }

  /** Volume changes apply live; muting or silencing music also stops (and later restarts) the synth. */
  private onSettings() {
    this.applyVolumes()
    const s = getSettings()
    const silent = s.muted || s.musicVolume <= 0.01
    if (silent && this.musicPlaying) this.stopTrack(false)
    else if (!silent && this.wantMusic && !this.musicPlaying) this.startMusic()
  }

  private sfxGain(): number {
    const s = getSettings()
    if (s.muted) return 0
    return s.sfxVolume
  }

  /** False when this sound fired a moment ago — stops machine-gun stacking. */
  private fresh(name: string): boolean {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const last = this.lastPlayed.get(name) ?? -Infinity
    if (now - last < RETRIGGER_MS) return false
    this.lastPlayed.set(name, now)
    return true
  }

  /** Lower the music under the pause menu (or a big sting) and bring it back after. */
  duck(on: boolean) {
    this.ducked = on
    this.applyDuck()
  }

  /** Briefly dip the music so a fanfare reads clearly. */
  private duckFor(seconds: number) {
    const ctx = this.ctx
    if (!ctx) return
    this.duckUntil = Math.max(this.duckUntil, ctx.currentTime + seconds)
    this.applyDuck()
    window.setTimeout(() => this.applyDuck(), seconds * 1000 + 30)
  }

  private applyDuck() {
    const ctx = this.ctx
    if (!ctx || !this.musicBus) return
    const down = this.ducked || ctx.currentTime < this.duckUntil
    this.musicBus.gain.setTargetAtTime(MUSIC_LEVEL * (down ? DUCK_LEVEL : 1), ctx.currentTime, down ? 0.04 : 0.25)
    // The audio clock stops while suspended (hidden tab), so re-check until the sting window passes.
    if (!this.ducked && down && this.duckPoll === undefined) {
      this.duckPoll = window.setTimeout(() => {
        this.duckPoll = undefined
        this.applyDuck()
      }, 250)
    }
  }

  private tone(opts: ToneOpts) {
    const ctx = this.ensure()
    if (!ctx || !this.sfxBus) return
    const vol = this.sfxGain() * (opts.gain ?? 0.2)
    if (vol <= 0) return
    const now = ctx.currentTime + (opts.delay ?? 0)
    const dur = opts.duration ?? 0.12
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(opts.freq, now)
    if (opts.endFreq != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), now + dur)
    }
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    // Buzzy waves get a gentle low-pass by default so they don't sound harsh on small speakers.
    const cutoff = opts.filterFreq ?? (osc.type === 'square' || osc.type === 'sawtooth' ? 4200 : 0)
    if (cutoff) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = cutoff
      osc.connect(filter)
      filter.connect(gain)
    } else {
      osc.connect(gain)
    }
    gain.connect(this.sfxBus)
    osc.start(now)
    osc.stop(now + dur + 0.02)
  }

  private noiseBuffer?: AudioBuffer
  /** One shared second of white noise; bursts read from a random offset instead of allocating. */
  private noise(ctx: BaseAudioContext): AudioBuffer {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const n = ctx.sampleRate
      this.noiseBuffer = ctx.createBuffer(1, n, ctx.sampleRate)
      const data = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
    }
    return this.noiseBuffer
  }

  private noiseBurst(duration = 0.08, gain = 0.12, filterFreq = 1800, delay = 0) {
    const ctx = this.ensure()
    if (!ctx || !this.sfxBus) return
    const vol = this.sfxGain() * gain
    if (vol <= 0) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 0.8
    const g = ctx.createGain()
    const now = ctx.currentTime + delay
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxBus)
    src.start(now, Math.random() * 0.7)
    src.stop(now + duration)
  }

  uiClick() {
    this.unlock()
    if (!this.fresh('click')) return
    this.tone({ freq: 660, endFreq: 880, type: 'triangle', duration: 0.06, gain: 0.12 })
  }

  uiHover() {
    if (this.sfxGain() <= 0 || !this.fresh('hover')) return
    this.tone({ freq: 520, type: 'sine', duration: 0.04, gain: 0.035 })
  }

  uiToggle() {
    this.unlock()
    if (!this.fresh('toggle')) return
    this.tone({ freq: 440, endFreq: 660, type: 'square', duration: 0.08, gain: 0.07 })
  }

  roll() {
    this.unlock()
    this.noiseBurst(0.1, 0.1, 1200)
    this.tone({ freq: 180, endFreq: 90, type: 'sawtooth', duration: 0.12, gain: 0.08, filterFreq: 600 })
    this.tone({ freq: 320, type: 'triangle', duration: 0.05, gain: 0.06, delay: 0.08 })
  }

  /** One clack of the die tumbling (called each frame of the roll animation). */
  rattle() {
    if (this.sfxGain() <= 0 || !this.fresh('rattle')) return
    this.noiseBurst(0.025, 0.05, 2200 + Math.random() * 1600)
    this.tone({ freq: 500 + Math.random() * 300, type: 'triangle', duration: 0.025, gain: 0.03 })
  }

  /** The die settles on a face: a woody knock that rises with the number rolled. */
  diceLand(value: number) {
    this.unlock()
    const v = Math.max(0, Math.min(8, value))
    this.noiseBurst(0.05, 0.08, 900)
    this.tone({ freq: 220 + v * 40, endFreq: 160 + v * 30, type: 'triangle', duration: 0.1, gain: 0.13 })
    if (v >= 6) this.tone({ freq: 880 + v * 40, type: 'sine', duration: 0.16, gain: 0.06, delay: 0.07 })
  }

  correct() {
    this.unlock()
    if (!this.fresh('correct')) return
    this.tone({ freq: 523.25, type: 'sine', duration: 0.1, gain: 0.14 })
    this.tone({ freq: 659.25, type: 'sine', duration: 0.12, gain: 0.12, delay: 0.08 })
    this.tone({ freq: 783.99, type: 'triangle', duration: 0.18, gain: 0.1, delay: 0.16 })
  }

  wrong() {
    this.unlock()
    if (!this.fresh('wrong')) return
    this.tone({ freq: 220, endFreq: 110, type: 'sawtooth', duration: 0.18, gain: 0.1, filterFreq: 500 })
    this.noiseBurst(0.08, 0.06, 400)
  }

  coin() {
    this.unlock()
    if (!this.fresh('coin')) return
    this.tone({ freq: 988, type: 'square', duration: 0.06, gain: 0.06 })
    this.tone({ freq: 1319, type: 'square', duration: 0.1, gain: 0.05, delay: 0.05 })
  }

  /** Correct answer in a streak: the chime climbs a semitone per hit (capped), for a combo feel. */
  combo(streak: number) {
    this.unlock()
    if (!this.fresh('combo')) return
    const k = Math.pow(2, Math.min(Math.max(0, streak - 1), 9) / 12)
    this.tone({ freq: 523.25 * k, type: 'sine', duration: 0.09, gain: 0.13 })
    this.tone({ freq: 659.25 * k, type: 'sine', duration: 0.1, gain: 0.11, delay: 0.06 })
    this.tone({ freq: 783.99 * k, type: 'triangle', duration: 0.16, gain: 0.1, delay: 0.12 })
  }

  /** Streak bonus fanfare: quick rising arpeggio with a sparkle. */
  streakBonus() {
    this.unlock()
    ;[784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, type: 'square', duration: 0.08, gain: 0.07, delay: 0.1 + i * 0.05 }))
    this.tone({ freq: 2093, type: 'sine', duration: 0.3, gain: 0.05, delay: 0.32 })
  }

  /** Card flip (Memory Match). */
  flip() {
    this.unlock()
    if (!this.fresh('flip')) return
    this.noiseBurst(0.05, 0.07, 2600)
    this.tone({ freq: 600, endFreq: 900, type: 'triangle', duration: 0.05, gain: 0.05 })
  }

  /** Balloon pop (Letter Rescue). */
  pop() {
    this.unlock()
    if (!this.fresh('pop')) return
    this.noiseBurst(0.07, 0.14, 1500)
    this.tone({ freq: 900, endFreq: 300, type: 'sine', duration: 0.08, gain: 0.08 })
  }

  /** Mallet bonk (Whack-a-Word); `good` adds a bright ding. */
  bonk(good = true) {
    this.unlock()
    if (!this.fresh('bonk')) return
    this.tone({ freq: 240, endFreq: 120, type: 'triangle', duration: 0.09, gain: 0.16 })
    this.noiseBurst(0.04, 0.08, 900)
    if (good) this.tone({ freq: 1318.5, type: 'sine', duration: 0.18, gain: 0.07, delay: 0.05 })
  }

  /** A link snapping into place (Link Up). */
  zip() {
    this.unlock()
    if (!this.fresh('zip')) return
    this.tone({ freq: 400, endFreq: 1600, type: 'triangle', duration: 0.12, gain: 0.07 })
  }

  /** Coins paid out or lost: a short falling jingle. */
  coinLoss() {
    this.unlock()
    if (!this.fresh('coinLoss')) return
    this.tone({ freq: 1175, endFreq: 880, type: 'square', duration: 0.07, gain: 0.05 })
    this.tone({ freq: 880, endFreq: 587, type: 'square', duration: 0.12, gain: 0.05, delay: 0.07 })
  }

  /** Cash register for buying a shop or item. */
  purchase() {
    this.unlock()
    this.noiseBurst(0.04, 0.06, 3200)
    this.tone({ freq: 1568, type: 'square', duration: 0.05, gain: 0.05, delay: 0.03 })
    this.tone({ freq: 2093, type: 'triangle', duration: 0.22, gain: 0.07, delay: 0.08 })
  }

  whoosh() {
    this.unlock()
    if (!this.fresh('whoosh')) return
    this.noiseBurst(0.18, 0.09, 900)
    this.tone({ freq: 400, endFreq: 120, type: 'triangle', duration: 0.18, gain: 0.06 })
  }

  /** Tide Turn: a rolling wave wash, gliding down as the tide goes out or up as it comes in. */
  tide(goingOut: boolean) {
    this.unlock()
    if (!this.fresh('tide')) return
    this.duckFor(1.2)
    for (let i = 0; i < 3; i++) this.noiseBurst(0.45, 0.08, 500 + i * 250, i * 0.28)
    this.tone({ freq: goingOut ? 660 : 220, endFreq: goingOut ? 220 : 660, type: 'sine', duration: 0.9, gain: 0.07 })
    this.tone({ freq: goingOut ? 988 : 330, endFreq: goingOut ? 330 : 988, type: 'triangle', duration: 0.7, gain: 0.04, delay: 0.15 })
  }

  /** Bonus tile: bright upward sparkle. */
  bonus() {
    this.unlock()
    ;[880, 1109, 1319, 1760].forEach((f, i) => this.tone({ freq: f, type: 'triangle', duration: 0.12, gain: 0.07, delay: i * 0.05 }))
  }

  /** Penalty tile: a deflating "wah-wah". */
  penalty() {
    this.unlock()
    this.tone({ freq: 392, endFreq: 370, type: 'sawtooth', duration: 0.2, gain: 0.08, filterFreq: 900 })
    this.tone({ freq: 349, endFreq: 262, type: 'sawtooth', duration: 0.34, gain: 0.08, filterFreq: 800, delay: 0.2 })
  }

  /** Mystery tile: wobbly question-mark warble. */
  mystery() {
    this.unlock()
    for (let i = 0; i < 6; i++) {
      this.tone({ freq: i % 2 ? 740 : 622, type: 'sine', duration: 0.07, gain: 0.07, delay: i * 0.06 })
    }
    this.tone({ freq: 523, endFreq: 1046, type: 'triangle', duration: 0.18, gain: 0.07, delay: 0.36 })
  }

  battle() {
    this.unlock()
    this.tone({ freq: 120, type: 'sawtooth', duration: 0.2, gain: 0.12, filterFreq: 400 })
    this.tone({ freq: 180, type: 'square', duration: 0.12, gain: 0.08, delay: 0.05 })
    this.noiseBurst(0.12, 0.1, 700)
  }

  /** A blow lands — heavier for more damage. */
  hit(heavy = false) {
    this.unlock()
    this.noiseBurst(heavy ? 0.16 : 0.1, heavy ? 0.1 : 0.07, 600)
    this.tone({ freq: heavy ? 150 : 200, endFreq: 60, type: 'sine', duration: heavy ? 0.22 : 0.14, gain: heavy ? 0.12 : 0.08 })
  }

  /** A defend that absorbs the blow: metallic clang. */
  block() {
    this.unlock()
    this.tone({ freq: 1245, type: 'square', duration: 0.18, gain: 0.05, filterFreq: 5000 })
    this.tone({ freq: 1661, type: 'triangle', duration: 0.26, gain: 0.05, delay: 0.01 })
    this.noiseBurst(0.05, 0.07, 4000)
  }

  /** A clean dodge. */
  dodge() {
    this.unlock()
    this.noiseBurst(0.14, 0.07, 2600)
    this.tone({ freq: 700, endFreq: 1400, type: 'sine', duration: 0.14, gain: 0.06 })
  }

  /** Whose-turn chime: two soft notes. */
  turnStart() {
    this.unlock()
    if (!this.fresh('turn')) return
    this.tone({ freq: 784, type: 'sine', duration: 0.1, gain: 0.07 })
    this.tone({ freq: 1046.5, type: 'sine', duration: 0.16, gain: 0.07, delay: 0.09 })
  }

  win() {
    this.unlock()
    this.duckFor(1)
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      this.tone({ freq: f, type: 'triangle', duration: 0.22, gain: 0.12, delay: i * 0.12 })
    })
    this.tone({ freq: 1318.5, type: 'sine', duration: 0.4, gain: 0.06, delay: 0.48 })
  }

  star() {
    this.unlock()
    if (!this.fresh('star')) return
    this.duckFor(0.8)
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
    if (!this.fresh('splash')) return
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
    // Balanced against the plucks — the kick used to be ~10 dB louder than anything else.
    if (kind === 'kick') this.tone({ freq: 140, endFreq: 45, type: 'sine', duration: 0.14, gain: 0.09 })
    else if (kind === 'snare') this.noiseBurst(0.1, 0.09, 1800)
    else this.noiseBurst(0.03, 0.035, 7000)
  }

  /** Board step blip; pitch rises as the remaining steps run down. */
  boardStep(remaining: number) {
    if (this.sfxGain() <= 0) return
    const freq = 520 + Math.max(0, 8 - remaining) * 50
    this.tone({ freq, type: 'triangle', duration: 0.07, gain: 0.07 })
  }

  /** Muted "clunk" for a missed or wrong rhythm note. */
  clunk() {
    this.unlock()
    if (!this.fresh('clunk')) return
    this.tone({ freq: 110, endFreq: 70, type: 'square', duration: 0.12, gain: 0.07, filterFreq: 500 })
  }

  /** Countdown beep; `final` is the higher GO tone. */
  tick(final = false) {
    this.unlock()
    this.tone({ freq: final ? 1046.5 : 659.25, type: 'square', duration: final ? 0.22 : 0.09, gain: 0.07 })
  }

  /** Last seconds on a question clock: a soft, urgent tick. */
  warn() {
    this.unlock()
    if (!this.fresh('warn')) return
    this.tone({ freq: 1568, type: 'sine', duration: 0.05, gain: 0.05 })
  }

  /** Minigame clock expired. */
  timeUp() {
    this.unlock()
    this.tone({ freq: 880, endFreq: 440, type: 'square', duration: 0.18, gain: 0.08 })
    this.tone({ freq: 660, endFreq: 330, type: 'square', duration: 0.24, gain: 0.07, delay: 0.16 })
  }

  /** Slot-reel tick for the minigame roulette. */
  reel() {
    if (this.sfxGain() <= 0 || !this.fresh('reel')) return
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
    this.wantMusic = true
    const ctx = this.ensure()
    if (!ctx || !this.musicGain) return
    if (getSettings().muted || getSettings().musicVolume <= 0.01) {
      this.currentTrack = next
      return
    }
    if (this.musicPlaying && this.currentTrack === next) return
    // Crossfade: the old track fades on its own fader while the new one fades in.
    if (this.musicPlaying) this.stopTrack(true)
    this.currentTrack = next
    this.musicPlaying = true
    this.applyVolumes()
    const fader = ctx.createGain()
    fader.gain.setValueAtTime(0.0001, ctx.currentTime)
    fader.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.35)
    fader.connect(this.musicGain)
    this.trackGain = fader
    this.step = 0
    this.nextStepTime = ctx.currentTime + 0.08
    const tick = () => this.scheduleMusic()
    tick()
    this.schedulerId = window.setInterval(tick, 25)
  }

  /** Stop the music (a scene that wants silence). Settings changes won't restart it. */
  stopMusic(fade = true) {
    this.wantMusic = false
    this.stopTrack(fade)
  }

  private stopTrack(fade: boolean) {
    if (this.schedulerId !== undefined) {
      window.clearInterval(this.schedulerId)
      this.schedulerId = undefined
    }
    this.musicPlaying = false
    const ctx = this.ctx
    const fader = this.trackGain
    const nodes = [...this.musicNodes]
    this.musicNodes = []
    this.trackGain = null
    if (!ctx || !fader) return
    const now = ctx.currentTime
    const fadeSecs = fade ? 0.3 : 0.02
    fader.gain.cancelScheduledValues(now)
    fader.gain.setValueAtTime(Math.max(0.0001, fader.gain.value), now)
    fader.gain.exponentialRampToValueAtTime(0.0001, now + fadeSecs)
    window.setTimeout(() => {
      nodes.forEach(n => {
        try {
          if (n instanceof AudioScheduledSourceNode) n.stop()
          n.disconnect()
        } catch { /* already stopped */ }
      })
      fader.disconnect()
    }, fadeSecs * 1000 + 40)
  }

  private currentTrack: MusicTrack = 'menu'
  private schedulerId?: number
  private step = 0
  private nextStepTime = 0

  private scheduleMusic() {
    const ctx = this.ctx
    if (!ctx || !this.trackGain || !this.musicPlaying) return
    const def = MUSIC_TRACKS[this.currentTrack]
    const stepDur = 60 / def.bpm / 4
    // After a throttled/background tab, skip missed steps instead of firing them all at once.
    if (this.nextStepTime < ctx.currentTime) this.nextStepTime = ctx.currentTime + 0.05
    if (typeof document !== 'undefined' && document.hidden) return
    // Drop finished nodes so the list doesn't grow forever.
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
      this.musicVoice(midiFreq(chord[0] - 12), t, stepDur * 1.8, 'triangle', 0.3, 900)
    }
    if (s % 2 === 0) {
      const tone = chord[def.arp[(s / 2) % def.arp.length] % chord.length] + 12
      this.musicVoice(midiFreq(tone), t, stepDur * 0.9, 'square', 0.045, 1800)
    }
    const lead = def.lead[bar]?.[s]
    if (lead !== undefined && lead !== null) {
      this.musicVoice(midiFreq(lead), t, stepDur * 1.6, 'triangle', 0.15, 3200)
    }
    if (def.kick.includes(s)) this.musicKick(t)
    if (def.snare.includes(s)) this.musicNoise(t, 0.09, 0.1, 1800, 'bandpass')
    if (def.hat.includes(s)) this.musicNoise(t, 0.03, 0.04, 7000, 'highpass')
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
    g.connect(this.trackGain!)
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
    // Kept modest: at full level the kick spiked 20 dB over the melody.
    g.gain.setValueAtTime(0.22, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(g)
    g.connect(this.trackGain!)
    osc.start(t)
    osc.stop(t + 0.18)
    this.musicNodes.push(osc, g)
  }

  private musicNoise(t: number, dur: number, gain: number, freq: number, type: BiquadFilterType) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.trackGain!)
    src.start(t, Math.random() * 0.7)
    src.stop(t + dur + 0.02)
    this.musicNodes.push(src, f, g)
  }
}

export type MusicTrack = 'menu' | 'board' | 'minigame' | 'minigame2' | 'minigame3' | 'battle' | 'finale' | 'results' | 'lofi' | 'fiesta'

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
  // Second minigame theme: funky E minor groove (Em – C – D – Bm).
  minigame2: {
    bpm: 146,
    chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]],
    arp: [0, 2, 1, 2, 0, 1, 2, 1],
    lead: [
      [76, _, 76, 79, _, 76, _, 74, 76, _, _, _, 71, _, 74, _],
      [72, _, 72, 76, _, 72, _, 71, 72, _, _, _, 67, _, 71, _],
      [74, _, 74, 78, _, 74, _, 72, 74, _, 78, _, 81, _, _, _],
      [78, _, 76, _, 74, _, 71, _, 74, _, _, _, 71, _, _, _],
    ],
    bass: [0, 3, 6, 8, 11, 14],
    kick: [0, 6, 8, 14],
    snare: [4, 12],
    hat: [2, 3, 6, 10, 11, 14],
  },
  // Third minigame theme: bouncy D major skip (D – G – A – D).
  minigame3: {
    bpm: 132,
    chords: [[50, 54, 57], [55, 59, 62], [57, 61, 64], [50, 54, 57]],
    arp: [0, 1, 2, 1, 0, 1, 2, 1],
    lead: [
      [78, _, 81, _, 78, _, 74, _, 76, _, 78, _, 81, _, _, _],
      [79, _, 83, _, 79, _, 76, _, 74, _, 76, _, 79, _, _, _],
      [81, _, 85, _, 81, _, 76, _, 79, _, 78, _, 76, _, _, _],
      [78, _, 74, _, 76, _, 78, _, 74, _, _, _, _, _, _, _],
    ],
    bass: [0, 4, 8, 12],
    kick: [0, 8],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
  },
  // Battle: tense D minor stabs (Dm – Bb – C – A).
  battle: {
    bpm: 160,
    chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
    arp: [0, 0, 1, 2, 0, 0, 2, 1],
    lead: [
      [74, _, _, 74, _, _, 77, _, 76, _, 74, _, 72, _, _, _],
      [70, _, _, 70, _, _, 74, _, 72, _, 70, _, 69, _, _, _],
      [72, _, _, 72, _, _, 76, _, 74, _, 72, _, 71, _, _, _],
      [69, _, 73, _, 76, _, 73, _, 81, _, _, _, 76, _, _, _],
    ],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [1, 3, 5, 7, 9, 11, 13, 15],
  },
  // Last Stretch: the board groove's chords, faster and driving.
  finale: {
    bpm: 140,
    chords: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]],
    arp: [0, 1, 2, 1, 0, 2, 1, 2],
    lead: [
      [72, _, 74, _, 76, _, 77, _, 79, _, 77, _, 76, _, 74, _],
      [74, _, 76, _, 77, _, 79, _, 81, _, 79, _, 77, _, 76, _],
      [76, _, 79, _, 76, _, 72, _, 71, _, 72, _, 74, _, 76, _],
      [81, _, _, _, 79, _, 77, _, 76, _, 74, _, 72, _, _, _],
    ],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
  },
  // Party Shop board theme: mellow lo-fi seventh chords (Cmaj7 – Am7 – Dm7 – G7).
  lofi: {
    bpm: 84,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]],
    arp: [0, 2, 1, 3, 2, 1, 3, 2],
    lead: [
      [_, _, _, _, 76, _, _, 74, _, _, 72, _, _, _, _, _],
      [_, _, _, _, 72, _, _, 71, _, _, 69, _, _, _, _, _],
      [_, _, _, _, 77, _, _, 76, _, _, 74, _, 72, _, _, _],
      [_, _, _, _, 74, _, _, 71, _, _, _, _, 67, _, _, _],
    ],
    bass: [0, 7, 10],
    kick: [0, 10],
    snare: [8],
    hat: [4, 12, 14],
  },
  // Party Shop board theme: bright brassy G – C – D – G fiesta.
  fiesta: {
    bpm: 128,
    chords: [[55, 59, 62], [60, 64, 67], [62, 66, 69], [55, 59, 62]],
    arp: [0, 1, 2, 1, 0, 2, 1, 2],
    lead: [
      [79, _, 79, _, 83, _, 81, _, 79, _, _, 74, _, 79, _, _],
      [76, _, 76, _, 79, _, 77, _, 76, _, _, 72, _, 76, _, _],
      [78, _, 78, _, 81, _, 79, _, 78, _, 76, _, 74, _, _, _],
      [79, _, 83, _, 86, _, _, _, 83, _, 79, _, 74, _, _, _],
    ],
    bass: [0, 4, 8, 12],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
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

/**
 * Waveshaper curve over input [-2, 2] (scaled by 0.5 going in, 2 coming out): linear up to
 * ±0.6, then a tanh knee that never exceeds ±1.
 */
function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 2048
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const r = ((i / (n - 1)) * 2 - 1) * 2
    const a = Math.abs(r)
    const y = a <= 0.6 ? a : 0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4)
    curve[i] = (Math.sign(r) * y) / 2
  }
  return curve
}

function midiFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

export const Sfx = new SfxSystem()

/** Three minigame themes rotate by game, so back-to-back games don't sound the same. */
export function minigameTrack(gameId: string): MusicTrack {
  let h = 0
  for (const ch of gameId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (['minigame', 'minigame2', 'minigame3'] as const)[h % 3]
}

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
