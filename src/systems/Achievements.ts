import Phaser from 'phaser'
import { Sfx } from './Sfx'
import { COLORS, FONT, hexColor } from '../ui/Theme'
import { getProgress, masteryOf, saveProgress } from './Progress'
import { shouldReduceMotion } from './GameSettings'

export interface AchievementDef {
  id: string
  icon: string
  title: string
  desc: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_party', icon: '🎈', title: 'Party Starter', desc: 'Finish your first party.' },
  { id: 'first_win', icon: '🏆', title: 'Champion', desc: 'Win a party.' },
  { id: 'all_boards', icon: '🗺️', title: 'World Traveler', desc: 'Win a party on all three boards.' },
  { id: 'full_map', icon: '🧭', title: 'Grand Tour', desc: 'Finish a Full Map party.' },
  { id: 'challenge_win', icon: '🎓', title: 'Scholar', desc: 'Win a party on Challenge word level.' },
  { id: 'bonus_sweep', icon: '🌟', title: 'Star Sweep', desc: 'Earn every bonus star in one party.' },
  { id: 'coins_50', icon: '💰', title: 'Treasure Hoard', desc: 'Hold 50 coins at once.' },
  { id: 'streak_5', icon: '🔥', title: 'On a Roll', desc: 'Answer 5 board questions in a row correctly.' },
  { id: 'minigame_win', icon: '🎮', title: 'Game On', desc: 'Win a minigame against rivals.' },
  { id: 'minigame_10', icon: '🕹️', title: 'Arcade Ace', desc: 'Win 10 minigames against rivals.' },
  { id: 'gold_medal', icon: '🥇', title: 'Gold Medalist', desc: 'Beat a Hard CPU’s best score in practice.' },
  { id: 'arcade_all', icon: '🎰', title: 'Completionist', desc: 'Set a personal best in every minigame.' },
  { id: 'words_25', icon: '📗', title: 'Word Explorer', desc: 'Practice 25 different words.' },
  { id: 'words_100', icon: '📚', title: 'Word Collector', desc: 'Practice 100 different words.' },
  { id: 'master_10', icon: '⭐', title: 'Wordsmith', desc: 'Master 10 words.' },
  { id: 'master_50', icon: '👑', title: 'Lexicon Legend', desc: 'Master 50 words.' },
]

export function isUnlocked(id: string): boolean {
  return Boolean(getProgress().achievements?.[id])
}

/** Unlock an achievement; shows a toast in `scene` when it is new. Returns true if newly unlocked. */
export function unlock(id: string, scene?: Phaser.Scene): boolean {
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (!def) return false
  const p = getProgress()
  p.achievements = p.achievements ?? {}
  if (p.achievements[id]) return false
  p.achievements[id] = Date.now()
  saveProgress()
  if (scene) showAchievementToast(scene, def)
  return true
}

/** Re-check the word-count achievements after progress changes. */
export function checkWordAchievements(scene?: Phaser.Scene): void {
  const records = Object.values(getProgress().words)
  const mastered = records.filter(r => masteryOf(r) === 'mastered').length
  if (records.length >= 25) unlock('words_25', scene)
  if (records.length >= 100) unlock('words_100', scene)
  if (mastered >= 10) unlock('master_10', scene)
  if (mastered >= 50) unlock('master_50', scene)
}

const toastQueue: { scene: Phaser.Scene; def: AchievementDef }[] = []
let toastBusy = false

/** Slide-in badge in the top-right corner; queued so several unlocks play in turn. */
export function showAchievementToast(scene: Phaser.Scene, def: AchievementDef): void {
  toastQueue.push({ scene, def })
  if (!toastBusy) playNextToast()
}

function playNextToast() {
  const next = toastQueue.shift()
  if (!next) {
    toastBusy = false
    return
  }
  const { scene, def } = next
  if (!scene.sys?.isActive() && !scene.sys?.isVisible()) {
    playNextToast()
    return
  }
  toastBusy = true
  const w = scene.scale.width
  const tw = 360
  const c = scene.add.container(w + tw / 2, 150).setDepth(5000)
  const g = scene.add.graphics()
  g.fillStyle(0x000000, 0.45)
  g.fillRoundedRect(-tw / 2 + 3, -38, tw, 80, 16)
  g.fillStyle(COLORS.bgPanel, 0.98)
  g.fillRoundedRect(-tw / 2, -42, tw, 80, 16)
  g.lineStyle(3, COLORS.gold, 0.9)
  g.strokeRoundedRect(-tw / 2, -42, tw, 80, 16)
  c.add(g)
  c.add(scene.add.text(-tw / 2 + 40, -2, def.icon, { fontSize: '36px' }).setOrigin(0.5))
  c.add(scene.add.text(-tw / 2 + 74, -20, 'ACHIEVEMENT UNLOCKED', {
    fontSize: '12px', fontFamily: FONT.display, color: hexColor(COLORS.gold),
  }).setOrigin(0, 0.5))
  c.add(scene.add.text(-tw / 2 + 74, 2, def.title, {
    fontSize: '22px', fontFamily: FONT.display, color: '#ffffff',
  }).setOrigin(0, 0.5))
  c.add(scene.add.text(-tw / 2 + 74, 24, def.desc, {
    fontSize: '12px', fontFamily: FONT.body, color: hexColor(COLORS.mist), wordWrap: { width: tw - 90 },
  }).setOrigin(0, 0.5))
  Sfx.star()
  const finish = () => {
    c.destroy()
    playNextToast()
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (c.active) finish() })
  const inX = w - tw / 2 - 16
  if (shouldReduceMotion()) {
    c.setX(inX)
    scene.time.delayedCall(2600, () => { if (c.active) finish() })
    return
  }
  scene.tweens.add({
    targets: c, x: inX, duration: 380, ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(2400, () => {
        if (!c.active) return
        scene.tweens.add({ targets: c, x: w + tw / 2, duration: 280, ease: 'Cubic.easeIn', onComplete: () => { if (c.active) finish() } })
      })
    },
  })
}
