import { getSettings } from '../systems/GameSettings'
import { isAutoSimMode } from '../systems/gameFlags'

/** Read a word aloud with the browser's speech synthesis, respecting mute/volume. */
export function speakWord(word: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || isAutoSimMode()) return
  const s = getSettings()
  if (s.muted || s.sfxVolume <= 0.01) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(word)
    u.rate = 0.9
    u.volume = Math.min(1, s.sfxVolume + 0.2)
    u.lang = 'en-US'
    window.speechSynthesis.speak(u)
  } catch {
    /* speech unavailable — the game is fully playable without it */
  }
}

export function stopSpeech(): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch { /* ignore */ }
}
