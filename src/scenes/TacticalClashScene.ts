import Phaser from 'phaser'
import { GameState } from '../systems/GameState'

interface TacticalClashData {
  state: GameState
  onComplete: (winnerId: number) => void
}

const WORLD_W = 1280
const WORLD_H = 720

const PLAYER_SPEED = 220
const DODGE_SPEED = 520
const DODGE_MS = 220
const DODGE_IFRAMES_MS = 380
const COMBO_WINDOW_MS = 720
const COMBO_COUNT = 3
const ATTACK_COOLDOWN_MS = [140, 160, 220]
const ATTACK_DAMAGE = [7, 9, 14]
const ATTACK_STAGGER = [10, 12, 18]
const ATTACK_REACH = 56
const ATTACK_ACTIVE_MS = 120

const ATB_MAX = 100
const ATB_PASSIVE_PER_SEC = 14
const ATB_ON_HIT = 9
const ABILITY_DAMAGE = 28
const ABILITY_STAGGER = 45

const ENEMY_HP = 100
const ENEMY_STAGGER_MAX = 100
const ENEMY_STAGGERED_MS = 3200
const ENEMY_DAMAGE_MULT_STAGGERED = 1.55
const ENEMY_ATTACK_INTERVAL_MS = 2200
const ENEMY_TELEGRAPH_MS = 550
const ENEMY_SLASH_MS = 380
const ENEMY_SLASH_SPEED = 620
const ENEMY_ATTACK_DAMAGE = 22
const PLAYER_HP = 100

type ComboPhase = 'idle' | 'windup' | 'active' | 'recovery'

export class TacticalClashScene extends Phaser.Scene {
  private finish?: (winnerId: number) => void
  private currentPlayerId = 0

