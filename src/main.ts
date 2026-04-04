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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  scene: [BootScene, PreloadScene, MenuScene, SetupScene, BoardScene, QuestionScene, MinigameScene, ResultsScene]
}

initGameFlagsFromLocation()

new Phaser.Game(config)
