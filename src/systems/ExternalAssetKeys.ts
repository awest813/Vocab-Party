/**
 * CC0 game sprites shipped under /public/assets:
 * - Kenney Board Game Pack (dice, card backs) — https://kenney.nl/assets/boardgame-pack
 * - Kenney Game Icons (tile overlays) — https://kenney.nl/assets/game-icons
 * - Quaternius LowPoly RPG Characters (player pawn crops from albedo textures) —
 *   https://opengameart.org/content/lowpoly-rpg-characters
 * - Board tiles are 64×64 composites (card backs + icons) generated from the above.
 * License copies: public/assets/kenney/*.txt, public/assets/quaternius/*.txt
 */

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
  particleWhite: 'assets/phaser-examples/particles/white.png',
  particleGreen: 'assets/phaser-examples/particles/green.png',
  flame1: 'assets/phaser-examples/particles/flame1.png',
  flame2: 'assets/phaser-examples/particles/flame2.png',
  muzzleflash: 'assets/phaser-examples/particles/muzzleflash3.png',
  gem: 'assets/phaser-examples/sprites/gem.png',
  diamond: 'assets/phaser-examples/sprites/diamond.png',
  orbRed: 'assets/phaser-examples/sprites/orb-red.png',
  orbBlue: 'assets/phaser-examples/sprites/orb-blue.png',
  firstaid: 'assets/phaser-examples/sprites/firstaid.png',
  coinSheet: 'assets/phaser-examples/sprites/coin-16x16x4.png',
  starSmall: 'assets/phaser-examples/demoscene/star.png',
  skySpace3: 'assets/phaser-examples/skies/space3.png',
  skyNebula: 'assets/phaser-examples/skies/nebula.jpg',
  // Kenney game icons
  kenneyStar: 'assets/kenney/game-icons/star.png',
  kenneyTrophy: 'assets/kenney/game-icons/trophy.png',
  kenneyCart: 'assets/kenney/game-icons/cart.png',
  kenneyGamepad: 'assets/kenney/game-icons/gamepad.png',
  kenneyQuestion: 'assets/kenney/game-icons/question.png',
  kenneyHome: 'assets/kenney/game-icons/home.png',
  kenneyReturn: 'assets/kenney/game-icons/return.png',
  // Kenney dice faces
  kenneyDie1: 'assets/kenney/boardgame/dice/dieWhite1.png',
  kenneyDie2: 'assets/kenney/boardgame/dice/dieWhite2.png',
  kenneyDie3: 'assets/kenney/boardgame/dice/dieWhite3.png',
  kenneyDie4: 'assets/kenney/boardgame/dice/dieWhite4.png',
  kenneyDie5: 'assets/kenney/boardgame/dice/dieWhite5.png',
  kenneyDie6: 'assets/kenney/boardgame/dice/dieWhite6.png',
  // Kenney card backs
  kenneyCardRed: 'assets/kenney/boardgame/cards/cardBack_red2.png',
  kenneyCardBlue: 'assets/kenney/boardgame/cards/cardBack_blue2.png',
  kenneyCardGreen: 'assets/kenney/boardgame/cards/cardBack_green2.png',
  // Character sprites (MIT — photonstorm/phaser3-examples)
  charPhaserDude: 'assets/phaser-examples/sprites/phaser-dude.png',
  charMushroom: 'assets/phaser-examples/sprites/mushroom.png',
  charBunny: 'assets/phaser-examples/sprites/bunny.png',
  charMaster: 'assets/phaser-examples/sprites/master.png',
  // Quaternius LowPoly RPG class portraits (CC0)
  charRanger: 'assets/quaternius/rpg-characters/player_ranger.png',
  charRogue: 'assets/quaternius/rpg-characters/player_rogue.png',
  charWarrior: 'assets/quaternius/rpg-characters/player_warrior.png',
  charWizard: 'assets/quaternius/rpg-characters/player_wizard.png',
} as const

export const TEXTURE_KEYS = {
  starfield: 'ext_starfield',
  particleYellow: 'ext_particle_yellow',
  particleRed: 'ext_particle_red',
  particleBlue: 'ext_particle_blue',
  particleSquare: 'ext_particle_square',
  particleWhite: 'ext_particle_white',
  particleGreen: 'ext_particle_green',
  flame1: 'ext_flame1',
  flame2: 'ext_flame2',
  muzzleflash: 'ext_muzzleflash',
  gem: 'ext_gem',
  diamond: 'ext_diamond',
  orbRed: 'ext_orb_red',
  orbBlue: 'ext_orb_blue',
  firstaid: 'ext_firstaid',
  coin: 'ext_coin',
  starSmall: 'ext_star_small',
  skySpace3: 'ext_sky_space3',
  skyNebula: 'ext_sky_nebula',
  // Kenney game icons
  kenneyStar: 'kenney_star',
  kenneyTrophy: 'kenney_trophy',
  kenneyCart: 'kenney_cart',
  kenneyGamepad: 'kenney_gamepad',
  kenneyQuestion: 'kenney_question',
  kenneyHome: 'kenney_home',
  kenneyReturn: 'kenney_return',
  // Kenney dice
  kenneyDie1: 'kenney_die_1',
  kenneyDie2: 'kenney_die_2',
  kenneyDie3: 'kenney_die_3',
  kenneyDie4: 'kenney_die_4',
  kenneyDie5: 'kenney_die_5',
  kenneyDie6: 'kenney_die_6',
  // Kenney card backs
  kenneyCardRed: 'kenney_card_red',
  kenneyCardBlue: 'kenney_card_blue',
  kenneyCardGreen: 'kenney_card_green',
  // Character sprites
  charPhaserDude: 'char_phaser_dude',
  charMushroom: 'char_mushroom',
  charBunny: 'char_bunny',
  charMaster: 'char_master',
  charRanger: 'char_ranger',
  charRogue: 'char_rogue',
  charWarrior: 'char_warrior',
  charWizard: 'char_wizard',
} as const
