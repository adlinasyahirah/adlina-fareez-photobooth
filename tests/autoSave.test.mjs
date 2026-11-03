import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/components/FinishedStripPreview.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0]
const compiled = ts.transpileModule(source + '\nglobalThis.api = { previewUrl, isAlbumSaved, isAlbumSaving, albumError, renderStrip, maybeAutoSave, saveToCouple };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const flush = () => new Promise(setImmediate)
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }

function setup(options = {}) {
  const hooks = {}
  const sends = []
  const revoked = []
  const blob = new Blob(['strip'], { type: 'image/png' })
  const props = { frame: { id: 'frame-3-1', name: 'Dusty Rose', photoCount: 1, layout: { width: 1080, height: 1350 } }, photos: [{ url: 'photo-1' }] }
  const context = {
    exports: {}, Blob, File, AbortController, Error,
    props,
    crypto: { randomUUID: () => '12345678-1234-4123-8123-123456789abc' },
    URL: { createObjectURL: () => 'blob:test-strip', revokeObjectURL: (url) => revoked.push(url) },
    navigator: {},
    defineProps: () => props,
    defineEmits: () => () => {},
    require(name) {
      if (name === 'vue') return {
        ref: (value) => ({ value }),
        watch: (getter, callback) => { hooks.initialRender = callback() },
        onMounted: (fn) => { hooks.mount = fn },
        onBeforeUnmount: (fn) => { hooks.unmount = fn },
      }
      if (name.includes('stripComposer')) return {
        composeStrip: options.compose ?? (async () => blob),
        getStripFilename: () => 'test-strip.png',
      }
      if (name.includes('coupleAlbum')) return {
        isCoupleAlbumReady: options.availability ?? (async () => true),
        sendStripToCouple: async (...args) => { sends.push(args); if (options.send) await options.send(...args) },
      }
      throw new Error(`Unexpected import ${name}`)
    },
  }
  vm.runInNewContext(compiled, context)
  return { api: context.api, hooks, sends, blob, revoked }
}

test('auto-save waits for the composed strip when configuration arrives first', async () => {
  const composition = deferred()
  const state = setup({ compose: () => composition.promise })
  await state.hooks.mount()
  assert.equal(state.sends.length, 0)
  composition.resolve(state.blob)
  await flush()
  assert.equal(state.sends.length, 1)
  assert.equal(state.api.isAlbumSaved.value, true)
  state.api.maybeAutoSave()
  state.api.maybeAutoSave()
  assert.equal(state.sends.length, 1)
})

test('auto-save starts when configuration arrives after strip composition', async () => {
  const availability = deferred()
  const state = setup({ availability: () => availability.promise })
  const mounted = state.hooks.mount()
  await flush()
  assert.equal(state.api.previewUrl.value, 'blob:test-strip')
  assert.equal(state.sends.length, 0)
  availability.resolve(true)
  await mounted
  await flush()
  assert.equal(state.sends.length, 1)
  assert.equal(state.api.isAlbumSaved.value, true)
})

test('unconfigured album keeps download preview available without claiming saved', async () => {
  const state = setup({ availability: async () => false })
  await state.hooks.mount()
  await flush()
  assert.equal(state.sends.length, 0)
  assert.equal(state.api.previewUrl.value, 'blob:test-strip')
  assert.equal(state.api.isAlbumSaved.value, false)
})

test('failed auto-save requires explicit retry and retains the same upload ID', async () => {
  let attempts = 0
  const state = setup({ send: async () => { if (++attempts === 1) throw new Error('Please retry saving') } })
  await state.hooks.mount()
  await flush()
  assert.equal(state.api.isAlbumSaved.value, false)
  assert.match(state.api.albumError.value, /retry/)
  state.api.maybeAutoSave()
  assert.equal(state.sends.length, 1)
  await state.api.saveToCouple()
  assert.equal(state.sends.length, 2)
  assert.equal(state.sends[0][2], state.sends[1][2])
  assert.equal(state.api.isAlbumSaved.value, true)
  assert.equal(state.api.albumError.value, '')
})

test('leaving aborts an in-flight save and does not show a stale success', async () => {
  const upload = deferred()
  const state = setup({ send: () => upload.promise })
  await state.hooks.mount()
  await flush()
  assert.equal(state.api.isAlbumSaving.value, true)
  assert.equal(state.api.isAlbumSaved.value, false)
  state.hooks.unmount()
  assert.equal(state.sends[0][3].aborted, true)
  upload.resolve()
  await flush()
  assert.equal(state.api.isAlbumSaved.value, false)
  assert.deepEqual(state.revoked, ['blob:test-strip'])
})