  private player!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body }
  private enemy!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body }
  private enemyHp = ENEMY_HP
  private enemyStagger = 0
  private enemyStaggeredUntil = 0
  private enemyNextAttackAt = 0
  private enemyPhaseEnd = 0
  private enemySlashActive = false
  private slashCanHitPlayer = false
  private enemyWarning!: Phaser.GameObjects.Text
  private enemySlash!: Phaser.GameObjects.Rectangle

  private playerHp = PLAYER_HP
  private invulnerableUntil = 0
  private dodgeUntil = 0
  private lastMove = new Phaser.Math.Vector2(1, 0)

  private comboIndex = 0
  private comboExpireAt = 0
  private attackPhase: ComboPhase = 'idle'
  private hitbox?: Phaser.GameObjects.Rectangle

  private atb = 0
  private lockOn = true

  private keys!: {
    w: Phaser.Input.Keyboard.Key
    a: Phaser.Input.Keyboard.Key
    s: Phaser.Input.Keyboard.Key
    d: Phaser.Input.Keyboard.Key
    space: Phaser.Input.Keyboard.Key
    shift: Phaser.Input.Keyboard.Key
    q: Phaser.Input.Keyboard.Key
    tab: Phaser.Input.Keyboard.Key
  }

  private uiHp!: Phaser.GameObjects.Rectangle
  private uiEnemyHp!: Phaser.GameObjects.Rectangle
  private uiStagger!: Phaser.GameObjects.Rectangle
  private uiAtb!: Phaser.GameObjects.Rectangle
  private uiCombo!: Phaser.GameObjects.Text

  constructor() {
    super('TacticalClashScene')
  }

  create(data: TacticalClashData) {
    const { state, onComplete } = data
    this.finish = onComplete
    this.currentPlayerId = state.currentPlayer

    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x0a0e18).setDepth(-10)

    const grid = this.add.graphics().setDepth(-9)
    grid.lineStyle(1, 0x1a2840, 0.35)
    for (let x = 0; x < WORLD_W; x += 48) {
      grid.lineBetween(x, 80, x, WORLD_H - 100)
    }
    for (let y = 80; y < WORLD_H - 100; y += 48) {
      grid.lineBetween(0, y, WORLD_W, y)
    }

    const cx = WORLD_W / 2
    const floorY = WORLD_H - 160

    const p = this.add.rectangle(cx - 180, floorY, 36, 52, 0x4a9eff) as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body
    }
    this.physics.add.existing(p, false)
    p.body.setCollideWorldBounds(true)
    p.body.setSize(28, 44)
    p.body.setOffset(4, 4)
    this.player = p

    const e = this.add.rectangle(cx + 200, floorY - 20, 56, 72, 0xc94a6a) as Phaser.GameObjects.Rectangle & {
      body: Phaser.Physics.Arcade.Body
    }
    this.physics.add.existing(e, false)
    e.body.setImmovable(true)
    e.body.setSize(48, 64)
    e.body.setOffset(4, 4)
    this.enemy = e

    this.enemyWarning = this.add
      .text(e.x, e.y - 70, '', {
        fontSize: '38px',
        fontFamily: 'Arial Black',
        color: '#ff4444'
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.enemySlash = this.add.rectangle(e.x, e.y, 120, 24, 0xff3366, 0.85)
    this.enemySlash.setVisible(false)
    this.physics.add.existing(this.enemySlash, false)
    const slashBody = this.enemySlash.body as Phaser.Physics.Arcade.Body
    slashBody.setAllowGravity(false)
    slashBody.setSize(110, 20)

    this.enemyNextAttackAt = this.time.now + ENEMY_ATTACK_INTERVAL_MS

    const kbd = this.input.keyboard
    if (!kbd) {
      this.time.delayedCall(100, () => onComplete(-1))
      return
    }
    this.keys = {
      w: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      q: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      tab: kbd.addKey(Phaser.Input.Keyboard.KeyCodes.TAB)
    }

    this.physics.add.overlap(this.player, this.enemySlash, () => this.onPlayerHit())

    const hudY = 36
    this.add
      .text(24, hudY - 8, `${state.players[state.currentPlayer].emoji} TACTICAL CLASH`, {
        fontSize: '22px',
        fontFamily: 'Arial Black',
        color: '#e8f0ff'
      })
      .setOrigin(0, 0.5)

    this.add.rectangle(24, hudY + 28, 204, 14, 0x222233).setOrigin(0, 0.5)
    this.uiHp = this.add.rectangle(26, hudY + 28, 200, 10, 0x44dd88).setOrigin(0, 0.5)

    this.add.rectangle(24, hudY + 52, 204, 10, 0x222233).setOrigin(0, 0.5)
    this.uiAtb = this.add.rectangle(26, hudY + 52, 0, 6, 0xffcc33).setOrigin(0, 0.5)

    this.add
      .text(WORLD_W - 24, hudY - 8, 'FOE', {
        fontSize: '22px',
        fontFamily: 'Arial Black',
        color: '#ffccd0'
      })
      .setOrigin(1, 0.5)

    this.add.rectangle(WORLD_W - 24, hudY + 28, 204, 14, 0x222233).setOrigin(1, 0.5)
    this.uiEnemyHp = this.add.rectangle(WORLD_W - 26, hudY + 28, 200, 10, 0xee5566).setOrigin(1, 0.5)

    this.add.rectangle(WORLD_W - 24, hudY + 52, 204, 10, 0x222233).setOrigin(1, 0.5)
    this.uiStagger = this.add.rectangle(WORLD_W - 26, hudY + 52, 0, 6, 0xaaddff).setOrigin(1, 0.5)

    this.uiCombo = this.add
      .text(cx, WORLD_H - 36, '', {
        fontSize: '20px',
        fontFamily: 'Arial Black',
        color: '#ffee88'
      })
      .setOrigin(0.5)

    this.add
      .text(cx, WORLD_H - 68, 'WASD move · SPACE combo · SHIFT dodge (i-frames) · Q ability (ATB) · TAB lock-on', {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: '#8899bb'
      })
      .setOrigin(0.5)

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.stopFollow()
    this.cameras.main.centerOn(this.player.x, this.player.y - 40)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hitbox?.destroy()
    })
  }

  private isEnemyStaggered(now: number) {
    return now < this.enemyStaggeredUntil
  }

  private onPlayerHit() {
    const now = this.time.now
    if (!this.slashCanHitPlayer) return
    if (now < this.invulnerableUntil) return
    if (!this.enemySlash.visible) return

    this.slashCanHitPlayer = false
    this.playerHp = Math.max(0, this.playerHp - ENEMY_ATTACK_DAMAGE)
    this.invulnerableUntil = now + 500
    this.cameras.main.shake(120, 0.006)
    this.player.setFillStyle(0xff8888)
    this.time.delayedCall(120, () => {
      if (this.player.active) this.player.setFillStyle(0x4a9eff)
    })

    if (this.playerHp <= 0) {
      this.endBattle(-1)
    }
  }

  private tryDodge(now: number) {
    if (now < this.dodgeUntil) return
    if (this.attackPhase !== 'idle') return

    const v = this.lastMove.clone()
    if (v.length() < 0.1) {
      const away = new Phaser.Math.Vector2(this.player.x - this.enemy.x, this.player.y - this.enemy.y)
      if (away.length() < 1) away.set(1, 0)
      v.copy(away.normalize())
    } else {
      v.normalize()
    }

    this.dodgeUntil = now + DODGE_MS
    this.invulnerableUntil = now + DODGE_IFRAMES_MS

    const body = this.player.body
    body.setVelocity(v.x * DODGE_SPEED, v.y * DODGE_SPEED)
    this.player.setFillStyle(0x88ccff)
    this.time.delayedCall(DODGE_MS, () => {
      if (this.player.active) this.player.setFillStyle(0x4a9eff)
    })
  }

  private tryAttack(now: number) {
    if (now < this.dodgeUntil) return
    if (this.attackPhase !== 'idle') return

    if (now > this.comboExpireAt) this.comboIndex = 0

    const i = this.comboIndex % COMBO_COUNT
    this.attackPhase = 'windup'
    const windup = 70 + i * 25

    this.time.delayedCall(windup, () => {
      if (!this.scene.isActive() || this.attackPhase !== 'windup') return
      this.spawnHitbox(i)
      this.attackPhase = 'active'
    })
  }

  private spawnHitbox(comboStep: number) {
    this.hitbox?.destroy()

    const facing = Math.sign(this.enemy.x - this.player.x) || 1
    const px = this.player.x + facing * (ATTACK_REACH * 0.55)
    const py = this.player.y

    const box = this.add.rectangle(px, py, ATTACK_REACH, 40, 0xffff88, 0.45)
    this.physics.add.existing(box, false)
    const b = box.body as Phaser.Physics.Arcade.Body
    b.setAllowGravity(false)
    this.hitbox = box

    this.physics.add.overlap(box, this.enemy, () => this.applyPlayerHit(comboStep))

    this.time.delayedCall(ATTACK_ACTIVE_MS, () => {
      box.destroy()
      if (this.hitbox === box) this.hitbox = undefined
      this.attackPhase = 'recovery'
      this.comboIndex = comboStep + 1
      this.comboExpireAt = this.time.now + COMBO_WINDOW_MS
      this.time.delayedCall(ATTACK_COOLDOWN_MS[comboStep], () => {
        if (this.attackPhase === 'recovery') this.attackPhase = 'idle'
      })
    })
  }

  private applyPlayerHit(comboStep: number) {
    if (!this.hitbox) return

    let dmg = ATTACK_DAMAGE[comboStep]
    let stg = ATTACK_STAGGER[comboStep]
    if (this.isEnemyStaggered(this.time.now)) {
      dmg = Math.floor(dmg * ENEMY_DAMAGE_MULT_STAGGERED)
      stg = Math.floor(stg * 0.35)
    }

    this.enemyHp = Math.max(0, this.enemyHp - dmg)
    this.enemyStagger = Math.min(ENEMY_STAGGER_MAX, this.enemyStagger + stg)
    this.atb = Math.min(ATB_MAX, this.atb + ATB_ON_HIT)

    this.enemy.setFillStyle(0xffffff)
    this.time.delayedCall(80, () => {
      if (this.enemy.active) this.enemy.setFillStyle(0xc94a6a)
    })

    if (this.enemyStagger >= ENEMY_STAGGER_MAX && !this.isEnemyStaggered(this.time.now)) {
      this.enemyStagger = 0
      this.enemyStaggeredUntil = this.time.now + ENEMY_STAGGERED_MS
      const label = this.add
        .text(this.enemy.x, this.enemy.y - 100, 'PRESSURED!', {
          fontSize: '32px',
          fontFamily: 'Arial Black',
          color: '#88ddff',
          stroke: '#002244',
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(20)
      this.tweens.add({
        targets: label,
        y: label.y - 40,
        alpha: 0,
        duration: 900,
        onComplete: () => label.destroy()
      })
    }

    const burst = this.add.circle(this.enemy.x, this.enemy.y, 8, 0xffffff, 0.9)
    this.tweens.add({
      targets: burst,
      scale: 3,
      alpha: 0,
      duration: 200,
      onComplete: () => burst.destroy()
    })

    if (this.enemyHp <= 0) {
      this.endBattle(this.currentPlayerId)
    }

    this.hitbox?.destroy()
    this.hitbox = undefined
  }

  private tryAbility(now: number) {
    if (this.atb < ATB_MAX) return
    if (this.attackPhase !== 'idle') return
    if (now < this.dodgeUntil) return

    this.atb = 0
    let dmg = ABILITY_DAMAGE
    const stg = ABILITY_STAGGER
    if (this.isEnemyStaggered(now)) dmg = Math.floor(dmg * ENEMY_DAMAGE_MULT_STAGGERED)

    this.enemyHp = Math.max(0, this.enemyHp - dmg)
    this.enemyStagger = Math.min(ENEMY_STAGGER_MAX, this.enemyStagger + stg)

    const fx = this.add.rectangle(this.enemy.x, this.enemy.y, 140, 100, 0xffdd44, 0.5)
    this.tweens.add({ targets: fx, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 280, onComplete: () => fx.destroy() })

    if (this.enemyHp <= 0) {
      this.endBattle(this.currentPlayerId)
    }
  }

  private endBattle(winnerId: number) {
    if (!this.finish) return
    const cb = this.finish
    this.finish = undefined
    this.physics.pause()
    if (this.input.keyboard) this.input.keyboard.enabled = false
    this.time.delayedCall(400, () => {
      cb(winnerId)
    })
  }

  private beginEnemyTelegraph(now: number) {
    this.enemyPhaseEnd = now + ENEMY_TELEGRAPH_MS
    this.enemyNextAttackAt = now + 999999999
  }

  private beginEnemySlash(now: number) {
    const ang = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, this.player.x, this.player.y)
    this.enemySlash.setPosition(this.enemy.x, this.enemy.y)
    this.enemySlash.setRotation(ang)
    this.enemySlash.setVisible(true)
    this.enemySlashActive = true
    this.slashCanHitPlayer = true
    this.enemyPhaseEnd = now + ENEMY_SLASH_MS
    ;(this.enemySlash.body as Phaser.Physics.Arcade.Body).updateFromGameObject()
  }

  private endEnemySlash() {
    this.enemySlash.setVisible(false)
    this.enemySlashActive = false
    this.slashCanHitPlayer = false
    this.enemyNextAttackAt = this.time.now + ENEMY_ATTACK_INTERVAL_MS
    this.enemyPhaseEnd = 0
  }

  private updateEnemyAI(now: number, delta: number) {
    const staggered = this.isEnemyStaggered(now)
    const drift = staggered ? 0 : Math.sin(now / 500) * 28
    this.enemy.x = Phaser.Math.Clamp(WORLD_W / 2 + 200 + drift, WORLD_W * 0.55, WORLD_W - 80)
    this.enemy.body.updateFromGameObject()

    this.enemyWarning.setPosition(this.enemy.x, this.enemy.y - 70)

    if (staggered) {
      this.enemySlash.setVisible(false)
      this.enemySlashActive = false
      this.slashCanHitPlayer = false
      this.enemyWarning.setAlpha(0)
      this.enemyNextAttackAt = now + ENEMY_ATTACK_INTERVAL_MS
      this.enemyPhaseEnd = 0
      return
    }

    if (this.enemySlashActive) {
      if (now >= this.enemyPhaseEnd) {
        this.endEnemySlash()
        return
      }
      const ang = this.enemySlash.rotation
      const step = ENEMY_SLASH_SPEED * (delta / 1000)
      this.enemySlash.x += Math.cos(ang) * step
      this.enemySlash.y += Math.sin(ang) * step
      ;(this.enemySlash.body as Phaser.Physics.Arcade.Body).updateFromGameObject()
      return
    }

    if (this.enemyPhaseEnd > 0 && now < this.enemyPhaseEnd) {
      this.enemyWarning.setText('!')
      this.enemyWarning.setAlpha(1)
      return
    }

    if (this.enemyPhaseEnd > 0 && now >= this.enemyPhaseEnd) {
      this.enemyWarning.setAlpha(0)
      this.beginEnemySlash(now)
      return
    }

    this.enemyWarning.setAlpha(0)

    if (now >= this.enemyNextAttackAt) {
      this.beginEnemyTelegraph(now)
    }
  }

  update(_t: number, delta: number) {
    const now = this.time.now

    if (!this.player?.body) return

    if (this.enemyHp <= 0 || this.playerHp <= 0) return

    if (Phaser.Input.Keyboard.JustDown(this.keys.tab)) {
      this.lockOn = !this.lockOn
    }

    if (now >= this.dodgeUntil) {
      let vx = 0
      let vy = 0
      if (this.keys.a.isDown) vx -= 1
      if (this.keys.d.isDown) vx += 1
      if (this.keys.w.isDown) vy -= 1
      if (this.keys.s.isDown) vy += 1
      if (vx !== 0 || vy !== 0) {
        this.lastMove.set(vx, vy).normalize()
        this.player.body.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED)
      } else {
        this.player.body.setVelocity(0, 0)
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.shift)) {
      this.tryDodge(now)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      this.tryAttack(now)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) {
      this.tryAbility(now)
    }

    this.updateEnemyAI(now, delta)

    const hpW = (this.playerHp / PLAYER_HP) * 200
    this.uiHp.width = Math.max(0, hpW)

    const eW = (this.enemyHp / ENEMY_HP) * 200
    this.uiEnemyHp.width = Math.max(0, eW)
    this.uiEnemyHp.x = WORLD_W - 26 - Math.max(0, eW)

    const stW = (this.enemyStagger / ENEMY_STAGGER_MAX) * 200
    this.uiStagger.width = Math.max(0, stW)
    this.uiStagger.x = WORLD_W - 26 - Math.max(0, stW)

    this.uiAtb.width = (this.atb / ATB_MAX) * 200

    this.atb = Math.min(ATB_MAX, this.atb + (ATB_PASSIVE_PER_SEC * delta) / 1000)

    const nextChain = (this.comboIndex % COMBO_COUNT) + 1
    const comboLabel =
      this.attackPhase === 'idle' && this.comboIndex > 0 && now <= this.comboExpireAt
        ? `CHAIN ${nextChain}/${COMBO_COUNT}`
        : this.attackPhase === 'idle'
          ? 'CHAIN (Space ×3)'
          : 'CHAIN —'
    this.uiCombo.setText(comboLabel)

    let camX = this.player.x
    let camY = this.player.y - 40
    if (this.lockOn) {
      camX = (this.player.x + this.enemy.x) / 2
      camY = (this.player.y + this.enemy.y) / 2 - 48
    }

    const cam = this.cameras.main
    const curMidX = cam.scrollX + cam.width / 2
    const curMidY = cam.scrollY + cam.height / 2
    const lerp = 0.1
    cam.centerOn(
      Phaser.Math.Linear(curMidX, camX, lerp),
      Phaser.Math.Linear(curMidY, camY, lerp)
    )
  }
}
