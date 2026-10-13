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

/** Unlock an achievement; shows a toast when it is new. Returns true if newly unlocked. */
export function unlock(id: string): boolean {
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (!def) return false
  const p = getProgress()
  p.achievements = p.achievements ?? {}
  if (p.achievements[id]) return false
  p.achievements[id] = Date.now()
  saveProgress()
  showAchievementToast(def)
  return true
}

/** Re-check the word-count achievements after progress changes. */
export function checkWordAchievements(): void {
  const records = Object.values(getProgress().words)
  const mastered = records.filter(r => masteryOf(r) === 'mastered').length
  if (records.length >= 25) unlock('words_25')
  if (records.length >= 100) unlock('words_100')
  if (mastered >= 10) unlock('master_10')
  if (mastered >= 50) unlock('master_50')
}

const toastQueue: AchievementDef[] = []
let toastBusy = false

/**
 * Slide-in badge in the top-right corner. Rendered as a DOM overlay so it survives
 * scene changes, pauses and restarts; queued so several unlocks play in turn.
 */
export function showAchievementToast(def: AchievementDef): void {
  if (typeof document === 'undefined') return
  toastQueue.push(def)
  if (!toastBusy) playNextToast()
}

function playNextToast() {
  const def = toastQueue.shift()
  if (!def) {
    toastBusy = false
    return
  }
  toastBusy = true
  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:1000', 'display:flex', 'align-items:center', 'gap:12px',
    'max-width:min(360px,calc(100vw - 32px))', 'padding:10px 16px', 'border-radius:14px',
    `background:${hexColor(COLORS.bgPanel)}`, `border:3px solid ${hexColor(COLORS.gold)}`,
    'box-shadow:0 6px 18px rgba(0,0,0,.45)', `font-family:${FONT.body}`, 'color:#fff', 'pointer-events:none',
    `transition:transform ${shouldReduceMotion() ? 0 : 380}ms cubic-bezier(.2,1.4,.4,1), opacity 300ms`,
    'transform:translateX(120%)', 'opacity:0',
  ].join(';')
  el.innerHTML = `<div style="font-size:34px;line-height:1"></div><div><div style="font-size:11px;letter-spacing:1px;color:${hexColor(COLORS.gold)};font-family:${FONT.display}">ACHIEVEMENT UNLOCKED</div><div style="font-size:20px;font-family:${FONT.display}"></div><div style="font-size:12px;color:${hexColor(COLORS.mist)}"></div></div>`
  const [iconEl, textBox] = Array.from(el.children) as HTMLElement[]
  iconEl.textContent = def.icon
  const lines = Array.from(textBox.children) as HTMLElement[]
  lines[1].textContent = def.title
  lines[2].textContent = def.desc
  document.body.appendChild(el)
  Sfx.star()
  requestAnimationFrame(() => {
    el.style.transform = 'translateX(0)'
    el.style.opacity = '1'
  })
  window.setTimeout(() => {
    el.style.transform = 'translateX(120%)'
    el.style.opacity = '0'
    window.setTimeout(() => {
      el.remove()
      playNextToast()
    }, 360)
  }, 2800)
}
