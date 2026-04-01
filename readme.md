# 🎉 Vocab Party

A Mario Party-style vocabulary and grammar browser game built with **Phaser 3** and **TypeScript**.

Players take turns rolling dice, moving around the board, and landing on tiles that trigger vocabulary questions, grammar challenges, minigames, and surprise events. The player with the most points after 10 rounds wins the trophy!

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- npm v8 or higher

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
```

---

## Game Instructions

1. **4 players** take turns in order (Alex 🔴, Blake 🔵, Casey 🟢, Dana 🟡).
2. Click **🎲 ROLL DICE** on your turn to roll a die (1–6).
3. Your token moves along the board. The tile you land on determines what happens:

| Tile | Effect |
|------|--------|
| 🏠 Start | +3 bonus points |
| 📖 Vocab | Answer a vocabulary multiple-choice question (+10 pts) |
| ✏️ Grammar | Answer a grammar question (+10 pts) |
| ⭐ Bonus | Instant +5 points |
| ❓ Mystery | Random effect: bonus, penalty, or extra roll |
| 🕹️ Minigame | Everyone plays a fast minigame; winner gets +15 pts |
| 🔄 Swap | Swap board positions with a random player |

4. After **10 rounds** (40 total turns), the **Final Results** screen shows the podium.
5. Click **🔄 PLAY AGAIN** or **🏠 MAIN MENU** to play again.

### Minigames

- **🔍 Context Clue Clash** — Fill in the blank using context clues
- **😱 Comma Crisis** — Pick the sentence with correct comma placement
- **🗣️ Parts of Speech Panic** — Identify the part of speech of the highlighted word

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
    │   ├── PreloadScene.ts  # Loading bar, loads JSON data files
    │   ├── MenuScene.ts     # Main menu with animated background
    │   ├── BoardScene.ts    # Core game board, dice rolling, turn management
    │   ├── QuestionScene.ts # Vocabulary & grammar question overlay
    │   ├── MinigameScene.ts # Three minigame implementations
    │   └── ResultsScene.ts  # Final podium and winner announcement
    ├── systems/
    │   ├── GameState.ts     # Player/state types and factory
    │   └── DiceSystem.ts    # Dice rolling utilities
    └── ui/
        ├── Button.ts        # Reusable animated button component
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
