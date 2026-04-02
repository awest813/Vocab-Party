/**
 * Bundled copies of assets from https://github.com/samme/phaser3-examples-assets
 * (mirrored under /public/assets/phaser-examples for offline play).
 */
export const EXTERNAL_ASSETS = {
  starfield: 'assets/phaser-examples/skies/starfield.png',
  particleYellow: 'assets/phaser-examples/particles/yellow.png',
  particleRed: 'assets/phaser-examples/particles/red.png',
  particleBlue: 'assets/phaser-examples/particles/blue.png',
  particleSquare: 'assets/phaser-examples/particles/square.png',
  gem: 'assets/phaser-examples/sprites/gem.png',
  coinSheet: 'assets/phaser-examples/sprites/coin-16x16x4.png',
  starSmall: 'assets/phaser-examples/demoscene/star.png',
} as const

export const TEXTURE_KEYS = {
  starfield: 'ext_starfield',
  particleYellow: 'ext_particle_yellow',
  particleRed: 'ext_particle_red',
  particleBlue: 'ext_particle_blue',
  particleSquare: 'ext_particle_square',
  gem: 'ext_gem',
  coin: 'ext_coin',
  starSmall: 'ext_star_small',
} as const
