/**
 * CC0 game sprites shipped under /public/assets:
 * - Kenney Board Game Pack (dice, card backs) — https://kenney.nl/assets/boardgame-pack
 * - Kenney Game Icons (tile overlays) — https://kenney.nl/assets/game-icons
 * - Quaternius LowPoly RPG Characters (player pawn crops from albedo textures) —
 *   https://opengameart.org/content/lowpoly-rpg-characters
 * - Board tiles, tokens and dice are generated procedurally (SpriteFactory).
 * License copies: public/assets/kenney/*.txt, public/assets/quaternius/*.txt
 */

/**
 * Image files loaded at boot. Effect, sky and coin textures (particles, flames, gems, starfield,
 * nebula) are drawn in code by ProceduralFx under the matching TEXTURE_KEYS.
 */
export const EXTERNAL_ASSETS = {
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
  kenneyCardHearts: 'assets/kenney/boardgame/cards/cardHeartsA.png',
  kenneyCardClubs: 'assets/kenney/boardgame/cards/cardClubsA.png',
  kenneyCardDiamonds: 'assets/kenney/boardgame/cards/cardDiamondsA.png',
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
  kenneyCardHearts: 'kenney_card_hearts',
  kenneyCardClubs: 'kenney_card_clubs',
  kenneyCardDiamonds: 'kenney_card_diamonds',
  // Character sprites
  charRanger: 'char_ranger',
  charRogue: 'char_rogue',
  charWarrior: 'char_warrior',
  charWizard: 'char_wizard',
} as const
