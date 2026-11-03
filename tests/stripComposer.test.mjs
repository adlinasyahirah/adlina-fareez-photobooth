import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { PNG } from 'pngjs'

const root = new URL('../', import.meta.url)
const layouts = JSON.parse(readFileSync(new URL('src/data/stripLayouts.json', root), 'utf8'))
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const cropContext = { exports: {} }
vm.runInNewContext(compile(readFileSync(new URL('src/utils/photoCapture.ts', root), 'utf8')), cropContext)
const composer = compile(readFileSync(new URL('src/utils/stripComposer.ts', root), 'utf8'))

function setup(layout, options = {}) {
  const draws = []
  const canvas = {
    width: 0, height: 0,
    getContext: () => options.noContext ? null : {
      fillRect() {},
      drawImage: (...args) => draws.push(args),
    },
    toBlob(callback, mime) {
      assert.equal(mime, 'image/png')
      canvas.encodedSize = [canvas.width, canvas.height]
      callback(options.nullBlob ? null : new Blob(['png'], { type: mime }))
    },
  }
  class FakeImage {
    set src(value) {
      this.url = value
      this.naturalWidth = value === 'overlay' ? layout.width : 1280
      this.naturalHeight = value === 'overlay' ? layout.height : 960
      queueMicrotask(() => options.imageError ? this.onerror() : this.onload())
    }
  }
  const context = { exports: {}, Blob, Image: FakeImage, document: { createElement: () => canvas }, require: () => cropContext.exports }
  vm.runInNewContext(composer, context)
  return { ...context.exports, canvas, draws }
}

for (const count of [1, 2, 3]) {
  test(`${count}-photo strip draws photos in slot order, then artwork, at native resolution`, async () => {
    const layout = layouts[count]
    const { composeStrip, canvas, draws } = setup(layout)
    const frame = { name: 'Dusty Rose', photoCount: count, overlay: 'overlay', layout }
    const photos = Array.from({ length: count }, (_, i) => ({ url: `photo-${i}`, width: 1280, height: 960 }))
    const blob = await composeStrip(frame, photos)
    assert.equal(blob.type, 'image/png')
    assert.deepEqual(canvas.encodedSize, [layout.width, layout.height])
    assert.equal(draws.length, count + 1)
    layout.slots.forEach((slot, index) => {
      assert.equal(draws[index][0].url, `photo-${index}`)
      assert.deepEqual(draws[index].slice(5), [slot.x, slot.y, slot.width, slot.height])
      assert.ok(draws[index][3] > 0 && draws[index][4] > 0)
    })
    assert.equal(draws.at(-1)[0].url, 'overlay')
    assert.deepEqual(draws.at(-1).slice(1), [0, 0])
    assert.equal(canvas.width, 0)
    assert.equal(canvas.height, 0)
  })
}

test('incomplete photos cannot be exported', async () => {
  const { composeStrip } = setup(layouts[2])
  await assert.rejects(composeStrip({ photoCount: 2, overlay: 'overlay', layout: layouts[2] }, [{ url: 'photo-0' }]), /Complete all photos/)
})

test('image load failure is reported', async () => {
  const { composeStrip } = setup(layouts[1], { imageError: true })
  await assert.rejects(composeStrip({ photoCount: 1, overlay: 'overlay', layout: layouts[1] }, [{ url: 'photo-0' }]), /could not load/)
})

test('PNG encoding failure is reported and canvas memory is released', async () => {
  const { composeStrip, canvas } = setup(layouts[1], { nullBlob: true })
  await assert.rejects(composeStrip({ photoCount: 1, overlay: 'overlay', layout: layouts[1] }, [{ url: 'photo-0' }]), /could not be saved/)
  assert.equal(canvas.width, 0)
  assert.equal(canvas.height, 0)
})

test('download name identifies the wedding, theme and layout', () => {
  const { getStripFilename } = setup(layouts[3])
  assert.equal(getStripFilename({ name: 'Dusty Rose', photoCount: 3 }), 'adlina-fareez-2026-11-21-dusty-rose-3-photo-strip.png')
})

for (const theme of [1, 2, 3]) for (const count of [1, 2, 3]) {
  test(`overlay ${theme}-${count} retains original artwork outside slots and clears photo centres`, () => {
    const original = PNG.sync.read(readFileSync(new URL(`src/assets/Strips${theme}-${count}.png`, root)))
    const overlay = PNG.sync.read(readFileSync(new URL(`src/assets/overlays/Strips${theme}-${count}.png`, root)))
    const layout = layouts[count]
    assert.equal(overlay.width, layout.width)
    assert.equal(overlay.height, layout.height)
    const inside = new Uint8Array(overlay.width * overlay.height)
    for (const slot of layout.slots) {
      for (let y = slot.y; y < slot.y + slot.height; y++) inside.fill(1, y * overlay.width + slot.x, y * overlay.width + slot.x + slot.width)
      for (const fraction of [.1, .5, .9]) {
        const x = Math.floor(slot.x + slot.width / 2), y = Math.floor(slot.y + slot.height * fraction)
        assert.equal(overlay.data[(y * overlay.width + x) * 4 + 3], 0, `slot centre at ${fraction} must be transparent`)
      }
    }
    for (let pixel = 0; pixel < inside.length; pixel++) if (!inside[pixel]) {
      const offset = pixel * 4
      assert.equal(overlay.data.readUInt32BE(offset), original.data.readUInt32BE(offset), `artwork changed at pixel ${pixel}`)
    }
  })
}
