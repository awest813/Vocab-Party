# 🎉 Vocab Party

A Mario Party-style vocabulary and grammar browser game built with **Phaser 3** and **TypeScript**.

Players take turns rolling dice, moving around the board, and landing on tiles that trigger vocabulary questions, grammar challenges, minigames, and surprise events. Collect **5 trophies** to win early, or finish all rounds with the best trophy count (then score).

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

---

## Setup

```bash
git clone <repo-url>
cd Vocab-Party
npm install
```

---

## How to Run

```bash
# Start development server (http://localhost:8000)
npm start

# Build for production
npm run build

# Preview production build
npm run preview

# Lint and typecheck
npm run lint
npm run typecheck

# Board balance check (reachability, star spread, tile mix — every board and tide phase)
node scripts/check-boards.mjs
```

---

## Game Instructions

1. **1–4 players** take turns (human or CPU). Pick characters, a map length, a board, and party rules in setup:
   - **Board** (press **G** in setup to cycle) — see the board table below
   - **Quick** — 5 rounds · **Classic** — 10 rounds · **Full Map** — one round per tile on the chosen board
   - **Words:** All levels, Starter (grades 3–5), Standard (6–8), or Challenge (9–12) — applies to board questions and every minigame
   - **Minigames:** every round (default), every other round, or duel tiles only
   - **Bonus Stars:** on/off
2. Click **ROLL** on your turn to roll the standard die (**1–6**; a Dash card adds 1–3 more). Every character also has a **special die** (press **D** or tap the die to switch): e.g. 🛡️ Steady Block (always 3 or 4), 🤖 Calibrated Block (2 or 5), 🏴‍☠️ Plunder Block (stay and loot 4 coins, or sail far). All dice average 3.5 spaces.
3. Your token moves along the board. The tile you land on determines what happens:

| Tile | Effect |
|------|--------|
| 🏠 Start | +3 bonus score/coins (pass for +5 coins) |
| 📖 Vocab | Answer a vocabulary question (+10 pts) |
| ✏️ Grammar | Answer a grammar question (+10 pts) |
| ⭐ Bonus | Instant +5 score and +4 coins (doubled in the Last Stretch) |
| 💀 Penalty | Lose score and coins (shield blocks; doubled in the Last Stretch) |
| ❓ Mystery | Random effect: bonus, penalty, or extra roll |
| 🕹️ Duel | Challenge a rival to a 1-on-1 minigame — winner steals up to 6 coins |
| 🔄 Swap | Swap board positions with another player |
| 🏪 Shop | Buy for 6 coins: rivals who land pay you rent, and each shop pays you +1 coin every round |
| 🏆 Star | Spend 20 coins for a trophy (+12 score). You can also buy when you walk past a star tile, and you can buy several in one visit if you can afford them; if you can't afford it, you get +2 pity coins |
| 🧱 Brick | Collect pieces for build bonuses |
| 🛍️ Item Shop | Pick a power-up card or pass |

| Board | Tiles | Shape | Twist |
|-------|-------|-------|-------|
| 📚 Lexicon Loop | 44 | Classic ring with an inner shortcut | — |
| 🌷 Grammar Garden | 42 | Ring split by a straight garden path | — |
| 🏔️ Spelling Summit | 55 | Long switchback climb with a skip-ahead ledge | — |
| 🌊 Thesaurus Tides | 49 | Island coastline with a cliff path past the star cove | **Tide Turn:** the tide flips every 3 rounds (rounds 1–3 high, 4–6 low, …). At low tide a sandbar causeway opens across the bay (a 4-tile shortcut that skips 10 tiles) and the 🌊-marked shore tiles flip ⭐ Bonus ↔ 💀 Penalty. When the tide comes back in, anyone on the sandbar is washed ashore. |

4. **Party minigames:** after every round, all players compete in a randomly chosen minigame (a roulette picks it). Placement pays coins: 1st +10, 2nd +5, 3rd +2. Several humans take turns on the same device (hot-seat); CPUs play alongside with live "ghost" scores.
5. **Last Stretch:** in the final rounds, bonus and penalty tiles double and the last-place player gets a +10 coin comeback boost.
6. **Bonus Stars:** when the rounds run out, three extra trophies are awarded — 📚 Word Wizard (most correct answers), 🎮 Minigame Master (most minigame wins), 🧭 Explorer (most spaces travelled).
7. **Win condition:** first to **5 trophies**, or most trophies (then score) when rounds end.
8. The results screen has a **📖 Study Sheet** listing each player's missed words and questions.
9. Games **autosave** at the start of every turn — pick **Continue Party** on the main menu to resume.
10. The **📖 Word Book** (main menu) tracks every word you've practiced on this device, with mastery levels, definitions, and a *Practice weak words* mode.
11. **🏅 Achievements** — 16 badges for parties, minigames, boards, and word mastery; view them from the Word Book.

