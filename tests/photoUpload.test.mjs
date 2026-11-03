import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const cropContext = { exports: {} }
vm.runInNewContext(compile(readFileSync(new URL('src/utils/photoCapture.ts', root), 'utf8')), cropContext)
const uploadSource = compile(readFileSync(new URL('src/utils/photoUpload.ts', root), 'utf8'))
const componentSource = readFileSync(new URL('src/components/PhotoUploadScreen.vue', root), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0]
const file = (name = 'photo.jpg') => ({ name, type: 'image/jpeg', size: 1024 })
const flush = () => new Promise(setImmediate)

function loadUpload(options = {}) {
  const revoked = [], draws = []
  let created = 0
  class FakeImage {
    naturalWidth = options.width ?? 3000
    naturalHeight = options.height ?? 4000
    set src(value) {
      if (value && !options.pending) queueMicrotask(() => {
        if (options.decodeError) this.onerror?.()
        else this.onload?.()
      })
    }
  }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillRect() {}, drawImage: (...args) => draws.push(args) }),
    toDataURL: (type) => { assert.equal(type, 'image/jpeg'); return 'data:image/jpeg;base64,prepared' },
  }
  const context = {
    exports: {}, DOMException, Error,
    require: () => cropContext.exports,
    URL: { createObjectURL: () => { created++; return 'blob:source' }, revokeObjectURL: (url) => revoked.push(url) },
    Image: FakeImage,
    document: { createElement: () => canvas },
  }
  vm.runInNewContext(uploadSource, context)
  return { ...context.exports, revoked, draws, canvas, created: () => created }
}

function setupScreen(count, options = {}) {
  const hooks = {}
  const prepared = []
  const refs = { scrolls: 0 }
  const context = {
    exports: {}, AbortController, DOMException, Error,
    defineProps: () => ({ frame: { photoCount: count, layout: { slots: Array.from({ length: count }, () => ({ width: 864, height: 623 })) } } }),
    defineEmits: () => () => {},
    window: { scrollTo() { refs.scrolls++ } },
    require(name) {
      if (name === 'vue') return {
        ref: (value) => ({ value }), computed: (getter) => ({ get value() { return getter() } }), nextTick: async () => {},
        onMounted: (fn) => { hooks.mount = fn }, onBeforeUnmount: (fn) => { hooks.unmount = fn },
      }
      if (name.includes('photoUpload')) return {
        getPhotoTargets: loadUpload().getPhotoTargets,
        prepareUploadedPhoto: options.prepare ?? (async (photo) => { prepared.push(photo.name); return { url: `prepared:${photo.name}`, width: 1280, height: 923 } }),
      }
      if (name.includes('coupleAlbum')) return { isCoupleAlbumReady: async () => true }
      throw new Error(name)
    },
  }
  const exposed = 'globalThis.api = { photos, fileInput, errorMessage, isReview, isProcessing, canCreate, completedPhotos, choosePhotos, selectFiles, movePhoto, createStrip, startAgain };'
  vm.runInNewContext(compile(componentSource + '\n' + exposed), context)
  const api = context.api
  api.fileInput.value = { value: '', multiple: true, click() {} }
  hooks.mount()
  return { api, hooks, prepared }
}
const selection = (...files) => ({ target: { files, value: 'selection' } })

test('photo validation accepts supported files and rejects oversized or non-image files', () => {
  const { validatePhotoFile } = loadUpload()
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) assert.doesNotThrow(() => validatePhotoFile({ ...file(), type }))
  assert.doesNotThrow(() => validatePhotoFile({ name: 'IMG.HEIC', type: '', size: 1024 }))
  assert.throws(() => validatePhotoFile({ ...file(), type: 'text/html' }), /choose a JPG/)
  assert.throws(() => validatePhotoFile({ ...file(), size: 16 * 1024 * 1024 }), /15 MB/)
  assert.throws(() => validatePhotoFile({ ...file(), size: 0 }), /empty/)
})

test('photo targeting fills gaps in order, replaces one slot and rejects excess selections', () => {
  const { getPhotoTargets } = loadUpload()
  assert.deepEqual(Array.from(getPhotoTargets(3, [false, true, false], null, 2)), [0, 2])
  assert.deepEqual(Array.from(getPhotoTargets(3, [true, true, true], 1, 1)), [1])
  assert.throws(() => getPhotoTargets(2, [false, false], null, 3), /up to 2/)
  assert.throws(() => getPhotoTargets(2, [true, false], 0, 2), /one photo/)
})

