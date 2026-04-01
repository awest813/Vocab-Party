import Phaser from 'phaser'
import { generateGameTextures } from '../systems/SpriteFactory'

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  create() {
    generateGameTextures(this)
    this.scene.start('PreloadScene')
  }
}
