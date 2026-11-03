// Build derived transparent overlays. The original PNG exports are never modified.
// All three themes share the same stock placeholder at the same coordinates.
// Compare those pixels across themes to distinguish it from foreground artwork.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const assets = new URL('../src/assets/', import.meta.url)
const layouts = JSON.parse(readFileSync(new URL('../src/data/stripLayouts.json', import.meta.url), 'utf8'))
const output = new URL('overlays/', assets)
mkdirSync(output, { recursive: true })
const rgb = (data, offset) => (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]

for (const [count, layout] of Object.entries(layouts)) {
  const sources = [1, 2, 3].map((theme) => PNG.sync.read(readFileSync(new URL(`Strips${theme}-${count}.png`, assets))))
  const palette = new Set()
  for (const slot of layout.slots) {
    for (let y = slot.y; y < slot.y + slot.height; y++) {
      for (let x = slot.x; x < slot.x + slot.width; x++) {
        const offset = (y * layout.width + x) * 4
        const colors = sources.map((source) => rgb(source.data, offset))
        const common = colors.find((color, index) => colors.some((other, j) => j !== index && color === other))
        if (common !== undefined) palette.add(common)
      }
    }
  }
  const outputs = sources.map((source) => {
    const overlay = new PNG({ width: source.width, height: source.height })
    overlay.data = Buffer.from(source.data)
    return overlay
  })
  const removed = [0, 0, 0]
  for (const slot of layout.slots) {
    for (let y = slot.y; y < slot.y + slot.height; y++) {
      for (let x = slot.x; x < slot.x + slot.width; x++) {
        const offset = (y * layout.width + x) * 4
        const colors = sources.map((source) => rgb(source.data, offset))
        const common = colors.find((color, index) => colors.some((other, j) => j !== index && color === other))
        const background = common !== undefined && palette.has(common)
          ? common
          : colors.find((color) => palette.has(color) && color !== 0xffffff) ?? colors.find((color) => palette.has(color))
        if (background === undefined) continue
        colors.forEach((color, themeIndex) => {
          if (color === background) {
            outputs[themeIndex].data[offset + 3] = 0
            removed[themeIndex]++
          }
        })
      }
    }
  }
  outputs.forEach((overlay, index) => {
    const target = new URL(`Strips${index + 1}-${count}.png`, output)
    writeFileSync(target, PNG.sync.write(overlay))
    console.log(`${fileURLToPath(target)}: ${removed[index]} placeholder pixels cleared`)
  })
}
