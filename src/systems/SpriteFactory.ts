import Phaser from 'phaser'
import { TEXTURE_KEYS } from './ExternalAssetKeys'
import { COLORS } from '../ui/Theme'

// Texture key constants — swap any key's source in PreloadScene for a real PNG asset
export const PLAYER_TEXTURE_KEYS = [
  'player_0', 'player_1', 'player_2', 'player_3',
  'player_4', 'player_5', 'player_6', 'player_7',
] as const
export const DICE_TEXTURE_KEYS = ['dice_1', 'dice_2', 'dice_3', 'dice_4', 'dice_5', 'dice_6'] as const
export const TILE_TEXTURE_KEY = (type: string) => `tile_${type}`

export type CharacterClass =
  | 'party' | 'wizard' | 'knight' | 'ninja'
  | 'ranger' | 'pirate' | 'robot' | 'princess'

export interface CharacterDef {
  cls: CharacterClass
  color: number
  name: string
  /** Optional Quaternius / sprite portrait key from TEXTURE_KEYS */
  portraitKey?: string
  /** Compact HUD / status glyph for this character. */
  emoji: string
}

/** Indexed roster of selectable party characters. */
export const CHARACTER_DEFS: CharacterDef[] = [
  { cls: 'party',    color: COLORS.player[0], name: 'Party Ace',     emoji: '🎉', portraitKey: TEXTURE_KEYS.charWarrior },
  { cls: 'wizard',   color: COLORS.player[1], name: 'Blue Wizard',   emoji: '🧙', portraitKey: TEXTURE_KEYS.charWizard },
  { cls: 'knight',   color: COLORS.player[2], name: 'Green Knight',  emoji: '🛡️', portraitKey: TEXTURE_KEYS.charRanger },
  { cls: 'pirate',   color: COLORS.player[3], name: 'Gold Pirate',   emoji: '🏴‍☠️', portraitKey: TEXTURE_KEYS.charRogue },
  { cls: 'ninja',    color: 0x6a7fa8, name: 'Shadow Ninja', emoji: '🥷' },
  { cls: 'ranger',   color: 0x88aa44, name: 'Forest Ranger', emoji: '🏹', portraitKey: TEXTURE_KEYS.charRanger },
  { cls: 'robot',    color: 0xa8b4c4, name: 'Steel Robot', emoji: '🤖' },
  { cls: 'princess', color: 0xff88cc, name: 'Pink Princess', emoji: '👑' },
]

export function characterTextureKey(index: number): string {
  const i = ((index % PLAYER_TEXTURE_KEYS.length) + PLAYER_TEXTURE_KEYS.length) % PLAYER_TEXTURE_KEYS.length
  return PLAYER_TEXTURE_KEYS[i]
}

export function characterDef(index: number): CharacterDef {
  const i = ((index % CHARACTER_DEFS.length) + CHARACTER_DEFS.length) % CHARACTER_DEFS.length
  return CHARACTER_DEFS[i]
}

/** Short label for tight UI rows (Ace, Wizard, Knight, …). */
export function characterShortName(index: number): string {
  const parts = characterDef(index).name.trim().split(/\s+/)
  return parts[parts.length - 1] || characterDef(index).name
}

/** Must stay aligned with GameState.CHARACTER_COUNT. */
export const CHARACTER_COUNT = CHARACTER_DEFS.length

export const TILE_COLORS: Record<string, number> = {
  vocab:     0x3d8fff,
  grammar:   0xff9f1c,
  bonus:     0xf4c430,
  mystery:   0xb45cff,
  minigame:  0xff5cad,
  swap:      0x2ec4b6,
  start:     0x2ad46a,
  shop:      0xe07a3d,
  star:      0x8b5cf6,
  brick:     0xd4643a,
  item_shop: 0x4ec9f5,
  penalty:   0xe84a4a,
}

/** Tile types with textures generated at boot. */
export const BOARD_TILE_TYPES = Object.keys(TILE_COLORS) as (keyof typeof TILE_COLORS)[]

