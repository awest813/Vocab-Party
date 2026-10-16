import Phaser from 'phaser'
// Self-hosted UI font (no third-party font requests from students' browsers).
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import { initGameFlagsFromLocation } from './systems/gameFlags'
import { installAudioUnlock, Sfx } from './systems/Sfx'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { MenuScene } from './scenes/MenuScene'
import { SetupScene } from './scenes/SetupScene'
import { BoardScene } from './scenes/BoardScene'
import { QuestionScene } from './scenes/QuestionScene'
import { MinigameScene } from './scenes/MinigameScene'
import { ResultsScene } from './scenes/ResultsScene'
import { BattleScene } from './scenes/BattleScene'
import { PauseScene } from './scenes/PauseScene'
import { ArcadeScene } from './scenes/ArcadeScene'
import { BonusStarsScene } from './scenes/BonusStarsScene'
import { WordBookScene } from './scenes/WordBookScene'
import { isTouchPreferred } from './systems/GameSettings'

/**
 * Phones scale the 1280×720 canvas to ~50%, which turns small labels into specks. On touch
 * screens every text style gets a 14px floor (desktop keeps the designed sizes).
 */
const MIN_TOUCH_FONT_PX = 14
if (isTouchPreferred()) {
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text
  }
  const makeText = factory.text
  factory.text = function (x, y, text, style) {
    const size = style?.fontSize !== undefined ? parseFloat(String(style.fontSize)) : NaN
    const fixed = Number.isFinite(size) && size < MIN_TOUCH_FONT_PX ? { ...style, fontSize: `${MIN_TOUCH_FONT_PX}px` } : style
    return makeText.call(this, x, y, text, fixed)
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#070b14',
  scale: {
    // FIT scales the 1280x720 design surface uniformly to fit any window aspect ratio,
    // letterboxing on non-16:9. Game logic always uses 1280x720 internally so menus
    // are deterministic regardless of window shape.
    mode: Phaser.Scale.FIT,
    // #app's flexbox centres the canvas; Phaser's own centring margins would double it up.
    autoCenter: Phaser.Scale.NO_CENTER,
    width: 1280,
    height: 720,
    expandParent: true,
  },
  audio: {
    disableWebAudio: false,
  },
  input: {
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, PreloadScene, MenuScene, SetupScene, BoardScene, QuestionScene, MinigameScene, ResultsScene, BattleScene, PauseScene, ArcadeScene, BonusStarsScene, WordBookScene],
}

initGameFlagsFromLocation()
installAudioUnlock()

const game = new Phaser.Game(config)
// Handle for headless capture scripts / debugging.
;(window as unknown as { __VOCAB_PARTY_GAME__?: Phaser.Game }).__VOCAB_PARTY_GAME__ = game

// Re-fit after the browser has applied the new layout (refreshing synchronously in the
// resize event measured the previous size, so the canvas lagged one resize behind).
const refitSoon = () => window.requestAnimationFrame(() => game.scale.refresh())
window.addEventListener('resize', refitSoon)
window.addEventListener('orientationchange', () => window.setTimeout(refitSoon, 150))

// Warm SFX graph lazily; music starts from MenuScene.
void Sfx
