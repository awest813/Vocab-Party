/**
 * CC0 game sprites shipped under /public/assets:
 * - Kenney Board Game Pack (dice, card backs) — https://kenney.nl/assets/boardgame-pack
 * - Kenney Game Icons (tile overlays) — https://kenney.nl/assets/game-icons
 * - Quaternius LowPoly RPG Characters (player pawn crops from albedo textures) —
 *   https://opengameart.org/content/lowpoly-rpg-characters
 * - Board tiles are 64×64 composites (card backs + icons) generated from the above.
 * License copies: public/assets/kenney/*.txt, public/assets/quaternius/*.txt
 */
export const BUNDLED_GAME_ASSETS = {
  quaterniusPlayers: [
    'assets/quaternius/rpg-characters/player_warrior.png',
    'assets/quaternius/rpg-characters/player_wizard.png',
    'assets/quaternius/rpg-characters/player_rogue.png',
    'assets/quaternius/rpg-characters/player_ranger.png',
  ],
  kenneyDiceFaces: [
    'assets/kenney/boardgame/dice/dieWhite1.png',
    'assets/kenney/boardgame/dice/dieWhite2.png',
    'assets/kenney/boardgame/dice/dieWhite3.png',
    'assets/kenney/boardgame/dice/dieWhite4.png',
    'assets/kenney/boardgame/dice/dieWhite5.png',
    'assets/kenney/boardgame/dice/dieWhite6.png',
  ],
  kenneyTile: (type: string) => `assets/kenney/tiles/tile_${type}.png`,
} as const

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
