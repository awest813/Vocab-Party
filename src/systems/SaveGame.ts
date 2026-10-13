import type { GameState } from './GameState'
import { getBoard } from './BoardLayout'

/**
 * Single-slot autosave for a party in progress. Written at the start of every
 * turn so "Continue" resumes exactly where the last turn began.
 */
export interface SaveData {
  version: 1
  savedAt: number
  roundsPerGame: number
  state: GameState
  shopOwners: Record<number, number>
}

const SAVE_KEY = 'vocab-party-save'

export function writeSave(data: Omit<SaveData, 'version' | 'savedAt'>): void {
  try {
    const payload: SaveData = { version: 1, savedAt: Date.now(), ...data }
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
  } catch {
    /* storage full or unavailable — autosave is best-effort */
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData
    if (data?.version !== 1 || !data.state || !Array.isArray(data.state.players) || data.state.players.length === 0) return null
    // Minimal integrity checks so a corrupt save can never crash the board.
    const board = getBoard(data.state.options?.board)
    if (data.state.players.some(p => typeof p.position !== 'number' || p.position < 0 || p.position >= board.nodes.length || !p.stats)) return null
    if (typeof data.roundsPerGame !== 'number' || data.roundsPerGame < 1) return null
    return data
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

/** Short human description for the menu's Continue button. */
export function describeSave(data: SaveData): string {
  const board = getBoard(data.state.options?.board)
  const humans = data.state.players.filter(p => !p.isCpu).map(p => p.name)
  const who = humans.length > 0 ? humans.join(', ') : `${data.state.players.length} CPUs`
  return `Round ${data.state.round}/${data.roundsPerGame} · ${board.name} · ${who}`
}