const DICE_DOT_POSITIONS: { x: number; y: number }[][] = [
  [{ x: 32, y: 32 }],
  [{ x: 18, y: 18 }, { x: 46, y: 46 }],
  [{ x: 18, y: 18 }, { x: 32, y: 32 }, { x: 46, y: 46 }],
  [{ x: 18, y: 18 }, { x: 46, y: 18 }, { x: 18, y: 46 }, { x: 46, y: 46 }],
  [{ x: 18, y: 18 }, { x: 46, y: 18 }, { x: 32, y: 32 }, { x: 18, y: 46 }, { x: 46, y: 46 }],
  [{ x: 18, y: 16 }, { x: 46, y: 16 }, { x: 18, y: 32 }, { x: 46, y: 32 }, { x: 18, y: 48 }, { x: 46, y: 48 }],
]

// ---------------------------------------------------------------------------
// Player / character token textures (64 × 72) — party pawn with pedestal
// ---------------------------------------------------------------------------

const TOKEN_W = 64
const TOKEN_H = 84
const CX = TOKEN_W / 2
const CY = 36

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color)
  if (amount < 0) c.darken(Math.abs(amount))
  else c.lighten(amount)
  return c.color
}

function drawTokenPedestal(g: Phaser.GameObjects.Graphics, color: number): void {
  // Soft ground shadow
  g.fillStyle(0x000000, 0.28)
  g.fillEllipse(CX + 1, TOKEN_H - 12, 42, 12)

  // Pedestal ring
  g.fillStyle(shade(color, -35), 1)
  g.fillEllipse(CX, TOKEN_H - 16, 40, 14)
  g.fillStyle(color, 1)
  g.fillEllipse(CX, TOKEN_H - 18, 36, 11)
  g.fillStyle(0xffffff, 0.25)
  g.fillEllipse(CX - 4, TOKEN_H - 20, 16, 5)
}

function drawChibiBody(g: Phaser.GameObjects.Graphics, color: number): void {
  const r = 20

  // Outer glow
  g.fillStyle(0xffffff, 0.12)
  g.fillCircle(CX, CY, r + 5)

  // Body shadow
  g.fillStyle(0x000000, 0.22)
  g.fillCircle(CX + 1.5, CY + 2.5, r)

  // Main sphere
  g.fillStyle(color, 1)
  g.fillCircle(CX, CY, r)

  // Bottom shade
  g.fillStyle(shade(color, -28), 0.55)
  g.fillEllipse(CX, CY + 8, r * 1.6, r * 0.9)

  // Top gloss
  g.fillStyle(0xffffff, 0.38)
  g.fillEllipse(CX - 5, CY - 7, 16, 11)

  // Rim
  g.lineStyle(3, 0xffffff, 0.95)
  g.strokeCircle(CX, CY, r)
  g.lineStyle(2, shade(color, -40), 0.35)
  g.strokeCircle(CX, CY, r - 3)
}

function drawChibiFace(
  g: Phaser.GameObjects.Graphics,
  opts: { eyeColor?: number; mouth?: 'smile' | 'flat' | 'grin'; blush?: boolean } = {}
): void {
  const { eyeColor = 0x1a1a22, mouth = 'smile', blush = true } = opts

  // Eyes
  g.fillStyle(0xffffff, 1)
  g.fillCircle(CX - 7, CY - 1, 5.2)
  g.fillCircle(CX + 7, CY - 1, 5.2)
  g.fillStyle(eyeColor, 1)
  g.fillCircle(CX - 6.5, CY - 0.5, 2.8)
  g.fillCircle(CX + 7.5, CY - 0.5, 2.8)
  g.fillStyle(0xffffff, 0.95)
  g.fillCircle(CX - 8, CY - 2.5, 1.4)
  g.fillCircle(CX + 6, CY - 2.5, 1.4)

  // Mouth
  g.lineStyle(2.2, 0x2a1a1a, 0.75)
  g.beginPath()
  if (mouth === 'smile') g.arc(CX, CY + 6, 5.5, 0.15, Math.PI - 0.15, false)
  else if (mouth === 'grin') g.arc(CX, CY + 5, 7, 0.05, Math.PI - 0.05, false)
  else {
    g.moveTo(CX - 4, CY + 8)
    g.lineTo(CX + 4, CY + 8)
  }
  g.strokePath()

  if (blush) {
    g.fillStyle(0xff7a8a, 0.35)
    g.fillEllipse(CX - 12, CY + 5, 7, 4)
    g.fillEllipse(CX + 12, CY + 5, 7, 4)
  }
}

