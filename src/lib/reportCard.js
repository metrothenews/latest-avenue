// Draws the party game's police report (the last thing on the game's screen) as a picture, so the
// /experience can show it on a monitor and pull back from it. `lines` is [[label, value], ...],
// the suspect's name last. Returns a 4:3 canvas in the game's late-90s look.
export function drawReport(lines, title) {
  const [W, H] = [1600, 1200]
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')
  const font = (px, bold) => `${bold ? '700 ' : ''}${px}px Tahoma, Geneva, Verdana, sans-serif`
  c.fillStyle = '#008080'
  c.fillRect(0, 0, W, H)
  // The window, with its bevel.
  const [x, y, w, h] = [130, 150, 1340, 860]
  c.fillStyle = '#c0c0c0'
  c.fillRect(x, y, w, h)
  c.fillStyle = '#ffffff'; c.fillRect(x, y, w, 3); c.fillRect(x, y, 3, h)
  c.fillStyle = '#0a0a0a'; c.fillRect(x, y + h - 3, w, 3); c.fillRect(x + w - 3, y, 3, h)
  c.fillStyle = '#000080'
  c.fillRect(x + 6, y + 6, w - 12, 44)
  c.fillStyle = '#ffffff'
  c.font = font(28, true)
  c.textBaseline = 'middle'
  c.fillText(title, x + 18, y + 29)
  c.fillStyle = '#ffffff'
  c.fillRect(x + 14, y + 96, w - 28, h - 112)
  // The lines.
  let top = y + 150
  lines.forEach(([label, value], i) => {
    const last = i === lines.length - 1
    if (last) { top += 24; c.fillStyle = '#808080'; c.fillRect(x + 40, top - 34, w - 80, 2); top += 26 }
    c.fillStyle = '#404040'
    c.font = font(26)
    c.fillText(label.toUpperCase(), x + 44, top)
    c.fillStyle = '#000000'
    c.font = font(last ? 72 : 34, true)
    let text = value
    while (c.measureText(text).width > w - 470 && text.length > 4) text = `${text.slice(0, -2)}…`
    c.fillText(text, x + 400, top + (last ? 6 : 0))
    top += last ? 0 : 78
  })
  // The taskbar.
  c.fillStyle = '#c0c0c0'
  c.fillRect(0, H - 56, W, 56)
  c.fillStyle = '#ffffff'
  c.fillRect(0, H - 56, W, 3)
  return canvas
}
