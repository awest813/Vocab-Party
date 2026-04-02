export function rollDice(sides = 6): number {
  return Math.floor(Math.random() * sides) + 1
}

/** Mario Party–style "block" die — small movement, big swings. */
export function rollBlockDie(): number {
  return rollDice(3)
}

export function rollTwoDice(): [number, number] {
  return [rollDice(), rollDice()]
}
