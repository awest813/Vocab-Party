/**
 * URL-driven flags (e.g. ?autoSim=1&rounds=10&fullMap=1) for CI / headless capture.
 * Call `initGameFlagsFromLocation()` once at startup before scenes run.
 */

let autoSim = false
let autoSimRounds: number | null = null
let autoSimFullMap = false
let autoSimPlayers = 4

export function initGameFlagsFromLocation(): void {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(window.location.search)
  autoSim = q.has('autoSim') || q.get('demo') === '1'
  autoSimFullMap = q.get('fullMap') === '1' || q.get('map') === 'full'
  const roundsRaw = q.get('rounds')
  if (roundsRaw) {
    const n = Number.parseInt(roundsRaw, 10)
    autoSimRounds = Number.isFinite(n) && n > 0 ? Math.min(n, 99) : null
  } else {
    autoSimRounds = null
  }
  const playersRaw = q.get('players')
  if (playersRaw) {
    const n = Number.parseInt(playersRaw, 10)
    autoSimPlayers = Number.isFinite(n) ? Math.max(1, Math.min(4, n)) : 4
  } else {
    autoSimPlayers = 4
  }
}

export function isAutoSimMode(): boolean {
  return autoSim
}

export function getAutoSimFullMap(): boolean {
  return autoSimFullMap
}

export function getAutoSimRounds(): number | null {
  return autoSimRounds
}

export function getAutoSimPlayers(): number {
  return autoSimPlayers
}

/** Compress real-time delays when auto-simulating (keeps logic paths identical). */
export function scaleAutoSimDelay(ms: number): number {
  if (!autoSim) return ms
  return Math.max(0, Math.round(ms * 0.04))
}
