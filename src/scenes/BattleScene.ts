import Phaser from 'phaser'
import { GameState, Player } from '../systems/GameState'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { paintStage } from '../ui/Panel'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { scaleAutoSimDelay } from '../systems/gameFlags'
import { cpuBattleChoice } from '../systems/CpuPolicy'
import { TEXTURE_KEYS } from '../systems/ExternalAssetKeys'
import { shouldReduceMotion } from '../systems/GameSettings'
import { Sfx } from '../systems/Sfx'

interface BattleSceneData {
  state: GameState
  attackerIndex: number
  defenderIndex: number
  onComplete: (result: BattleResult) => void
}

export interface BattleResult {
  winnerIndex: number
  scoreLost: number
  coinsLost: number
}

export class BattleScene extends Phaser.Scene {
  private battleData!: BattleSceneData
  private attackerRoll = 0
  private defenderRoll = 0
  private statusText!: Phaser.GameObjects.Text
  private subStatusText!: Phaser.GameObjects.Text
  private attackerContainer!: Phaser.GameObjects.Container
  private defenderContainer!: Phaser.GameObjects.Container
  private defenderTimerEvent: Phaser.Time.TimerEvent | null = null
  private defenderTimerBar: Phaser.GameObjects.Rectangle | null = null
  private choiceMade = false

  constructor() { super('BattleScene') }

  private d(ms: number) { return scaleAutoSimDelay(ms) }

  create(data: BattleSceneData) {
    this.battleData = data
    this.choiceMade = false
    this.defenderTimerEvent = null
    this.defenderTimerBar = null
    const w = this.scale.width
    const h = this.scale.height

    // Backdrop
    paintStage(this, { topColor: 0x14080c, bottomColor: 0x2a1018, midAlpha: 0.55 })
    this.add.rectangle(0, 0, w, h, 0x070b14, 0.35).setOrigin(0)
    Sfx.battle()

    const attacker = data.state.players[data.attackerIndex]
    const defender = data.state.players[data.defenderIndex]

    // VS Splash
    const vsContainer = this.add.container(w / 2, h / 2).setDepth(100)
    const vsBg = this.add.rectangle(0, 0, w, h, 0x000000, 0.72).setAlpha(0)
    const vsText = this.add.text(0, -20, 'VS', {
      fontSize: '100px', fontFamily: FONT.display, color: hexColor(COLORS.coral),
      stroke: '#000000', strokeThickness: 12
    }).setOrigin(0.5).setScale(3).setAlpha(0)

    const atkLabel = this.add.text(-200, 60, `${attacker.emoji} ${attacker.name}`, {
      fontSize: '24px', fontFamily: FONT.display, color: '#ff9a9a'
    }).setOrigin(0.5).setAlpha(0)

    const defLabel = this.add.text(200, 60, `${defender.emoji} ${defender.name}`, {
      fontSize: '24px', fontFamily: FONT.display, color: '#9ab0ff'
    }).setOrigin(0.5).setAlpha(0)

    vsContainer.add([vsBg, vsText, atkLabel, defLabel])
    this.tweens.add({ targets: vsBg, alpha: 1, duration: this.d(150) })
    this.tweens.add({ targets: vsText, scaleX: 1, scaleY: 1, alpha: 1, duration: this.d(500), ease: 'Back.easeOut' })
    this.tweens.add({ targets: atkLabel, alpha: 1, x: -250, duration: this.d(400), delay: this.d(300) })
    this.tweens.add({ targets: defLabel, alpha: 1, x: 250, duration: this.d(400), delay: this.d(400) })
    if (!shouldReduceMotion()) this.cameras.main.flash(this.d(400), 255, 0, 0, true)

    this.time.delayedCall(this.d(1500), () => {
      this.tweens.add({ targets: vsContainer, alpha: 0, duration: this.d(300),
        onComplete: () => vsContainer.destroy(true)
      })
      this.realStart(attacker, defender)
    })
  }

