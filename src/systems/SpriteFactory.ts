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
  shop:     0xc45c26,
  star:     0x6b2d8b,
  brick:    0xcc5533,
}

/** Tile types with bundled PNGs in PreloadScene (Kenney composites). */
export const BOARD_TILE_TYPES = Object.keys(TILE_COLORS) as (keyof typeof TILE_COLORS)[]

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
// Board tile textures  (52 × 52) — type-specific motifs + glossy finish
// ---------------------------------------------------------------------------
function drawTileMotif(g: Phaser.GameObjects.Graphics, type: string, cx: number, cy: number): void {
  const s = 52
  switch (type) {
    case 'vocab': {
      g.fillStyle(0xffffff, 0.35)
      g.fillRoundedRect(cx - 10, cy - 8, 9, 14, 2)
      g.fillRoundedRect(cx + 1, cy - 8, 9, 14, 2)
      g.lineStyle(1.2, 0x2244aa, 0.5)
      g.strokeLineShape(new Phaser.Geom.Line(cx - 8, cy + 2, cx - 3, cy + 2))
      g.strokeLineShape(new Phaser.Geom.Line(cx + 3, cy + 2, cx + 8, cy + 2))
      break
    }
    case 'grammar': {
      g.lineStyle(2.5, 0xffffff, 0.55)
      const tipX = cx + 10
      const tipY = cy + 8
      g.beginPath()
      g.moveTo(cx - 10, cy - 6)
      g.lineTo(tipX, tipY)
      g.strokePath()
      g.fillStyle(0xffaa66, 0.9)
      g.fillTriangle(tipX, tipY, tipX - 4, tipY - 2, tipX - 2, tipY + 4)
      break
    }
    case 'bonus': {
      g.fillStyle(0xffffff, 0.9)
      const r = 7
      for (let i = 0; i < 5; i++) {
        const a = (i * (Math.PI * 2)) / 5 - Math.PI / 2
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        if (i === 0) g.beginPath()
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
      }
      g.closePath()
      g.fillPath()
      g.fillStyle(0xffee88, 0.85)
      g.fillCircle(cx, cy, 3)
      break
    }
    case 'mystery': {
      g.fillStyle(0xffffff, 0.5)
      g.fillCircle(cx, cy - 2, 9)
      g.fillStyle(0x440066, 0.35)
      g.fillRect(cx - 2, cy + 2, 4, 7)
      g.fillCircle(cx - 5, cy - 6, 2)
      g.fillCircle(cx + 5, cy - 6, 2)
      break
    }
    case 'minigame': {
      g.fillStyle(0xffffff, 0.25)
      g.fillRoundedRect(cx - 12, cy - 8, 24, 16, 3)
      g.fillStyle(0xffffff, 0.7)
      g.fillCircle(cx - 6, cy + 2, 2.5)
      g.fillCircle(cx + 6, cy + 2, 2.5)
      g.lineStyle(1.5, 0xffffff, 0.4)
      g.strokeRoundedRect(cx - 12, cy - 8, 24, 16, 3)
      break
    }
    case 'swap': {
      g.lineStyle(2.2, 0xffffff, 0.65)
      g.beginPath()
      g.moveTo(cx - 10, cy - 4)
      g.lineTo(cx + 2, cy - 4)
      g.lineTo(cx + 2, cy - 8)
      g.lineTo(cx + 8, cy - 2)
      g.lineTo(cx + 2, cy + 4)
      g.lineTo(cx + 2, cy)
      g.lineTo(cx - 10, cy)
      g.closePath()
      g.strokePath()
      g.beginPath()
      g.moveTo(cx + 10, cy + 4)
      g.lineTo(cx - 2, cy + 4)
      g.lineTo(cx - 2, cy + 8)
      g.lineTo(cx - 8, cy + 2)
      g.lineTo(cx - 2, cy - 4)
      g.lineTo(cx - 2, cy)
      g.lineTo(cx + 10, cy)
      g.closePath()
      g.strokePath()
      break
    }
    case 'start': {
      g.fillStyle(0xffffff, 0.45)
      g.beginPath()
      g.moveTo(cx, cy - 10)
      g.lineTo(cx + 12, cy + 2)
      g.lineTo(cx + 8, cy + 2)
      g.lineTo(cx + 8, cy + 10)
      g.lineTo(cx - 8, cy + 10)
      g.lineTo(cx - 8, cy + 2)
      g.lineTo(cx - 12, cy + 2)
      g.closePath()
      g.fillPath()
      g.lineStyle(1.5, 0x116622, 0.6)
      g.strokePath()
      break
    }
    case 'shop': {
      g.fillStyle(0xffffff, 0.5)
      g.fillRoundedRect(cx - 12, cy - 6, 24, 18, 2)
      g.fillStyle(0x2244aa, 0.85)
      g.fillRoundedRect(cx - 8, cy - 2, 6, 8, 1)
      g.fillRoundedRect(cx + 2, cy - 2, 6, 8, 1)
      g.fillStyle(0xaa3333, 0.9)
      g.beginPath()
      g.moveTo(cx - 12, cy - 6)
      g.lineTo(cx, cy - 14)
      g.lineTo(cx + 12, cy - 6)
      g.closePath()
      g.fillPath()
      break
    }
    case 'star': {
      const spikes = 5
      const ro = 10
      const ri = 4
      g.fillStyle(0xffee66, 0.95)
      g.beginPath()
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i * Math.PI) / spikes - Math.PI / 2
        const r = i % 2 === 0 ? ro : ri
        const px = cx + Math.cos(a) * r
        const py = cy + Math.sin(a) * r
        i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)
      }
      g.closePath()
      g.fillPath()
      break
    }
    case 'brick': {
      g.fillStyle(0xdd6644, 0.95)
      g.fillRect(cx - 12, cy - 4, 10, 6)
      g.fillRect(cx - 1, cy - 4, 10, 6)
      g.fillRect(cx - 12, cy + 4, 10, 6)
      g.fillRect(cx - 1, cy + 4, 10, 6)
      g.lineStyle(1, 0x442211, 0.5)
      g.strokeRect(cx - 12, cy - 4, 10, 6)
      g.strokeRect(cx - 1, cy - 4, 10, 6)
      g.strokeRect(cx - 12, cy + 4, 10, 6)
      g.strokeRect(cx - 1, cy + 4, 10, 6)
      break
    }
    default:
      break
  }
}