### Minigames

20 vocabulary-and-grammar minigames, each 30–50 seconds. All of them can be practiced solo from **🕹️ Minigame Arcade** on the main menu, with personal bests and CPU-tier medals.

| Game | Skill | Mechanic |
|------|-------|----------|
| 🎸 Word Hero | Vocabulary | Guitar Hero–style rhythm game: strum the notes whose words match the target (synonyms or opposites), let decoys pass, build a ×4 multiplier and fill the meter for WORD POWER double points (song tempo follows the word level) |
| 🏎️ Word Racer | Spelling | Type words from their definitions to race CPU karts — first letter free, hints when stuck, live race position |
| 🎈 Letter Rescue | Spelling | Guess the hidden word letter by letter before six balloons pop |
| 🏗️ Compound Crafter | Word parts | Snap two words together (sun + flower) |
| 🌧️ Synonym Storm | Vocabulary | Catch falling synonyms, dodge opposites |
| 🔤 Anagram Dash | Spelling | Rebuild a scrambled word from its definition |
| 🃏 Memory Match | Vocabulary | Flip cards to pair words with meanings |
| 🔗 Link Up | Vocabulary | Draw lines between words and their synonyms |
| 🧱 Sentence Scramble | Grammar | Rebuild a jumbled sentence word by word |
| 🔨 Whack-a-Word | Grammar | Whack words of the part of speech on the sign |
| 📦 Word Sorter | Grammar | Sort words into noun/verb/adjective/adverb bins |
| 📘 Definition Dash | Vocabulary | Rapid-fire word ↔ definition |
| 🧩 Odd One Out | Vocabulary | Find the word that doesn't share the meaning |
| 🐝 Spelling Bee | Spelling | Pick the correct spelling (words read aloud) |
| 🔄 Antonym Attack | Vocabulary | Pick the opposite — synonym traps included |
| 🔎 Context Clues | Vocabulary | Fill the blank from sentence context |
| 🏭 Prefix Factory | Word parts | Add the prefix/suffix that builds the word |
| 🌱 Root Detective | Word parts | Match Greek/Latin roots to meanings |
| 🔊 Homophone Hunt | Spelling | their/there/they're and friends |
| ✏️ Grammar Gauntlet | Grammar | Pick the correctly written sentence |

---

## Project Structure

```
Vocab-Party/
├── index.html
├── vite.config.js
├── tsconfig.json
├── package.json
├── public/
│   └── data/
│       ├── vocab.json       # Vocabulary questions & context clue minigame data
│       ├── grammar.json     # Grammar questions, comma & parts-of-speech minigame data
│       └── lexicon.json     # Word bank (definitions, synonyms, antonyms, POS), affixes, spelling, roots
└── src/
    ├── main.ts              # Phaser game config & scene list
    ├── scenes/
    │   ├── BootScene.ts     # Initial boot, starts preload
    │   ├── PreloadScene.ts  # Loading bar, JSON + Kenney/phaser assets, texture generation
    │   ├── MenuScene.ts     # Main menu with animated background
    │   ├── SetupScene.ts    # Character, player count, and map selection
    │   ├── BoardScene.ts    # Core game board, dice rolling, turn management
    │   ├── QuestionScene.ts # Vocabulary & grammar question overlay
    │   ├── MinigameScene.ts # Minigame runner: roulette, rules, hot-seat turns, results
    │   ├── ArcadeScene.ts   # Free-play minigame menu with personal bests
    │   ├── BonusStarsScene.ts # End-of-game bonus trophy ceremony
    │   ├── WordBookScene.ts # Lifetime word mastery tracker
    │   ├── BattleScene.ts   # Player encounter battles
    │   ├── PauseScene.ts    # Pause menu overlay
    │   └── ResultsScene.ts  # Final podium and winner announcement
    ├── minigames/
    │   ├── types.ts         # MinigameDef / MinigameContext contracts
    │   ├── ContentBank.ts   # Typed access to all word banks + no-repeat decks
    │   ├── RapidFire.ts     # Shared rapid-fire quiz engine
    │   ├── registry.ts      # Minigame list, CPU scoring, personal bests
    │   └── games/           # Individual minigames
    ├── systems/
    │   ├── GameState.ts     # Player/state types and factory
    │   ├── DiceSystem.ts    # Block die rolling utilities
    │   ├── BoardLayout.ts   # Board definitions: node graphs, tile sets, themes
    │   ├── SaveGame.ts      # Autosave / Continue Party
    │   ├── Progress.ts      # Word Book progress (localStorage)
    │   ├── CpuPolicy.ts     # CPU decision-making
    │   ├── GameSettings.ts  # Audio and accessibility settings
    │   ├── SpriteFactory.ts # Procedural tiles, tokens, Kenney compositing
    │   ├── ExternalAssetKeys.ts
    │   └── Sfx.ts           # Sound effects and music
    └── ui/
        ├── Button.ts        # Reusable animated button component
        ├── Panel.ts         # Panels, dimmers, stage chrome
        ├── Starfield.ts     # Backdrop effects
        ├── Theme.ts         # Shared palette and depth constants
        ├── PlayerHUD.ts     # Top player score panels
        └── Confetti.ts      # Confetti particle effect
```

