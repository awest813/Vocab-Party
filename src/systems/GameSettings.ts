/**
 * Persistent player preferences (audio + accessibility).
 * Stored in localStorage under `vocab-party-settings`.
 */

export type GameSettings = {
  /** Master mute — silences all SFX/music. */
  muted: boolean
  /** 0–1 SFX volume when not muted. */
  sfxVolume: number
  /** Soft looping ambient / menu bed volume 0–1. */
  musicVolume: number
  /** Skip heavy parallax / screen shake / flash when true. */
  reducedMotion: boolean
}

const STORAGE_KEY = 'vocab-party-settings'

const DEFAULTS: GameSettings = {
  muted: false,
  sfxVolume: 0.7,
  musicVolume: 0.35,
  reducedMotion: false,
}

let cached: GameSettings | null = null
const listeners = new Set<(s: GameSettings) => void>()

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

export function getSettings(): GameSettings {
  if (cached) return { ...cached }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSettings>
      cached = {
        muted: Boolean(parsed.muted),
        sfxVolume: clamp01(typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULTS.sfxVolume),
        musicVolume: clamp01(typeof parsed.musicVolume === 'number' ? parsed.musicVolume : DEFAULTS.musicVolume),
        reducedMotion: Boolean(parsed.reducedMotion),
      }
      return { ...cached }
    }
  } catch {
    /* ignore corrupt storage */
  }
  cached = { ...DEFAULTS }
  return { ...cached }
}

export function setSettings(patch: Partial<GameSettings>): GameSettings {
  const next: GameSettings = {
    ...getSettings(),
    ...patch,
  }
  next.sfxVolume = clamp01(next.sfxVolume)
  next.musicVolume = clamp01(next.musicVolume)
  cached = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota */
  }
  listeners.forEach(fn => fn({ ...next }))
  return { ...next }
}

export function onSettingsChange(fn: (s: GameSettings) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function isTouchPreferred(game?: { device?: { os?: { android?: boolean; iOS?: boolean; desktop?: boolean }; input?: { touch?: boolean } } }): boolean {
  try {
    if (game?.device) {
      const d = game.device
      return Boolean(d.os?.android || d.os?.iOS || d.input?.touch) && !d.os?.desktop
    }
  } catch {
    /* fall through */
  }
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

export function shouldReduceMotion(): boolean {
  if (getSettings().reducedMotion) return true
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return true
  }
  return false
}
