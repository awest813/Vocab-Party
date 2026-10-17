import type { TileType } from './GameState'

export interface BoardNode {
  id: number
  col: number
  row: number
  next: number[]
}

export const BOARD_COLS = 12
export const BOARD_ROWS = 8

const LOOP_NODES: BoardNode[] = [
  { id: 0, col: 0, row: 0, next: [1] },
  { id: 1, col: 1, row: 0, next: [2] },
  { id: 2, col: 2, row: 0, next: [3] },
  { id: 3, col: 3, row: 0, next: [4, 18] },
  { id: 4, col: 4, row: 0, next: [5] },
  { id: 5, col: 5, row: 0, next: [6] },
  { id: 6, col: 6, row: 0, next: [7] },
  { id: 7, col: 7, row: 0, next: [8] },
  { id: 8, col: 8, row: 0, next: [9] },
  { id: 9, col: 9, row: 0, next: [10] },
  { id: 10, col: 10, row: 0, next: [11] },
  { id: 11, col: 11, row: 0, next: [12] },
  { id: 12, col: 11, row: 1, next: [13] },
  { id: 13, col: 11, row: 2, next: [14] },
  { id: 14, col: 11, row: 3, next: [15] },
  { id: 15, col: 11, row: 4, next: [16] },
  { id: 16, col: 11, row: 5, next: [17] },
  { id: 17, col: 11, row: 6, next: [26] },
  { id: 18, col: 3, row: 1, next: [19] },
  { id: 19, col: 3, row: 2, next: [20] },
  { id: 20, col: 3, row: 3, next: [21] },
  { id: 21, col: 3, row: 4, next: [22] },
  { id: 22, col: 4, row: 4, next: [23] },
  { id: 23, col: 5, row: 4, next: [24] },
  { id: 24, col: 6, row: 4, next: [25] },
  { id: 25, col: 7, row: 4, next: [26] },
  { id: 26, col: 11, row: 7, next: [27] },
  { id: 27, col: 10, row: 7, next: [28] },
  { id: 28, col: 9, row: 7, next: [29] },
  { id: 29, col: 8, row: 7, next: [30] },
  { id: 30, col: 7, row: 7, next: [31] },
  { id: 31, col: 6, row: 7, next: [32] },
  { id: 32, col: 5, row: 7, next: [33] },
  { id: 33, col: 4, row: 7, next: [34] },
  { id: 34, col: 3, row: 7, next: [35] },
  { id: 35, col: 2, row: 7, next: [36] },
  { id: 36, col: 1, row: 7, next: [37] },
  { id: 37, col: 0, row: 7, next: [38] },
  { id: 38, col: 0, row: 6, next: [39] },
  { id: 39, col: 0, row: 5, next: [40] },
  { id: 40, col: 0, row: 4, next: [41] },
  { id: 41, col: 0, row: 3, next: [42] },
  { id: 42, col: 0, row: 2, next: [43] },
  { id: 43, col: 0, row: 1, next: [0] },
]

/** Tile per node (index 0 is Start). Rebalanced after a play-simulation audit. */
const LOOP_TILES: TileType[] = [
  'start', 'vocab', 'vocab', 'grammar', 'bonus', 'star', 'item_shop', 'minigame', 'vocab', 'brick',
  'penalty', 'mystery', 'vocab', 'shop', 'bonus', 'grammar', 'item_shop', 'minigame', 'grammar', 'penalty',
  'star', 'bonus', 'mystery', 'brick', 'vocab', 'grammar', 'swap', 'penalty', 'bonus', 'shop',
  'item_shop', 'star', 'mystery', 'brick', 'vocab', 'minigame', 'penalty', 'grammar', 'grammar', 'bonus',
  'vocab', 'shop', 'vocab', 'bonus',
]