test('gallery preparation crops and resizes without mirroring, then releases the source image', async () => {
  const upload = loadUpload()
  const photo = await upload.prepareUploadedPhoto(file(), 1.5, new AbortController().signal)
  assert.equal(photo.width, 1600)
  assert.equal(photo.height, 1067)
  assert.equal(upload.draws.length, 1)
  assert.equal(upload.draws[0][1], 0)
  assert.equal(upload.draws[0][2], 1000)
  assert.deepEqual(upload.revoked, ['blob:source'])
  assert.equal(upload.canvas.width, 0)
})

test('unsupported browser decode (including HEIC) reports a useful error and releases the URL', async () => {
  const upload = loadUpload({ decodeError: true })
  await assert.rejects(upload.prepareUploadedPhoto(file(), 4 / 3, new AbortController().signal), /JPG or PNG/)
  assert.deepEqual(upload.revoked, ['blob:source'])
})

test('aborting image loading releases its URL without creating a prepared photo', async () => {
  const upload = loadUpload({ pending: true })
  const controller = new AbortController()
  const pending = upload.prepareUploadedPhoto(file(), 4 / 3, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.deepEqual(upload.revoked, ['blob:source'])
  assert.equal(upload.draws.length, 0)
})

for (const count of [1, 2, 3]) {
  test(`${count}-photo upload only enters the finished strip after every slot is filled`, async () => {
    const { api } = setupScreen(count)
    await api.createStrip()
    assert.equal(api.isReview.value, false)
    await api.selectFiles(selection(...Array.from({ length: count }, (_, i) => file(`photo-${i}.jpg`))))
    assert.equal(api.completedPhotos.value.length, count)
    assert.equal(api.canCreate.value, true)
    assert.equal(api.isReview.value, false)
    await api.createStrip()
    assert.equal(api.isReview.value, true)
  })
}

test('replacing and reordering photos preserves other selected images', async () => {
  const { api } = setupScreen(3)
  await api.selectFiles(selection(file('one.jpg'), file('two.jpg'), file('three.jpg')))
  api.choosePhotos(1)
  await api.selectFiles(selection(file('replacement.jpg')))
  assert.deepEqual(Array.from(api.photos.value, (photo) => photo.url), ['prepared:one.jpg', 'prepared:replacement.jpg', 'prepared:three.jpg'])
  api.movePhoto(1, -1)
  assert.deepEqual(Array.from(api.photos.value, (photo) => photo.url), ['prepared:replacement.jpg', 'prepared:one.jpg', 'prepared:three.jpg'])
})

test('a failed batch does not discard existing photos or apply a partial selection', async () => {
  const { api } = setupScreen(3, { prepare: async (photo) => {
    if (photo.name === 'bad.jpg') throw new Error('This photo is unreadable')
    return { url: photo.name, width: 1280, height: 960 }
  } })
  await api.selectFiles(selection(file('existing.jpg')))
  await api.selectFiles(selection(file('new.jpg'), file('bad.jpg')))
  assert.deepEqual(Array.from(api.photos.value, (photo) => photo?.url ?? null), ['existing.jpg', null, null])
  assert.match(api.errorMessage.value, /unreadable/)
  assert.equal(api.isProcessing.value, false)
})

test('selecting too many photos gives an error without processing any file', async () => {
  const { api, prepared } = setupScreen(1)
  await api.selectFiles(selection(file('one.jpg'), file('two.jpg')))
  assert.equal(prepared.length, 0)
  assert.match(api.errorMessage.value, /one photo/)
})

test('leaving during image processing cancels it without applying results', async () => {
  let resolve
  let signal
  const { api, hooks } = setupScreen(1, { prepare: (file, ratio, uploadSignal) => {
    signal = uploadSignal
    return new Promise((done) => { resolve = done })
  } })
  const pending = api.selectFiles(selection(file()))
  await flush()
  hooks.unmount()
  assert.equal(signal.aborted, true)
  resolve({ url: 'late-photo', width: 1280, height: 960 })
  await pending
  assert.equal(api.photos.value[0], null)
})

test('choosing new photos clears the completed upload session', async () => {
  const { api } = setupScreen(1)
  await api.selectFiles(selection(file()))
  await api.createStrip()
  await api.startAgain()
  assert.equal(api.isReview.value, false)
  assert.equal(api.photos.value[0], null)
  assert.equal(api.canCreate.value, false)
})