function drawPartyHat(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffd24a, 1)
  g.fillTriangle(CX - 10, CY - 18, CX + 10, CY - 18, CX, CY - 34)
  g.fillStyle(0xff5c5c, 1)
  g.fillCircle(CX, CY - 34, 3.5)
  g.fillStyle(0xffffff, 0.5)
  g.fillCircle(CX - 1, CY - 35, 1.2)
}

function drawWizardHat(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x1e2a6a, 1)
  g.fillEllipse(CX, CY - 18, 34, 8)
  g.fillTriangle(CX - 11, CY - 18, CX + 11, CY - 18, CX + 2, CY - 38)
  g.fillStyle(0xffe566, 1)
  g.fillCircle(CX, CY - 26, 2.4)
  g.fillStyle(0xffffff, 0.35)
  g.fillTriangle(CX - 4, CY - 22, CX + 2, CY - 22, CX + 1, CY - 34)
}

function drawKnightHelm(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xd0d6de, 1)
  g.fillCircle(CX, CY - 16, 13)
  g.fillRect(CX - 13, CY - 18, 26, 8)
  g.fillStyle(0xe84a4a, 1)
  g.fillTriangle(CX - 3, CY - 26, CX + 3, CY - 26, CX, CY - 38)
  g.fillStyle(0x1a1a22, 0.55)
  g.fillRect(CX - 9, CY - 14, 18, 2.5)
  g.fillStyle(0xffffff, 0.35)
  g.fillEllipse(CX - 4, CY - 20, 8, 4)
}

function drawNinjaMask(g: Phaser.GameObjects.Graphics): void {
  // Face wrap below the eyes, headband above them — the eyes stay visible.
  g.fillStyle(0x151820, 0.95)
  g.fillRoundedRect(CX - 17, CY + 3, 34, 12, 5)
  g.fillStyle(0xe84a4a, 1)
  g.fillRoundedRect(CX - 19, CY - 14, 38, 6, 3)
  g.fillTriangle(CX + 17, CY - 13, CX + 29, CY - 19, CX + 27, CY - 8)
  g.fillTriangle(CX + 17, CY - 11, CX + 28, CY - 4, CX + 23, CY + 1)
  g.fillStyle(0xffffff, 0.35)
  g.fillRoundedRect(CX - 15, CY - 13, 20, 2, 1)
}

function drawPirateHat(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x1a1a28, 1)
  g.beginPath()
  g.moveTo(CX - 18, CY - 16)
  g.lineTo(CX + 18, CY - 16)
  g.lineTo(CX + 14, CY - 30)
  g.lineTo(CX, CY - 24)
  g.lineTo(CX - 14, CY - 30)
  g.closePath()
  g.fillPath()
  g.fillStyle(0xffffff, 0.95)
  g.fillCircle(CX, CY - 22, 3.2)
  g.fillStyle(0x000000, 1)
  g.fillCircle(CX - 1.2, CY - 22, 0.9)
  g.fillCircle(CX + 1.2, CY - 22, 0.9)
  g.fillStyle(0x111111, 0.95)
  g.fillCircle(CX - 7, CY - 1, 4.5)
  g.lineStyle(1.8, 0x111111, 0.95)
  g.strokeLineShape(new Phaser.Geom.Line(CX - 14, CY - 6, CX - 2, CY - 8))
}