const GARDEN_NODES: BoardNode[] = [
  { id: 0, col: 0, row: 0, next: [1] },
  { id: 1, col: 1, row: 0, next: [2] },
  { id: 2, col: 2, row: 0, next: [3] },
  { id: 3, col: 3, row: 0, next: [4] },
  { id: 4, col: 4, row: 0, next: [5] },
  { id: 5, col: 5, row: 0, next: [6] },
  { id: 6, col: 6, row: 0, next: [7, 36] },
  { id: 7, col: 7, row: 0, next: [8] },
  { id: 8, col: 8, row: 0, next: [9] },
  { id: 9, col: 9, row: 0, next: [10] },
  { id: 10, col: 10, row: 0, next: [11] },
  { id: 11, col: 11, row: 0, next: [12] },
  { id: 12, col: 11, row: 1, next: [13] },
  { id: 13, col: 11, row: 2, next: [14] },
  { id: 14, col: 11, row: 3, next: [15] },
  { id: 15, col: 11, row: 4, next: [16] },
  { id: 16, col: 11, row: 5, next: [17] },
  { id: 17, col: 11, row: 6, next: [18] },
  { id: 18, col: 11, row: 7, next: [19] },
  { id: 19, col: 10, row: 7, next: [20] },
  { id: 20, col: 9, row: 7, next: [21] },
  { id: 21, col: 8, row: 7, next: [22] },
  { id: 22, col: 7, row: 7, next: [23] },
  { id: 23, col: 6, row: 7, next: [24] },
  { id: 24, col: 5, row: 7, next: [25] },
  { id: 25, col: 4, row: 7, next: [26] },
  { id: 26, col: 3, row: 7, next: [27] },
  { id: 27, col: 2, row: 7, next: [28] },
  { id: 28, col: 1, row: 7, next: [29] },
  { id: 29, col: 0, row: 7, next: [30] },
  { id: 30, col: 0, row: 6, next: [31] },
  { id: 31, col: 0, row: 5, next: [32] },
  { id: 32, col: 0, row: 4, next: [33] },
  { id: 33, col: 0, row: 3, next: [34] },
  { id: 34, col: 0, row: 2, next: [35] },
  { id: 35, col: 0, row: 1, next: [0] },
  { id: 36, col: 6, row: 1, next: [37] },
  { id: 37, col: 6, row: 2, next: [38] },
  { id: 38, col: 6, row: 3, next: [39] },
  { id: 39, col: 6, row: 4, next: [40] },
  { id: 40, col: 6, row: 5, next: [41] },
  { id: 41, col: 6, row: 6, next: [23] },
]

const GARDEN_TILES: TileType[] = [
  'start', 'grammar', 'vocab', 'penalty', 'vocab', 'swap', 'bonus', 'grammar', 'bonus', 'grammar',
  'item_shop', 'shop', 'minigame', 'vocab', 'vocab', 'penalty', 'star', 'grammar', 'penalty', 'brick',
  'vocab', 'bonus', 'shop', 'mystery', 'bonus', 'mystery', 'vocab', 'shop', 'mystery', 'shop',
  'star', 'item_shop', 'grammar', 'brick', 'minigame', 'vocab', 'star', 'vocab', 'vocab', 'minigame',
  'grammar', 'penalty',
]

