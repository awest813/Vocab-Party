import Phaser from 'phaser'

/** Waits (briefly) for the UI font so the first screens don't flash in a fallback face. */
export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  create() {
    const go = () => this.scene.start('PreloadScene')
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    if (!fonts?.load) {
      go()
      return
    }
    let started = false
    const once = () => {
      if (started) return
      started = true
      go()
    }
    Promise.all(['400', '700'].map(w => fonts.load(`${w} 24px Fredoka`))).then(once, once)
    // Never hold the game hostage to a slow or blocked font.
    window.setTimeout(once, 1500)
  }
}