/** Hood back sits behind the head so the face stays readable. */
function drawRangerHoodBack(g: Phaser.GameObjects.Graphics, color: number): void {
  g.fillStyle(shade(color, -45), 1)
  g.fillCircle(CX, CY - 3, 24)
  g.fillTriangle(CX - 6, CY - 22, CX + 6, CY - 22, CX + 2, CY - 36)
}

function drawRangerHood(g: Phaser.GameObjects.Graphics, color: number): void {
  // Hood brim framing the forehead, plus a feather.
  g.fillStyle(shade(color, -25), 1)
  g.slice(CX, CY - 2, 21, Math.PI * 1.08, Math.PI * 1.92, false)
  g.fillPath()
  g.fillStyle(0xffffff, 0.25)
  g.fillEllipse(CX - 6, CY - 17, 10, 4)
  g.fillStyle(0xe8d070, 1)
  g.fillTriangle(CX + 12, CY - 16, CX + 26, CY - 30, CX + 20, CY - 12)
}

function drawRobotAntenna(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x6a7688, 1)
  g.fillRoundedRect(CX - 14, CY - 22, 28, 6, 2)
  g.fillStyle(0x333844, 1)
  g.fillCircle(CX - 10, CY - 19, 1.4)
  g.fillCircle(CX + 10, CY - 19, 1.4)
  g.lineStyle(2.5, 0x556070, 1)
  g.strokeLineShape(new Phaser.Geom.Line(CX, CY - 22, CX, CY - 34))
  g.fillStyle(0xff4455, 1)
  g.fillCircle(CX, CY - 36, 3.5)
  g.fillStyle(0xffffff, 0.65)
  g.fillCircle(CX - 1, CY - 37, 1.2)
}

function drawPrincessTiara(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffd24a, 1)
  g.fillRoundedRect(CX - 14, CY - 22, 28, 5, 2)
  g.fillStyle(0xff5cad, 1)
  g.fillTriangle(CX - 5, CY - 22, CX + 5, CY - 22, CX, CY - 34)
  g.fillStyle(0x5ec8ff, 1)
  g.fillCircle(CX - 10, CY - 22, 2)
  g.fillCircle(CX + 10, CY - 22, 2)
  g.fillStyle(0xffffff, 0.65)
  g.fillCircle(CX, CY - 28, 1.4)
}

function drawAccessoryForClass(g: Phaser.GameObjects.Graphics, cls: CharacterClass, color: number): void {
  switch (cls) {
    case 'party': return drawPartyHat(g)
    case 'wizard': return drawWizardHat(g)
    case 'knight': return drawKnightHelm(g)
    case 'ninja': return drawNinjaMask(g)
    case 'pirate': return drawPirateHat(g)
    case 'ranger': return drawRangerHood(g, color)
    case 'robot': return drawRobotAntenna(g)
    case 'princess': return drawPrincessTiara(g)
  }
}

function tryPortraitToken(scene: Phaser.Scene, key: string, def: CharacterDef): boolean {
  if (!def.portraitKey || !scene.textures.exists(def.portraitKey)) return false

  const rt = scene.make.renderTexture({ width: TOKEN_W, height: TOKEN_H }, false)
  const g = scene.make.graphics({ x: 0, y: 0 }, false)

  drawTokenPedestal(g, def.color)
  // Colored disc behind portrait
  g.fillStyle(def.color, 1)
  g.fillCircle(CX, CY, 22)
  g.lineStyle(3, 0xffffff, 0.95)
  g.strokeCircle(CX, CY, 22)
  rt.draw(g, 0, 0)

  const portrait = scene.make.image({ x: CX, y: CY, key: def.portraitKey }, false)
  const maxDim = Math.max(portrait.width, portrait.height) || 64
  const scale = 38 / maxDim
  portrait.setScale(scale)
  // Soft circular crop via mask
  const maskG = scene.make.graphics({ x: 0, y: 0 }, false)
  maskG.fillStyle(0xffffff)
  maskG.fillCircle(CX, CY, 18)
  const mask = maskG.createGeometryMask()
  portrait.setMask(mask)
  rt.draw(portrait, CX - (portrait.displayWidth / 2), CY - (portrait.displayHeight / 2))

  // Accent rim on top
  const rim = scene.make.graphics({ x: 0, y: 0 }, false)
  rim.lineStyle(3, 0xffffff, 0.9)
  rim.strokeCircle(CX, CY, 20)
  rim.lineStyle(2.5, def.color, 1)
  rim.strokeCircle(CX, CY, 22)
  rt.draw(rim, 0, 0)

  rt.saveTexture(key)
  rt.destroy()
  g.destroy()
  portrait.destroy()
  maskG.destroy()
  rim.destroy()
  return true
}