const SUMMIT_NODES: BoardNode[] = [
  { id: 0, col: 0, row: 7, next: [1] },
  { id: 1, col: 0, row: 6, next: [2] },
  { id: 2, col: 0, row: 5, next: [3] },
  { id: 3, col: 0, row: 4, next: [4] },
  { id: 4, col: 0, row: 3, next: [5] },
  { id: 5, col: 0, row: 2, next: [6] },
  { id: 6, col: 0, row: 1, next: [7] },
  { id: 7, col: 0, row: 0, next: [8] },
  { id: 8, col: 1, row: 0, next: [9] },
  { id: 9, col: 2, row: 0, next: [10] },
  { id: 10, col: 3, row: 0, next: [11] },
  { id: 11, col: 4, row: 0, next: [12] },
  { id: 12, col: 5, row: 0, next: [13] },
  { id: 13, col: 6, row: 0, next: [14] },
  { id: 14, col: 7, row: 0, next: [15] },
  { id: 15, col: 8, row: 0, next: [16] },
  { id: 16, col: 9, row: 0, next: [17] },
  { id: 17, col: 10, row: 0, next: [18] },
  { id: 18, col: 11, row: 0, next: [19] },
  { id: 19, col: 11, row: 1, next: [20] },
  { id: 20, col: 11, row: 2, next: [21, 54] },
  { id: 21, col: 10, row: 2, next: [22] },
  { id: 22, col: 9, row: 2, next: [23] },
  { id: 23, col: 8, row: 2, next: [24] },
  { id: 24, col: 7, row: 2, next: [25] },
  { id: 25, col: 6, row: 2, next: [26] },
  { id: 26, col: 5, row: 2, next: [27] },
  { id: 27, col: 4, row: 2, next: [28] },
  { id: 28, col: 3, row: 2, next: [29] },
  { id: 29, col: 2, row: 2, next: [30] },
  { id: 30, col: 2, row: 3, next: [31] },
  { id: 31, col: 2, row: 4, next: [32] },
  { id: 32, col: 3, row: 4, next: [33] },
  { id: 33, col: 4, row: 4, next: [34] },
  { id: 34, col: 5, row: 4, next: [35] },
  { id: 35, col: 6, row: 4, next: [36] },
  { id: 36, col: 7, row: 4, next: [37] },
  { id: 37, col: 8, row: 4, next: [38] },
  { id: 38, col: 9, row: 4, next: [39] },
  { id: 39, col: 10, row: 4, next: [40] },
  { id: 40, col: 11, row: 4, next: [41] },
  { id: 41, col: 11, row: 5, next: [42] },
  { id: 42, col: 11, row: 6, next: [43] },
  { id: 43, col: 11, row: 7, next: [44] },
  { id: 44, col: 10, row: 7, next: [45] },
  { id: 45, col: 9, row: 7, next: [46] },
  { id: 46, col: 8, row: 7, next: [47] },
  { id: 47, col: 7, row: 7, next: [48] },
  { id: 48, col: 6, row: 7, next: [49] },
  { id: 49, col: 5, row: 7, next: [50] },
  { id: 50, col: 4, row: 7, next: [51] },
  { id: 51, col: 3, row: 7, next: [52] },
  { id: 52, col: 2, row: 7, next: [53] },
  { id: 53, col: 1, row: 7, next: [0] },
  { id: 54, col: 11, row: 3, next: [40] },
]

const SUMMIT_TILES: TileType[] = [
  'start', 'vocab', 'bonus', 'mystery', 'swap', 'minigame', 'star', 'grammar', 'mystery', 'penalty',
  'brick', 'shop', 'brick', 'shop', 'minigame', 'grammar', 'star', 'item_shop', 'bonus', 'vocab',
  'mystery', 'grammar', 'grammar', 'grammar', 'vocab', 'item_shop', 'vocab', 'vocab', 'mystery', 'star',
  'penalty', 'mystery', 'grammar', 'shop', 'bonus', 'item_shop', 'grammar', 'penalty', 'minigame', 'shop',
  'vocab', 'minigame', 'bonus', 'star', 'vocab', 'bonus', 'vocab', 'swap', 'grammar', 'vocab',
  'vocab', 'penalty', 'bonus', 'vocab', 'penalty',
]

/**
 * Thesaurus Tides: an island coastline. A cliff path (11 -> 44 -> 15) skips the star cove, and a
 * sandbar causeway (28 -> 45..48 -> 39) cuts across the bay, but only while the tide is out.
 */
