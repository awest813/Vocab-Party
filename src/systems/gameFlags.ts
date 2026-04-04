/**
 * URL-driven flags (e.g. ?autoSim=1) for CI / headless full-game capture.
 * Call `initGameFlagsFromLocation()` once at startup before scenes run.
 */

let autoSim = false

export function initGameFlagsFromLocation(): void {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(window.location.search)
  autoSim = q.has('autoSim') || q.get('demo') === '1'
}

export function isAutoSimMode(): boolean {
  return autoSim
}

/** Compress real-time delays when auto-simulating (keeps logic paths identical). */
export function scaleAutoSimDelay(ms: number): number {
  if (!autoSim) return ms
  return Math.max(0, Math.round(ms * 0.06))
}