  private realStart(attacker: Player, defender: Player) {
    const w = this.scale.width
    const h = this.scale.height

    this.statusText = this.add.text(w / 2, 88, 'BATTLE!', {
      fontSize: '44px', fontFamily: FONT.display, color: hexColor(COLORS.coral), stroke: '#000000', strokeThickness: 8
    }).setOrigin(0.5)

    this.subStatusText = this.add.text(w / 2, 142, `${attacker.name} challenges ${defender.name}`, {
      fontSize: '22px', fontFamily: FONT.body, color: hexColor(COLORS.mist)
    }).setOrigin(0.5)

    this.attackerContainer = this.createPlayerSide(attacker, w / 2 - 250, h / 2, true)
    this.defenderContainer = this.createPlayerSide(defender, w / 2 + 250, h / 2, false)

    this.startAttackerTurn()
  }

  private createPlayerSide(player: Player, x: number, y: number, isAttacker: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    const color = isAttacker ? COLORS.coral : COLORS.sky

    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.3)
    g.fillRoundedRect(-112, -128, 224, 264, 16)
    g.fillStyle(COLORS.bgPanel, 0.94)
    g.fillRoundedRect(-110, -130, 220, 260, 16)
    g.lineStyle(3, color, 0.75)
    g.strokeRoundedRect(-110, -130, 220, 260, 16)
    g.fillStyle(color, 0.9)
    g.fillRoundedRect(-106, -126, 212, 5, 2)

    const role = this.add.text(0, -108, isAttacker ? 'ATTACKER' : 'DEFENDER', {
      fontSize: '13px', fontFamily: FONT.display, color: hexColor(color),
    }).setOrigin(0.5)

    const name = this.add.text(0, -82, player.name.toUpperCase(), {
      fontSize: '22px', fontFamily: FONT.display, color: '#ffffff',
    }).setOrigin(0.5)

    const emoji = this.add.text(0, -28, player.emoji, { fontSize: '64px' }).setOrigin(0.5)

    const stats = this.add.text(0, 48, `ATK ${Math.max(1, player.atk)}   DEF ${Math.max(1, player.def)}   EVD ${Math.max(1, player.evd)}`, {
      fontSize: '15px', fontFamily: FONT.display, color: hexColor(COLORS.mist), align: 'center'
    }).setOrigin(0.5)

