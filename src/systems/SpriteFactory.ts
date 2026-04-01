import Phaser from 'phaser'

// Texture key constants — swap any key's source in PreloadScene for a real PNG asset
export const PLAYER_TEXTURE_KEYS = ['player_0', 'player_1', 'player_2', 'player_3'] as const
export const DICE_TEXTURE_KEYS = ['dice_1', 'dice_2', 'dice_3', 'dice_4', 'dice_5', 'dice_6'] as const
export const TILE_TEXTURE_KEY = (type: string) => `tile_${type}`

const PLAYER_COLORS = [0xff4444, 0x4488ff, 0x44dd44, 0xffcc00]

const TILE_COLORS: Record<string, number> = {
  vocab:    0x4488ff,
  grammar:  0xff8844,
  bonus:    0xffdd00,
  mystery:  0xaa44ff,
  minigame: 0xff44aa,
  swap:     0x44ffaa,
  start:    0x22cc44,
}

const DICE_DOT_POSITIONS: { x: number; y: number }[][] = [
  [{ x: 24, y: 24 }],
  [{ x: 14, y: 14 }, { x: 34, y: 34 }],
  [{ x: 14, y: 14 }, { x: 24, y: 24 }, { x: 34, y: 34 }],
  [{ x: 14, y: 14 }, { x: 34, y: 14 }, { x: 14, y: 34 }, { x: 34, y: 34 }],
  [{ x: 14, y: 14 }, { x: 34, y: 14 }, { x: 24, y: 24 }, { x: 14, y: 34 }, { x: 34, y: 34 }],
  [{ x: 14, y: 12 }, { x: 34, y: 12 }, { x: 14, y: 24 }, { x: 34, y: 24 }, { x: 14, y: 36 }, { x: 34, y: 36 }],
]

/**
 * Generates all game sprite textures procedurally and stores them in Phaser's
 * TextureManager under stable key names.  Once real artwork is available,
 * replace individual entries in PreloadScene with `this.load.image(key, path)`
 * and remove the corresponding call here — the rest of the game code stays
 * unchanged because it references only the key strings.
 */
export function generateGameTextures(scene: Phaser.Scene): void {
  generatePlayerTextures(scene)
  generateTileTextures(scene)
  generateDiceTextures(scene)
}

// ---------------------------------------------------------------------------
// Player token textures  (32 × 32)
// ---------------------------------------------------------------------------
function generatePlayerTextures(scene: Phaser.Scene): void {
  const SIZE = 32
  const RADIUS = SIZE / 2 - 2

  PLAYER_COLORS.forEach((color, i) => {
    const key = PLAYER_TEXTURE_KEYS[i]
    if (scene.textures.exists(key)) return   // already generated

    const g = scene.add.graphics()

    // Soft shadow ring
    g.fillStyle(0x000000, 0.25)
    g.fillCircle(SIZE / 2 + 1, SIZE / 2 + 2, RADIUS)

    // Main body
    g.fillStyle(color, 1)
    g.fillCircle(SIZE / 2, SIZE / 2, RADIUS)

    // Inner highlight (top-left quadrant)
    g.fillStyle(0xffffff, 0.35)
    g.fillCircle(SIZE / 2 - 5, SIZE / 2 - 5, 7)

    // White border
    g.lineStyle(2, 0xffffff, 1)
    g.strokeCircle(SIZE / 2, SIZE / 2, RADIUS)

    g.generateTexture(key, SIZE, SIZE)
    g.destroy()
  })
}

// ---------------------------------------------------------------------------
// Board tile textures  (52 × 52)
// ---------------------------------------------------------------------------
function generateTileTextures(scene: Phaser.Scene): void {
  const SIZE = 52
  const CORNER = 7

  Object.entries(TILE_COLORS).forEach(([type, color]) => {
    const key = TILE_TEXTURE_KEY(type)
    if (scene.textures.exists(key)) return

    const g = scene.add.graphics()

    // Base fill
    g.fillStyle(color, 1)
    g.fillRoundedRect(0, 0, SIZE, SIZE, CORNER)

    // Top-half highlight (gives a subtle 3-D look)
    g.fillStyle(0xffffff, 0.22)
    g.fillRoundedRect(2, 2, SIZE - 4, SIZE / 2 - 2, CORNER)

    // White border
    g.lineStyle(2, 0xffffff, 0.85)
    g.strokeRoundedRect(1, 1, SIZE - 2, SIZE - 2, CORNER)

    g.generateTexture(key, SIZE, SIZE)
    g.destroy()
  })
}

// ---------------------------------------------------------------------------
// Dice face textures  (48 × 48)
// ---------------------------------------------------------------------------
function generateDiceTextures(scene: Phaser.Scene): void {
  const SIZE = 48
  const CORNER = 9

  for (let face = 1; face <= 6; face++) {
    const key = DICE_TEXTURE_KEYS[face - 1]
    if (scene.textures.exists(key)) continue

    const g = scene.add.graphics()

    // Drop shadow
    g.fillStyle(0x000000, 0.2)
    g.fillRoundedRect(3, 4, SIZE - 4, SIZE - 4, CORNER)

    // White die face
    g.fillStyle(0xffffff, 1)
    g.fillRoundedRect(1, 1, SIZE - 4, SIZE - 4, CORNER)

    // Border
    g.lineStyle(1.5, 0xaaaaaa, 0.8)
    g.strokeRoundedRect(1, 1, SIZE - 4, SIZE - 4, CORNER)

    // Pips
    g.fillStyle(0x222233, 1)
    DICE_DOT_POSITIONS[face - 1].forEach(({ x, y }) => {
      g.fillCircle(x, y, 3.5)
    })

    g.generateTexture(key, SIZE, SIZE)
    g.destroy()
  }
}