function generateCharacterTexture(scene: Phaser.Scene, key: string, def: CharacterDef): void {
  if (scene.textures.exists(key)) scene.textures.remove(key)

  // Prefer clear procedural pawns; portraits are muddy albedo crops at token size.
  // Keep portrait path available but default to chibi for board readability.
  const usePortrait = false
  if (usePortrait && tryPortraitToken(scene, key, def)) return

  const g = scene.add.graphics()
  drawTokenPedestal(g, def.color)
  if (def.cls === 'ranger') drawRangerHoodBack(g, def.color)
  drawChibiBody(g, def.color)
  drawChibiFace(g, {
    eyeColor: def.cls === 'robot' ? 0xff3344 : 0x1a1a22,
    mouth: def.cls === 'pirate' ? 'grin' : 'smile',
    blush: def.cls !== 'ninja' && def.cls !== 'robot',
  })
  drawAccessoryForClass(g, def.cls, def.color)
  g.generateTexture(key, TOKEN_W, TOKEN_H)
  g.destroy()
}

export function generatePlayerTextures(scene: Phaser.Scene): void {
  CHARACTER_DEFS.forEach((def, i) => {
    generateCharacterTexture(scene, PLAYER_TEXTURE_KEYS[i], def)
  })
}

// ---------------------------------------------------------------------------
// Board tile textures (64 × 64) — chunky bevels; the board adds an emoji glyph on top
// ---------------------------------------------------------------------------

function drawTileBevelBase(g: Phaser.GameObjects.Graphics, color: number, SIZE: number, CORNER: number): void {
  const dark = shade(color, -32)
  const mid = shade(color, -14)

  g.fillStyle(0x000000, 0.28)
  g.fillRoundedRect(4, 6, SIZE - 6, SIZE - 6, CORNER)
  g.fillStyle(dark, 1)
  g.fillRoundedRect(1, 5, SIZE - 2, SIZE - 5, CORNER)
  g.fillStyle(mid, 1)
  g.fillRoundedRect(2, 3, SIZE - 4, SIZE - 6, CORNER - 1)
  g.fillStyle(color, 1)
  g.fillRoundedRect(2, 1, SIZE - 4, SIZE - 8, CORNER - 1)
  g.lineStyle(0.8, 0xffffff, 0.07)
  for (let i = -SIZE; i < SIZE * 2; i += 10) {
    g.strokeLineShape(new Phaser.Geom.Line(i, 2, i + SIZE, SIZE - 6))
    g.strokeLineShape(new Phaser.Geom.Line(i, SIZE - 6, i + SIZE, 2))
  }
  g.fillStyle(0xffffff, 0.18)
  g.fillRoundedRect(5, 4, SIZE - 10, 14, { tl: 8, tr: 8, bl: 3, br: 3 })
}

function drawTileFinish(g: Phaser.GameObjects.Graphics, color: number, SIZE: number, CORNER: number): void {
  const dark = shade(color, -32)
  g.fillStyle(0xffffff, 0.16)
  g.fillEllipse(SIZE * 0.34, SIZE * 0.28, SIZE * 0.38, SIZE * 0.16)
  g.lineStyle(2.5, 0xffffff, 0.55)
  g.strokeRoundedRect(3, 2, SIZE - 6, SIZE - 8, CORNER - 2)
  g.lineStyle(1.5, dark, 0.35)
  g.strokeRoundedRect(5, 4, SIZE - 10, SIZE - 12, CORNER - 3)
}

