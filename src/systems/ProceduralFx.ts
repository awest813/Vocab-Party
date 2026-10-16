import Phaser from 'phaser'
import { TEXTURE_KEYS } from './ExternalAssetKeys'

/**
 * Effect and backdrop textures drawn at boot, so the game ships no third-party art for them:
 * glow particles, flame, sparkle, gems, the spinning coin sheet, and the starfield / nebula skies.
 * Keys match TEXTURE_KEYS, so scenes use them exactly like loaded images.
 */
export function generateFxTextures(scene: Phaser.Scene): void {
  const glow: [string, string][] = [
    [TEXTURE_KEYS.particleYellow, '255,224,102'],
    [TEXTURE_KEYS.particleRed, '255,90,90'],
    [TEXTURE_KEYS.particleBlue, '96,160,255'],
    [TEXTURE_KEYS.particleWhite, '255,255,255'],
    [TEXTURE_KEYS.particleGreen, '96,255,140'],
  ]
  glow.forEach(([key, rgb]) => canvasTexture(scene, key, 128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.18, `rgba(${rgb},1)`)
    g.addColorStop(0.5, `rgba(${rgb},0.35)`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }))

  canvasTexture(scene, TEXTURE_KEYS.particleSquare, 128, 128, ctx => {
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, 16, 16, 96, 96, 18)
    ctx.fill()
  })

  canvasTexture(scene, TEXTURE_KEYS.flame1, 128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 76, 0, 64, 70, 60)
    g.addColorStop(0, 'rgba(255,255,220,1)')
    g.addColorStop(0.25, 'rgba(255,200,60,0.95)')
    g.addColorStop(0.6, 'rgba(255,90,20,0.55)')
    g.addColorStop(1, 'rgba(200,20,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(64, 70, 42, 58, 0, 0, Math.PI * 2)
    ctx.fill()
  })

  canvasTexture(scene, TEXTURE_KEYS.muzzleflash, 128, 128, ctx => {
    ctx.translate(64, 64)
    const rays = 10
    ctx.fillStyle = 'rgba(255,230,150,0.9)'
    ctx.beginPath()
    for (let i = 0; i < rays * 2; i++) {
      const a = (i / (rays * 2)) * Math.PI * 2
      const r = i % 2 === 0 ? 60 : 18
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,200,80,0)')
    ctx.fillStyle = g
    ctx.fillRect(-64, -64, 128, 128)
  })

  canvasTexture(scene, TEXTURE_KEYS.starSmall, 32, 32, ctx => {
    ctx.translate(16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 15 : 4
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  })

  // Board-frame corner ornaments.
  canvasTexture(scene, TEXTURE_KEYS.diamond, 32, 28, ctx => gemShape(ctx, 32, 28, '#7fe8ff', '#2a8fd4'))
  canvasTexture(scene, TEXTURE_KEYS.gem, 40, 88, ctx => gemShape(ctx, 40, 88, '#ff9de0', '#c03a9a'))
  canvasTexture(scene, TEXTURE_KEYS.orbRed, 32, 32, ctx => orb(ctx, '#ff7a7a', '#a51e2e'))
  canvasTexture(scene, TEXTURE_KEYS.orbBlue, 32, 32, ctx => orb(ctx, '#8ec5ff', '#1e4fa5'))
  canvasTexture(scene, TEXTURE_KEYS.firstaid, 32, 32, ctx => {
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, 2, 2, 28, 28, 6)
    ctx.fill()
    ctx.fillStyle = '#e84a4a'
    ctx.fillRect(12, 6, 8, 20)
    ctx.fillRect(6, 12, 20, 8)
  })

  // Four-frame spinning coin (16×16 frames) for coin bursts.
  const coin = canvasTexture(scene, TEXTURE_KEYS.coin, 64, 16, ctx => {
    const spinWidths = [1, 0.65, 0.2, 0.65]
    spinWidths.forEach((sx, i) => {
      ctx.save()
      ctx.translate(i * 16 + 8, 8)
      ctx.scale(Math.max(0.15, sx), 1)
      ctx.fillStyle = '#b8860b'
      ctx.beginPath()
      ctx.arc(0, 0, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffd24a'
      ctx.beginPath()
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillRect(-1.5, -4, 2, 5)
      ctx.restore()
    })
  })
  for (let i = 0; i < 4; i++) coin?.add(i, 0, i * 16, 0, 16, 16)

  // Skies: a starfield and two soft nebula washes (tinted and blended by the scenes).
  canvasTexture(scene, TEXTURE_KEYS.starfield, 512, 512, ctx => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 512, 512)
    const rand = seeded(7)
    for (let i = 0; i < 420; i++) {
      const r = rand() < 0.92 ? 0.6 + rand() * 0.8 : 1.4 + rand() * 1.2
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.65})`
      ctx.beginPath()
      ctx.arc(rand() * 512, rand() * 512, r, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  canvasTexture(scene, TEXTURE_KEYS.skyNebula, 800, 600, ctx => nebula(ctx, 800, 600, 11, 0.5))
  canvasTexture(scene, TEXTURE_KEYS.skySpace3, 800, 600, ctx => {
    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, 800, 600)
    nebula(ctx, 800, 600, 23, 0.35)
  })
}

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const tex = scene.textures.createCanvas(key, w, h)
  if (!tex) return null
  const ctx = tex.getContext()
  ctx.save()
  draw(ctx)
  ctx.restore()
  tex.refresh()
  return tex
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function gemShape(ctx: CanvasRenderingContext2D, w: number, h: number, light: string, dark: string) {
  const top = h * 0.3
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(w * 0.2, 1)
  ctx.lineTo(w * 0.8, 1)
  ctx.lineTo(w - 1, top)
  ctx.lineTo(w / 2, h - 1)
  ctx.lineTo(1, top)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.moveTo(w * 0.25, 2)
  ctx.lineTo(w * 0.75, 2)
  ctx.lineTo(w * 0.85, top)
  ctx.lineTo(w / 2, h * 0.8)
  ctx.lineTo(w * 0.15, top)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillRect(w * 0.3, 3, w * 0.15, top - 4)
}

function orb(ctx: CanvasRenderingContext2D, light: string, dark: string) {
  const g = ctx.createRadialGradient(12, 11, 2, 16, 16, 15)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.25, light)
  g.addColorStop(1, dark)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(16, 16, 14, 0, Math.PI * 2)
  ctx.fill()
}

function nebula(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, strength: number) {
  const rand = seeded(seed)
  const hues = ['120,200,255', '200,140,255', '90,230,200', '255,150,200']
  for (let i = 0; i < 9; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = 120 + rand() * 260
    const rgb = hues[Math.floor(rand() * hues.length)]
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb},${strength})`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

/** Small deterministic PRNG so the skies look the same every load. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
