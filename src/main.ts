import Phaser from 'phaser'
import { initGameFlagsFromLocation } from './systems/gameFlags'
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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1a1a2e',
  scale: {
    // FIT scales the 1280x720 design surface uniformly to fit any window aspect ratio,
    // letterboxing on non-16:9. Game logic always uses 1280x720 internally so menus
    // are deterministic regardless of window shape.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
    expandParent: true
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  scene: [BootScene, PreloadScene, MenuScene, SetupScene, BoardScene, QuestionScene, MinigameScene, ResultsScene, BattleScene, PauseScene]
}

initGameFlagsFromLocation()

new Phaser.Game(config)