---

## Adding Custom Questions

### Vocabulary Questions (`public/data/vocab.json`)

Add entries to the `questions` array:

```json
{
  "question": "What does 'resilient' mean?",
  "answers": ["Easily broken", "Quick to recover", "Slow to move", "Hard to see"],
  "correct": 1,
  "explanation": "Resilient means able to recover quickly from difficulties."
}
```

### Grammar Questions (`public/data/grammar.json`)

Same format as vocab questions. Also supports minigame data:

```json
// minigame_comma — add to "minigame_comma" array
{
  "sentence": "...",
  "correct": "...",
  "choices": ["...", "...", "...", "..."],
  "correct_index": 2
}

// minigame_pos — add to "minigame_pos" array
{
  "word": "JOYFUL",
  "sentence": "The joyful child laughed all day.",
  "choices": ["Noun", "Verb", "Adjective", "Adverb"],
  "correct": 2
}

// Other minigame banks in grammar.json / vocab.json:
// minigame_sentence_fix, minigame_synonyms, minigame_antonyms, minigame_homophones
```

### Word Bank (`public/data/lexicon.json`)

Most minigames draw from the lexicon. Each entry in `words` needs a part of speech, a short definition (that doesn't contain the word), exactly three synonyms, one or two antonyms, and an example sentence that uses the word:

```json
{
  "word": "benevolent",
  "pos": "adjective",
  "definition": "kind and generous toward others",
  "synonyms": ["kind", "generous", "charitable"],
  "antonyms": ["cruel", "selfish"],
  "sentence": "The benevolent neighbor shoveled every driveway on the street.",
  "level": 2
}
```

`level` (1 = Starter, 2 = Standard, 3 = Challenge) drives the Word Level setting; it is also supported on board questions in `vocab.json` / `grammar.json` and on `affixes`, `spelling`, and `roots` entries.

`affixes`, `spelling`, `roots`, and `compounds` feed Prefix Factory, Spelling Bee, Root Detective, and Compound Crafter.

### Context Clue Minigame (`public/data/vocab.json`)

Add to the `minigame_context_clues` array:

```json
{
  "sentence": "The athlete was _____ after winning the championship.",
  "word": "elated",
  "choices": ["elated", "tired", "nervous", "angry"],
  "correct": 0
}
```

---

## Deploying (GitHub Pages)

The build uses relative asset paths (`base: './'` in `vite.config.js`), so `dist/` works from any sub-path.

1. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions → Deploy to GitHub Pages → Run workflow.** The game is published at `https://<user>.github.io/<repo>/`.

Any static host works the same way: run `npm run build` and upload `dist/`.

---

## Privacy

Vocab Party makes no network requests beyond loading its own files: no analytics, ads, accounts or third-party fonts. Settings, saved games and Word Book progress stay in the browser's local storage on that device.

---

## Credits

- Art: [Kenney](https://kenney.nl) Board Game Pack and Game Icons (CC0), [Quaternius](https://quaternius.com) LowPoly RPG Characters (CC0). Licence copies are in `public/assets/*/`.
- Tokens, tiles, dice, particles and skies are drawn procedurally in code; all music and sound effects are synthesized live with the Web Audio API.
- Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL Open Font License), self-hosted via `@fontsource/fredoka`.
- Engine: [Phaser 3](https://phaser.io) (MIT). Project template: ourcade/phaser3-typescript-vite-template (MIT).

---

## License

Code: MIT (see `LICENSE`). Third-party assets keep their own licences listed above.