function generateTileTextures(scene: Phaser.Scene): void {
  const SIZE = 52
  const CORNER = 8

  Object.entries(TILE_COLORS).forEach(([type, color]) => {
    const key = TILE_TEXTURE_KEY(type)
    if (scene.textures.exists(key)) return

    const g = scene.add.graphics()
    const darker = Phaser.Display.Color.IntegerToColor(color)
    darker.darken(28)
    const darkInt = darker.color

    // Soft outer shadow
    g.fillStyle(0x000000, 0.18)
    g.fillRoundedRect(2, 3, SIZE - 2, SIZE - 2, CORNER)

    // Base + vertical gradient band (richer than flat fill)
    g.fillStyle(darkInt, 1)
    g.fillRoundedRect(0, 0, SIZE, SIZE, CORNER)
    g.fillStyle(color, 1)
    g.fillRoundedRect(1, 1, SIZE - 2, (SIZE - 2) * 0.55, CORNER - 1)

    // Inner vignette
    g.fillStyle(0x000000, 0.12)
    g.fillRoundedRect(3, SIZE * 0.45, SIZE - 6, SIZE * 0.48, CORNER - 2)

    drawTileMotif(g, type, SIZE / 2, SIZE / 2 + 2)

    // Specular shine
    g.fillStyle(0xffffff, 0.2)
    g.fillEllipse(SIZE * 0.35, SIZE * 0.28, SIZE * 0.42, SIZE * 0.22)

    // Rim light
    g.lineStyle(2.5, 0xffffff, 0.55)
    g.strokeRoundedRect(1.5, 1.5, SIZE - 3, SIZE - 3, CORNER - 1)
    g.lineStyle(1, 0x000000, 0.15)
    g.strokeRoundedRect(2.5, 2.5, SIZE - 5, SIZE - 5, CORNER - 2)

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