function generateProceduralTile(scene: Phaser.Scene, color: number, key: string): void {
  const SIZE = 64
  const CORNER = 12
  const g = scene.add.graphics()
  drawTileBevelBase(g, color, SIZE, CORNER)
  g.fillStyle(shade(color, -30), 0.45)
  g.fillCircle(SIZE / 2, SIZE / 2 - 1, 19)
  g.fillStyle(0xffffff, 0.12)
  g.fillCircle(SIZE / 2, SIZE / 2 - 3, 17)
  drawTileFinish(g, color, SIZE, CORNER)
  g.generateTexture(key, SIZE + 2, SIZE + 4)
  g.destroy()
}

export function generateTileTextures(scene: Phaser.Scene): void {
  Object.entries(TILE_COLORS).forEach(([type, color]) => {
    const key = TILE_TEXTURE_KEY(type)
    if (scene.textures.exists(key)) scene.textures.remove(key)

    // The board draws an emoji glyph on every tile, so the texture is a clean bevel with a
    // soft recessed plate for that glyph. (The square Kenney faces poked out past the rounded
    // corners and doubled up with the glyph.)
    generateProceduralTile(scene, color, key)
  })
}

// ---------------------------------------------------------------------------
// Dice face textures — prefer Kenney white dice (tinted), else procedural
// ---------------------------------------------------------------------------

export function generateDiceTextures(scene: Phaser.Scene): void {
  const SIZE = 64
  const CORNER = 12
  const DIE_COLOR = 0xf04a6a
  const DIE_DARK = 0xb02848

  for (let face = 1; face <= 6; face++) {
    const key = DICE_TEXTURE_KEYS[face - 1]
    if (scene.textures.exists(key)) scene.textures.remove(key)

    const kenneyKey = `kenney_die_${face}`
    if (scene.textures.exists(kenneyKey)) {
      const rt = scene.make.renderTexture({ width: SIZE, height: SIZE }, false)
      const img = scene.make.image({ x: SIZE / 2, y: SIZE / 2, key: kenneyKey }, false)
      img.setDisplaySize(SIZE - 4, SIZE - 4)
      img.setTint(0xffc0d0)
      rt.draw(img)
      // Color wash frame
      const frame = scene.make.graphics({ x: 0, y: 0 }, false)
      frame.lineStyle(4, DIE_COLOR, 0.85)
      frame.strokeRoundedRect(3, 3, SIZE - 6, SIZE - 6, 10)
      rt.draw(frame)
      rt.saveTexture(key)
      rt.destroy()
      img.destroy()
      frame.destroy()
      continue
    }

    const g = scene.add.graphics()
    g.fillStyle(0x000000, 0.28)
    g.fillRoundedRect(5, 6, SIZE - 8, SIZE - 8, CORNER)
    g.fillStyle(DIE_DARK, 1)
    g.fillRoundedRect(2, 4, SIZE - 6, SIZE - 6, CORNER)
    g.fillStyle(DIE_COLOR, 1)
    g.fillRoundedRect(2, 2, SIZE - 6, SIZE - 6, CORNER)
    g.fillStyle(0xffffff, 0.22)
    g.beginPath()
    g.moveTo(6, 6)
    g.lineTo(SIZE - 8, 6)
    g.lineTo(6, SIZE * 0.38)
    g.closePath()
    g.fillPath()
    g.lineStyle(2.5, 0xffd0dc, 0.65)
    g.strokeRoundedRect(3, 3, SIZE - 8, SIZE - 8, CORNER)

    DICE_DOT_POSITIONS[face - 1].forEach(({ x, y }) => {
      g.fillStyle(DIE_DARK, 0.35)
      g.fillCircle(x + 1, y + 1, 5.5)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(x, y, 5)
      g.fillStyle(0xffffff, 0.55)
      g.fillCircle(x - 1.5, y - 1.5, 2.2)
    })

    g.generateTexture(key, SIZE, SIZE)
    g.destroy()
  }
}