    const rollText = this.add.text(0, 100, '?', {
      fontSize: '52px', fontFamily: FONT.display, color: '#ffffff', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5)
    rollText.setName('rollText')

    container.add([g, role, name, emoji, stats, rollText])

    this.tweens.add({
      targets: container,
      y: '+=8',
      duration: 1500 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    return container
  }

  private async startAttackerTurn() {
    const attacker = this.battleData.state.players[this.battleData.attackerIndex]
    this.statusText.setText(`${attacker.name}'s Attack Roll!`)
    
    await new Promise(r => this.time.delayedCall(this.d(1000), r))

    const roll = Phaser.Math.Between(1, 6)
    this.attackerRoll = Math.max(1, roll + attacker.atk)
    
    const rollText = this.attackerContainer.getByName('rollText') as Phaser.GameObjects.Text
    this.animateRoll(rollText, this.attackerRoll)

    await new Promise(r => this.time.delayedCall(this.d(1500), r))
    this.startDefenderTurn()
  }

  private async startDefenderTurn() {
    const defender = this.battleData.state.players[this.battleData.defenderIndex]
    this.statusText.setText(`${defender.name}'s Choice!`)

    if (defender.isCpu) {
      const choice = cpuBattleChoice(defender.atk, defender.def, defender.evd, defender.cpuLevel)
      this.statusText.setText(`${defender.name} (CPU) weighs defend vs evade…`)
      this.time.delayedCall(this.d(900), () => this.resolveDefender(choice))
    } else {
      const w = this.scale.width
      const by = this.scale.height / 2 + 160
      const bx = w / 2 + 250

      this.add.text(bx, by - 50, 'Choose quickly!', {
        fontSize: '16px', fontFamily: 'Fredoka, Arial', color: '#ffcc44'
      }).setOrigin(0.5).setName('timerLabel')

      // Timer bar
      this.add.rectangle(bx, by + 35, 180, 12, 0x333355).setStrokeStyle(1, 0xffffff, 0.3)
      this.defenderTimerBar = this.add.rectangle(bx - 90, by + 35, 180, 10, 0x44ff88).setOrigin(0, 0.5)
      this.tweens.add({
        targets: this.defenderTimerBar,
        width: 0,
        duration: this.d(8000),
        ease: 'Linear'
      })

      const defBtn = createButton(this, bx - 70, by, 'DEFEND', COLORS.skyDeep, COLORS.skyBtnDeep, 140, 50)
      const evaBtn = createButton(this, bx + 70, by, 'EVADE', COLORS.party, COLORS.partyDeep, 140, 50)

      const onKey = (ev: KeyboardEvent) => {
        if (ev.code === 'Digit1' || ev.code === 'KeyA' || ev.code === 'Numpad1') pick('defend')
        if (ev.code === 'Digit2' || ev.code === 'KeyB' || ev.code === 'Numpad2') pick('evade')
      }

      this.defenderTimerEvent = this.time.delayedCall(this.d(8000), () => {
        if (!this.choiceMade) {
          this.choiceMade = true
          this.input.keyboard?.off('keydown', onKey)
          defBtn?.destroy()
          evaBtn?.destroy()
          this.statusText.setText('⏱️ Time ran out! Auto-defending!')
          this.time.delayedCall(this.d(800), () => this.resolveDefender('defend'))
        }
      })

      const pick = (choice: 'defend' | 'evade') => {
        if (this.choiceMade) return
        this.choiceMade = true
        this.defenderTimerEvent?.remove()
        this.tweens.killTweensOf(this.defenderTimerBar)
        this.defenderTimerBar?.destroy()
        this.input.keyboard?.off('keydown', onKey)
        defBtn.destroy(); evaBtn.destroy()
        this.resolveDefender(choice)
      }

      this.input.keyboard?.on('keydown', onKey)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.input.keyboard?.off('keydown', onKey)
      })

      defBtn.on('pointerdown', () => pick('defend'))
      evaBtn.on('pointerdown', () => pick('evade'))
    }
  }

  private async resolveDefender(choice: 'defend' | 'evade') {
    const defender = this.battleData.state.players[this.battleData.defenderIndex]
    const roll = Phaser.Math.Between(1, 6)
    
    const rollText = this.defenderContainer.getByName('rollText') as Phaser.GameObjects.Text
    
    if (choice === 'defend') {
      this.defenderRoll = Math.max(1, roll + defender.def)
      this.statusText.setText(`${defender.name} Defends!`)
      this.animateRoll(rollText, this.defenderRoll)
    } else {
      this.defenderRoll = Math.max(1, roll + defender.evd)
      this.statusText.setText(`${defender.name} Evades!`)
      this.animateRoll(rollText, this.defenderRoll)
    }

    await new Promise(r => this.time.delayedCall(this.d(1500), r))
    this.calculateOutcome(choice)
  }

