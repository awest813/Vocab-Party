export function rollDice(sides = 6): number {
  return Math.floor(Math.random() * sides) + 1
}

export function rollTwoDice(): [number, number] {
  return [rollDice(), rollDice()]
}
