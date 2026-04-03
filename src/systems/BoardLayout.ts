/** Shared board geometry: path length drives "full map" game duration. */

export const BOARD_COLS = 12
export const BOARD_ROWS = 8

export function buildPath(cols: number, rows: number): { col: number; row: number }[] {
  const path: { col: number; row: number }[] = []
  for (let c = 0; c < cols; c++) path.push({ col: c, row: 0 })
  for (let r = 1; r < rows; r++) path.push({ col: cols - 1, row: r })
  for (let c = cols - 2; c >= 0; c--) path.push({ col: c, row: rows - 1 })
  for (let r = rows - 2; r > 0; r--) path.push({ col: 0, row: r })
  return path
}

export const BOARD_PATH = buildPath(BOARD_COLS, BOARD_ROWS)
export const BOARD_PATH_LENGTH = BOARD_PATH.length
