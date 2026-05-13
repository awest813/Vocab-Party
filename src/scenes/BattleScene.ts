import Phaser from 'phaser'
import { GameState, Player } from '../systems/GameState'
import { createButton } from '../ui/Button'
import { showConfetti } from '../ui/Confetti'
import { isAutoSimMode, scaleAutoSimDelay } from '../systems/gameFlags'
import { cpuBattleChoice } from '../systems/CpuPolicy'

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
    const w = this.scale.width
    const h = this.scale.height

    // Backdrop
    this.add.rectangle(0, 0, w, h, 0x000000, 0.85).setOrigin(0)
    this.add.rectangle(w / 2, h / 2, w, 300, 0x330000, 0.6).setOrigin(0.5)

    const attacker = data.state.players[data.attackerIndex]
    const defender = data.state.players[data.defenderIndex]

    this.statusText = this.add.text(w / 2, 100, '⚔️ BATTLE START!', {
      fontSize: '48px', fontFamily: 'Arial Black', color: '#ff4444', stroke: '#000000', strokeThickness: 8
    }).setOrigin(0.5)

    this.subStatusText = this.add.text(w / 2, 160, `${attacker.name} is attacking ${defender.name}!`, {
      fontSize: '24px', fontFamily: 'Arial', color: '#ffffff'
    }).setOrigin(0.5)

    this.attackerContainer = this.createPlayerSide(attacker, w / 2 - 250, h / 2, true)
    this.defenderContainer = this.createPlayerSide(defender, w / 2 + 250, h / 2, false)

    this.startAttackerTurn()
  }

  private createPlayerSide(player: Player, x: number, y: number, isAttacker: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    const color = isAttacker ? 0xff4444 : 0x4444ff
    
    // Glassmorphic background
    const bg = this.add.rectangle(0, 0, 220, 260, 0x050510, 0.8)
    bg.setStrokeStyle(4, color, 0.6)
    
    // Top glow line
    const glow = this.add.rectangle(0, -128, 216, 4, color, 0.8)

    const name = this.add.text(0, -100, player.name.toUpperCase(), { 
      fontSize: '22px', fontFamily: 'Arial Black', color: '#ffffff', letterSpacing: 2
    }).setOrigin(0.5)
    
    const emoji = this.add.text(0, -45, player.emoji, { fontSize: '72px' }).setOrigin(0.5)
    
    const stats = this.add.text(0, 45, `⚔️ +${Math.max(1, player.atk)}  🛡️ +${Math.max(1, player.def)}  💨 +${Math.max(1, player.evd)}`, {
      fontSize: '20px', fontFamily: 'Arial Black', color: '#8899aa', align: 'center'
    }).setOrigin(0.5)

    const rollText = this.add.text(0, 110, '?', { 
      fontSize: '56px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#000000', strokeThickness: 6 
    }).setOrigin(0.5)
    rollText.setName('rollText')

    container.add([bg, glow, name, emoji, stats, rollText])
    
    // Idle float
    this.tweens.add({
      targets: container,
      y: '+=10',
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
    
    await new Promise(r => this.time.delayedCall(1000, r))

    const roll = Phaser.Math.Between(1, 6)
    this.attackerRoll = Math.max(1, roll + attacker.atk)
    
    const rollText = this.attackerContainer.getByName('rollText') as Phaser.GameObjects.Text
    this.animateRoll(rollText, this.attackerRoll)

    await new Promise(r => this.time.delayedCall(1500, r))
    this.startDefenderTurn()
  }

  private async startDefenderTurn() {
    const defender = this.battleData.state.players[this.battleData.defenderIndex]
    this.statusText.setText(`${defender.name}'s Choice!`)

    if (defender.isCpu) {
      const choice = cpuBattleChoice(defender.atk, defender.def, defender.evd, defender.cpuLevel)
      this.time.delayedCall(1000, () => this.resolveDefender(choice))
    } else {
      const w = this.scale.width
      const by = this.scale.height / 2 + 160
      const bx = w / 2 + 250

      this.add.text(bx, by - 50, 'Choose quickly!', {
        fontSize: '16px', fontFamily: 'Arial', color: '#ffcc44'
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

      this.defenderTimerEvent = this.time.delayedCall(this.d(8000), () => {
        if (!this.choiceMade) {
          this.choiceMade = true
          defBtn?.destroy()
          evaBtn?.destroy()
          this.statusText.setText('⏱️ Time ran out! Auto-defending!')
          this.time.delayedCall(this.d(800), () => this.resolveDefender('defend'))
        }
      })

      const defBtn = createButton(this, bx - 70, by, '🛡️ DEFEND', 0x4444ff, 0x000088, 140, 50)
      const evaBtn = createButton(this, bx + 70, by, '💨 EVADE', 0x44ff44, 0x008800, 140, 50)

      const pick = (choice: 'defend' | 'evade') => {
        if (this.choiceMade) return
        this.choiceMade = true
        this.defenderTimerEvent?.remove()
        this.tweens.killTweensOf(this.defenderTimerBar)
        this.defenderTimerBar?.destroy()
        defBtn.destroy(); evaBtn.destroy()
        this.resolveDefender(choice)
      }

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

    await new Promise(r => this.time.delayedCall(1500, r))
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
      this.cameras.main.flash(400, 68, 204, 255) // Blue shield flash
      this.time.delayedCall(2000, () => {
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
      this.cameras.main.shake(300, 0.02)
      this.cameras.main.flash(200, 255, 0, 0, true)
      
      // Crown on attacker (winner)
      const crown = this.add.text(this.attackerContainer.x, this.attackerContainer.y - 140, '👑', {
        fontSize: '48px'
      }).setOrigin(0.5).setAlpha(0).setScale(2)
      this.tweens.add({ targets: crown, alpha: 1, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' })

      const scoreLost = dmg * 3
      const coinsLost = dmg * 2
      
      this.subStatusText.setText(`${defender.name} lost ${scoreLost} pts and ${coinsLost} coins!`)
      
      this.time.delayedCall(2000, () => {
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
      this.time.delayedCall(2000, () => {
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