  private animateRoll(textObj: Phaser.GameObjects.Text, final: number) {
    let count = 0
    this.time.addEvent({
      delay: 50,
      repeat: 10,
      callback: () => {
        textObj.setText(String(Phaser.Math.Between(1, 9)))
        count++
        if (count > 10) {
          textObj.setText(String(final))
          textObj.setScale(1.5)
          this.tweens.add({ targets: textObj, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' })
        }
      }
    })
  }

  private calculateOutcome(choice: 'defend' | 'evade') {
    let dmg = 0

    if (choice === 'defend') {
      dmg = Math.max(1, this.attackerRoll - this.defenderRoll)
    } else {
      if (this.defenderRoll > this.attackerRoll) {
        dmg = 0
      } else {
        dmg = this.attackerRoll
      }
    }

    const defender = this.battleData.state.players[this.battleData.defenderIndex]

    // Shield Check
    if (dmg > 0 && defender.shieldActive) {
      defender.shieldActive = false
      dmg = 0
      this.statusText.setText('🛡️ SHIELD BLOCKED!')
      if (!shouldReduceMotion()) this.cameras.main.flash(400, 68, 204, 255) // Blue shield flash
      this.time.delayedCall(this.d(2000), () => {
        this.cameras.main.fadeOut(500, 0, 0, 0)
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.battleData.onComplete({
            winnerIndex: this.battleData.defenderIndex,
            scoreLost: 0,
            coinsLost: 0
          })
        })
      })
      return
    }

    if (dmg > 0) {
      this.statusText.setText(`💥 ${dmg} CRITICAL HIT!`)
      if (!shouldReduceMotion()) {
        this.cameras.main.shake(300, 0.02)
        this.cameras.main.flash(200, 255, 0, 0, true)
      }

      const fx = this.defenderContainer.x
      const fy = this.defenderContainer.y
      const flameKey = this.textures.exists(TEXTURE_KEYS.flame1)
        ? TEXTURE_KEYS.flame1
        : (this.textures.exists(TEXTURE_KEYS.muzzleflash) ? TEXTURE_KEYS.muzzleflash : null)
      if (flameKey) {
        const burst = this.add.particles(fx, fy, flameKey, {
          speed: { min: 80, max: 240 },
          angle: { min: 0, max: 360 },
          lifespan: { min: 350, max: 700 },
          scale: { start: 0.7, end: 0.05 },
          alpha: { start: 0.9, end: 0 },
          blendMode: Phaser.BlendModes.ADD,
          emitting: false
        })
        burst.setDepth(50)
        burst.explode(24)
        this.time.delayedCall(1200, () => burst.destroy())
      }
      
      // Crown on attacker (winner)
      const crown = this.add.text(this.attackerContainer.x, this.attackerContainer.y - 140, '👑', {
        fontSize: '48px'
      }).setOrigin(0.5).setAlpha(0).setScale(2)
      this.tweens.add({ targets: crown, alpha: 1, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' })

      const scoreLost = dmg * 3
      const coinsLost = dmg * 2
      
      this.subStatusText.setText(`${defender.name} lost ${scoreLost} pts and ${coinsLost} coins!`)
      
      this.time.delayedCall(this.d(2000), () => {
        this.cameras.main.fadeOut(500, 0, 0, 0)
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.battleData.onComplete({
            winnerIndex: this.battleData.attackerIndex,
            scoreLost,
            coinsLost
          })
        })
      })
    } else {
      this.statusText.setText(`✨ ${defender.name} dodged!`)
      // Dazzle burst around defender
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const dist = 80
        this.time.delayedCall(i * 30, () => {
          const star = this.add.text(
            this.defenderContainer.x + Math.cos(angle) * 40,
            this.defenderContainer.y + Math.sin(angle) * 40,
            '✨', { fontSize: '28px' }
          ).setOrigin(0.5).setAlpha(1)
          this.tweens.add({
            targets: star,
            x: star.x + Math.cos(angle) * dist,
            y: star.y + Math.sin(angle) * dist,
            alpha: 0,
            duration: 500,
            ease: 'Cubic.easeOut',
            onComplete: () => star.destroy()
          })
        })
      }
      showConfetti(this)
      this.time.delayedCall(this.d(2000), () => {
        this.cameras.main.fadeOut(500, 0, 0, 0)
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.battleData.onComplete({
            winnerIndex: this.battleData.defenderIndex,
            scoreLost: 0,
            coinsLost: 0
          })
        })
      })
    }
  }
}
