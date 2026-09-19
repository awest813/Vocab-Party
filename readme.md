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
```

---

## Game Instructions

1. **1–4 players** take turns (human or CPU). Pick characters and a map length in setup:
   - **Quick** — 5 rounds
   - **Classic** — 10 rounds
   - **Full Map** — 44 rounds
2. Click **ROLL** on your turn to roll the block die (**1–3**; dash can push the total higher).
3. Your token moves along the board. The tile you land on determines what happens:

| Tile | Effect |
|------|--------|
| 🏠 Start | +3 bonus score/coins (pass for +5 coins) |
| 📖 Vocab | Answer a vocabulary question (+10 pts) |
| ✏️ Grammar | Answer a grammar question (+10 pts) |
| ⭐ Bonus | Instant +5 score and +4 coins |
| 💀 Penalty | Lose score and coins (shield blocks) |
| ❓ Mystery | Random effect: bonus, penalty, or extra roll |
| 🕹️ Minigame | Fast challenge — winner earns +15 pts / +5 coins |
| 🔄 Swap | Swap board positions with another player |
| 🏪 Shop | Buy shops to collect rent (Buy/Pass prompt) |
| 🌟 Star | Spend 20 coins for a trophy (+12 score, Buy/Pass prompt) |
| 🧱 Brick | Collect pieces for build bonuses |
| 🛍️ Item Shop | Pick a power-up card or pass |

4. **Win condition:** first to **5 trophies**, or most trophies (then score) when rounds end.
5. Click **🔄 PLAY AGAIN** or **🏠 MAIN MENU** from results.

### Minigames

One is chosen at random each time a player lands on a 🕹️ Minigame tile:

- **🔍 Context Clue Clash** — Fill in the blank using context clues
- **😱 Comma Crisis** — Pick the sentence with correct comma placement
- **🗣️ Parts of Speech** — Identify the part of speech of the featured word
- **⚡ Synonym Blitz** — Pick the word that means almost the same thing
- **✨ Sentence Fix** — Choose the best-written sentence
- **🔄 Antonym Attack** — Pick the opposite of the given word
- **🔊 Homophone Hunt** — Choose the correct word for the blank

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
│       └── grammar.json     # Grammar questions, comma & parts-of-speech minigame data
└── src/
    ├── main.ts              # Phaser game config & scene list
    ├── scenes/
    │   ├── BootScene.ts     # Initial boot, starts preload
    │   ├── PreloadScene.ts  # Loading bar, JSON + Kenney/phaser assets, texture generation
    │   ├── MenuScene.ts     # Main menu with animated background
    │   ├── SetupScene.ts    # Character, player count, and map selection
    │   ├── BoardScene.ts    # Core game board, dice rolling, turn management
    │   ├── QuestionScene.ts # Vocabulary & grammar question overlay
    │   ├── MinigameScene.ts # Seven minigame implementations
    │   ├── BattleScene.ts   # Player encounter battles
    │   ├── PauseScene.ts    # Pause menu overlay
    │   └── ResultsScene.ts  # Final podium and winner announcement
    ├── systems/
    │   ├── GameState.ts     # Player/state types and factory
    │   ├── DiceSystem.ts    # Block die rolling utilities
    │   ├── BoardLayout.ts   # Board node graph
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

## License

MIT