const TIDES_COORDS: [number, number][] = [
  [0, 5], [0, 4], [0, 3], [0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [3, 0], [4, 0], // 0-9: west cliffs
  [5, 0], [6, 0], [6, 1], [7, 1], [8, 1], [8, 0], [9, 0], [10, 0], [11, 0], [11, 1], // 10-19: north cove
  [11, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7], [10, 7], [9, 7], [8, 7], [8, 6], // 20-29: east shore
  [8, 5], [8, 4], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [3, 5], [3, 6], [3, 7], // 30-39: around the bay
  [2, 7], [1, 7], [0, 7], [0, 6], // 40-43: south beach
  [7, 0], // 44: cliff path
  [7, 7], [6, 7], [5, 7], [4, 7], // 45-48: sandbar causeway
]
const TIDES_NODES: BoardNode[] = TIDES_COORDS.map(([col, row], id) => {
  let next: number[]
  if (id === 11) next = [12, 44]
  else if (id === 43) next = [0]
  else if (id === 44) next = [15]
  else if (id === 48) next = [39]
  else next = [id + 1]
  return { id, col, row, next }
})

const TIDES_TILES: TileType[] = [
  'start', 'vocab', 'grammar', 'star', 'vocab', 'bonus', 'shop', 'grammar', 'mystery', 'vocab',
  'item_shop', 'grammar', 'bonus', 'star', 'penalty', 'vocab', 'shop', 'minigame', 'vocab', 'penalty',
  'grammar', 'bonus', 'item_shop', 'star', 'penalty', 'brick', 'mystery', 'swap', 'vocab', 'penalty',
  'shop', 'minigame', 'vocab', 'bonus', 'star', 'grammar', 'brick', 'penalty', 'vocab', 'minigame',
  'shop', 'vocab', 'bonus', 'mystery',
  'brick',
  'bonus', 'mystery', 'item_shop', 'grammar',
]

export interface BoardTheme {
  stageTop: number
  stageBottom: number
  /** Fill for empty interior cells. */
  cell: number
  cellLine: number
  /** Outer frame stroke. */
  frame: number
  /** Path glow tint. */
  glow: number
}

export interface BoardDef {
  id: BoardId
  name: string
  emoji: string
  tagline: string
  nodes: BoardNode[]
  /** One tile type per node; index 0 is always 'start'. */
  tiles: TileType[]
  theme: BoardTheme
  /** Brand plate placement in tile units (center), so it never covers path tiles. */
  logo: { cx: number; cy: number; w: number; h: number; compact?: boolean }
  /** Ambient decorations placed in empty cells. */
  decor: { col: number; row: number; emoji: string }[]
  /** Optional signature gimmick. Boards without one use `nodes`/`tiles` unchanged. */
  event?: BoardEvent
}

export type TidePhase = 'high' | 'low'

/**
 * "Tide Turn": the tide flips every `period` rounds (rounds 1..period are high tide).
 * At low tide extra edges open (a sandbar causeway) and some shore tiles swap type.
 * At high tide the sandbar nodes are submerged: nothing leads onto them, and anyone
 * standing there when the water returns is washed back to `washTo`.
 * `nodes`/`tiles` on the board describe high tide; see resolveNodes / resolveTiles.
 */
export interface TideEvent {
  kind: 'tides'
  period: number
  /** Edges that only exist at low tide (appended to the `from` node's next[]). */
  lowTideEdges: { from: number; to: number }[]
  /** Nodes under water at high tide (only reachable via a low-tide edge). */
  sandbar: number[]
  /** Where players on a flooding sandbar are washed to. */
  washTo: number
  /** Tile types that replace the normal ones at low tide (shore tiles). */
  lowTideTiles: Record<number, TileType>
  /** Purely visual sea cells (empty grid cells drawn as animated water). */
  water: { col: number; row: number }[]
}

export type BoardEvent = TideEvent

export type BoardId = 'loop' | 'garden' | 'summit' | 'tides'

export const BOARDS: BoardDef[] = [
  {
    id: 'loop',
    name: 'Lexicon Loop',
    emoji: '📚',
    tagline: 'The classic ring with an inner shortcut. Balanced and quick.',
    nodes: LOOP_NODES,
    tiles: LOOP_TILES,
    theme: { stageTop: 0x070b14, stageBottom: 0x10182a, cell: 0x0a1c14, cellLine: 0x1a3a28, frame: 0xf4c430, glow: 0x2ec4b6 },
    logo: { cx: 7.5, cy: 2.5, w: 300, h: 124 },
    decor: [],
  },
  {
    id: 'garden',
    name: 'Grammar Garden',
    emoji: '🌷',
    tagline: 'A blooming ring split by a straight garden path. Take the shortcut — or stop and smell the stars.',
    nodes: GARDEN_NODES,
    tiles: GARDEN_TILES,
    theme: { stageTop: 0x06120c, stageBottom: 0x10291b, cell: 0x0e2617, cellLine: 0x2a5a36, frame: 0x7bd88f, glow: 0x9be36b },
    logo: { cx: 3.5, cy: 4, w: 264, h: 124 },
    decor: [
      { col: 8, row: 2, emoji: '🌻' }, { col: 9, row: 5, emoji: '🌷' }, { col: 7, row: 4, emoji: '🌿' },
      { col: 10, row: 3, emoji: '🍄' }, { col: 2, row: 6, emoji: '🌼' }, { col: 4, row: 1, emoji: '🌱' },
    ],
  },
  {
    id: 'summit',
    name: 'Spelling Summit',
    emoji: '🏔️',
    tagline: 'A long switchback climb. A risky ledge skips the whole middle — if you can reach it.',
    nodes: SUMMIT_NODES,
    tiles: SUMMIT_TILES,
    theme: { stageTop: 0x0a0f1e, stageBottom: 0x222a44, cell: 0x16203a, cellLine: 0x3a4a6a, frame: 0xbfe3ff, glow: 0x9fd4ff },
    logo: { cx: 6, cy: 6, w: 440, h: 88, compact: true },
    decor: [
      { col: 4, row: 1, emoji: '❄️' }, { col: 8, row: 1, emoji: '🏔️' }, { col: 6, row: 3, emoji: '⛰️' },
      { col: 9, row: 3, emoji: '❄️' }, { col: 1, row: 3, emoji: '🌲' }, { col: 1, row: 5, emoji: '🌲' },
    ],
  },
  {
    id: 'tides',
    name: 'Thesaurus Tides',
    emoji: '🌊',
    tagline: 'An island coast where the tide turns every 3 rounds. Low tide opens a sandbar shortcut and flips the 🌊 shore tiles.',
    nodes: TIDES_NODES,
    tiles: TIDES_TILES,
    theme: { stageTop: 0x03101c, stageBottom: 0x0a2638, cell: 0x2a2617, cellLine: 0x5c4e2c, frame: 0x6fe0f0, glow: 0x48cae4 },
    logo: { cx: 6, cy: 3, w: 420, h: 88, compact: true },
    decor: [
      { col: 0, row: 0, emoji: '⛵' }, { col: 6, row: 6, emoji: '🐬' }, { col: 2, row: 5, emoji: '🐚' },
      { col: 9, row: 5, emoji: '🦀' }, { col: 10, row: 4, emoji: '🌴' }, { col: 10, row: 2, emoji: '🏝️' },
    ],
    event: {
      kind: 'tides',
      period: 3,
      lowTideEdges: [{ from: 28, to: 45 }],
      sandbar: [45, 46, 47, 48],
      washTo: 28,
      lowTideTiles: { 29: 'bonus', 33: 'penalty', 37: 'bonus', 42: 'penalty' },
      water: [
        { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 },
        { col: 4, row: 5 }, { col: 5, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 },
        { col: 4, row: 6 }, { col: 5, row: 6 }, { col: 6, row: 6 }, { col: 7, row: 6 },
      ],
    },
  },
]

export function getBoard(id: string | undefined): BoardDef {
  return BOARDS.find(b => b.id === id) ?? BOARDS[0]
}

/** Default board (legacy exports kept for callers that only need the classic layout). */
export const BOARD_NODES = LOOP_NODES
export const BOARD_PATH_LENGTH = LOOP_NODES.length

/** Tide phase for a round (1-based): `period` rounds of high tide, then `period` of low, ... */
export function tideForRound(event: TideEvent, round: number): TidePhase {
  return Math.floor((Math.max(1, round) - 1) / Math.max(1, event.period)) % 2 === 0 ? 'high' : 'low'
}

/** The board graph as it currently stands (low-tide edges added when the tide is out). */
export function resolveNodes(board: BoardDef, tide?: TidePhase): BoardNode[] {
  const ev = board.event
  if (!ev || tide !== 'low') return board.nodes
  return board.nodes.map(n => {
    const extra = ev.lowTideEdges.filter(e => e.from === n.id).map(e => e.to)
    return extra.length > 0 ? { ...n, next: [...n.next, ...extra] } : n
  })
}

/** Tile types as they currently stand (shore tiles swap at low tide). */
export function resolveTiles(board: BoardDef, tide?: TidePhase): TileType[] {
  const ev = board.event
  if (!ev || tide !== 'low') return board.tiles
  return board.tiles.map((t, i) => ev.lowTideTiles[i] ?? t)
}

/** True when `node` is under water right now (no player may stand there). */
export function isSubmerged(board: BoardDef, tide: TidePhase | undefined, node: number): boolean {
  return board.event?.kind === 'tides' && tide === 'high' && board.event.sandbar.includes(node)
}
