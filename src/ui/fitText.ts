import Phaser from 'phaser'

/**
 * Make a single-line label fit `maxWidth`: shrink the font down to `minSize`, then trim
 * whole characters (never half an emoji) and add an ellipsis.
 */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number, minSize = 13): Phaser.GameObjects.Text {
  let size = parseInt(String(text.style.fontSize), 10) || 16
  while (text.width > maxWidth && size > minSize) {
    size -= 1
    text.setFontSize(size)
  }
  if (text.width > maxWidth) {
    const chars = Array.from(text.text)
    while (chars.length > 1 && text.width > maxWidth) {
      chars.pop()
      text.setText(`${chars.join('').trimEnd()}…`)
    }
  }
  return text
}
