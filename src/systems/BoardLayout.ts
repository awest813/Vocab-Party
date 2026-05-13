export interface BoardNode {
  id: number
  col: number
  row: number
  next: number[]
}

export const BOARD_COLS = 12
export const BOARD_ROWS = 8

export const BOARD_NODES: BoardNode[] = [
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

export const BOARD_PATH_LENGTH = BOARD_NODES.length