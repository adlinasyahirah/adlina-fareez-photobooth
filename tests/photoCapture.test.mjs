import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const utilitySource = readFileSync(new URL('../src/utils/photoCapture.ts', import.meta.url), 'utf8')
const componentSource = readFileSync(new URL('../src/components/CameraPreviewScreen.vue', import.meta.url), 'utf8')
  .split('<script setup lang="ts">')[1].split('</script>')[0]
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function loadUtilities(overrides = {}) {
  const context = { exports: {}, DOMException, setTimeout, clearTimeout, ...overrides }
  vm.runInNewContext(compile(utilitySource), context)
  return context.exports
}

function setupCamera(photoCount, options = {}) {
  const hooks = {}
  let serial = 0
  let stopped = 0
  const track = { stop() { stopped++ }, addEventListener() {} }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const vue = {
    ref: (value) => ({ value }),
    computed: (getter) => ({ get value() { return getter() } }),
    nextTick: async () => {},
    onMounted: (fn) => { hooks.mount = fn },
    onBeforeUnmount: (fn) => { hooks.unmount = fn },
  }
  const tickHistory = []
  const context = {
    exports: {}, DOMException, AbortController,
    require(name) {
      if (name === 'vue') return vue
      if (name.includes('coupleAlbum')) return { isCoupleAlbumReady: async () => false }
      if (name.includes('photoCapture')) return {
        waitForCaptureFeedback: options.waitForCaptureFeedback ?? (async () => {}),
        captureVideoFrame: () => ({ url: `photo-${++serial}`, width: 1280, height: 960 }),
        runCountdown: options.runCountdown ?? (async (onTick) => {
          for (const tick of [3, 2, 1]) { tickHistory.push(tick); onTick(tick) }
        }),
      }
      throw new Error(`Unexpected import: ${name}`)
    },
    defineProps: () => ({ frame: { id: 'frame-3-1', name: 'Dusty Rose', photoCount } }),
    defineEmits: () => () => {},
    window: { isSecureContext: true, addEventListener() {}, removeEventListener() {} },
    document: { hidden: false, addEventListener(name, fn) { hooks[name] = fn }, removeEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: options.getUserMedia ?? (async () => stream) } },
  }
  vm.runInNewContext(compile(componentSource + `\nglobalThis.api = { video, photos, isReview, isCapturing, isStarting, isActive, countdown, capturedPose, errorMessage, retakeIndex, startCamera, stopCamera, capturePhotos, retakePhoto, retakeAll, cancelCapture };`), context)
  const api = context.api
  api.video.value = { readyState: 4, videoWidth: 1280, videoHeight: 960, srcObject: null, async play() {} }
  hooks.mount()
  return { api, hooks, context, tickHistory, stopped: () => stopped }
}

test('cover crop centres portrait and widescreen camera frames', () => {
  const { getCoverCrop } = loadUtilities()
  const portrait = getCoverCrop(720, 1280, 4 / 3)
  assert.equal(portrait.x, 0)
  assert.equal(portrait.y, 370)
  assert.equal(portrait.height, 540)
  const wide = getCoverCrop(1920, 1080, 4 / 3)
  assert.equal(wide.x, 240)
  assert.equal(wide.width, 1440)
  assert.equal(wide.height, 1080)
  assert.throws(() => getCoverCrop(0, 1080, 4 / 3))
})

test('capture mirrors the preview, limits size, and encodes JPEG', () => {
  const calls = []
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ translate: (...args) => calls.push(['translate', ...args]), scale: (...args) => calls.push(['scale', ...args]), drawImage: (...args) => calls.push(['draw', ...args]) }),
    toDataURL: (format, quality) => { assert.equal(format, 'image/jpeg'); assert.equal(quality, .92); return 'data:image/jpeg;base64,test' },
  }
  const { captureVideoFrame } = loadUtilities({ document: { createElement: () => canvas } })
  const photo = captureVideoFrame({ readyState: 4, videoWidth: 1920, videoHeight: 1080 })
  assert.equal(photo.width, 1280)
  assert.equal(photo.height, 960)
  assert.deepEqual(calls[0], ['translate', 1280, 0])
  assert.deepEqual(calls[1], ['scale', -1, 1])
  assert.throws(() => captureVideoFrame({ readyState: 1 }))
})

test('real countdown runs 3, 2, 1 with one delay per tick', async () => {
  const delays = []
  const { runCountdown } = loadUtilities({ setTimeout(fn, ms) { delays.push(ms); queueMicrotask(fn); return 1 }, clearTimeout() {} })
  const ticks = []
  await runCountdown((tick) => ticks.push(tick), new AbortController().signal)
  assert.deepEqual(ticks, [3, 2, 1])
  assert.deepEqual(delays, [1000, 1000, 1000])
})

test('cancelled countdown clears its timer and cannot advance', async () => {
  let cleared = false
  const { runCountdown } = loadUtilities({ setTimeout() { return 12 }, clearTimeout(id) { assert.equal(id, 12); cleared = true } })
  const controller = new AbortController()
  const ticks = []
  const pending = runCountdown((tick) => ticks.push(tick), controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(cleared, true)
  assert.deepEqual(ticks, [3])
})

for (const count of [1, 2, 3]) {
  test(`${count}-photo session counts down for every slot and stops camera on review`, async () => {
    const { api, tickHistory, stopped } = setupCamera(count)
    await api.startCamera()
    await api.capturePhotos()
    assert.equal(api.photos.value.length, count)
    assert.equal(tickHistory.length, count * 3)
    assert.equal(api.isReview.value, true)
    assert.equal(api.isActive.value, false)
    assert.equal(api.isCapturing.value, false)
    assert.equal(stopped(), 1)
  })
}

test('retaking one slot preserves all other photos', async () => {
  const { api } = setupCamera(3)
  await api.startCamera()
  await api.capturePhotos()
  const originals = Array.from(api.photos.value, (photo) => photo.url)
  await api.retakePhoto(1)
  assert.equal(api.retakeIndex.value, 1)
  await api.capturePhotos()
  assert.equal(api.photos.value[0].url, originals[0])
  assert.notEqual(api.photos.value[1].url, originals[1])
  assert.equal(api.photos.value[2].url, originals[2])
  assert.equal(api.photos.value.length, 3)
  assert.equal(api.isReview.value, true)
})

test('retake all starts a fresh camera session', async () => {
  const { api } = setupCamera(2)
  await api.startCamera()
  await api.capturePhotos()
  await api.retakeAll()
  assert.equal(api.photos.value.length, 0)
  assert.equal(api.isReview.value, false)
  assert.equal(api.isActive.value, true)
})

for (const reason of ['cancel', 'hidden tab', 'unmount']) {
  test(`${reason} aborts capture without taking another photo`, async () => {
    const { api, context, hooks } = setupCamera(3, {
      runCountdown: (onTick, signal) => new Promise((resolve, reject) => {
        onTick(3)
        signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
      }),
    })
    await api.startCamera()
    const pending = api.capturePhotos()
    if (reason === 'cancel') api.cancelCapture()
    else if (reason === 'hidden tab') { context.document.hidden = true; hooks.visibilitychange() }
    else hooks.unmount()
    await pending
    assert.equal(api.photos.value.length, 0)
    assert.equal(api.isCapturing.value, false)
    assert.equal(api.countdown.value, null)
  })
}

test('camera that has not produced a video frame cannot capture', async () => {
  const { api } = setupCamera(1)
  await api.startCamera()
  api.video.value.readyState = 1
  await api.capturePhotos()
  assert.equal(api.photos.value.length, 0)
  assert.match(api.errorMessage.value, /warming up/)
})

test('permission denied shows recovery instructions', async () => {
  const { api } = setupCamera(1, { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError') } })
  await api.startCamera()
  assert.equal(api.isActive.value, false)
  assert.equal(api.isStarting.value, false)
  assert.match(api.errorMessage.value, /permission/)
})


test('capture confirmation holds each photo before the next countdown and review', async () => {
  let release
  const holds = []
  const { api, tickHistory } = setupCamera(2, {
    waitForCaptureFeedback: () => new Promise((resolve) => { release = resolve; holds.push(resolve) }),
  })
  await api.startCamera()
  const pending = api.capturePhotos()
  await new Promise(setImmediate)
  assert.equal(api.photos.value.length, 1)
  assert.equal(api.capturedPose.value.url, 'photo-1')
  assert.equal(api.isReview.value, false)
  assert.equal(tickHistory.length, 3)
  release()
  await new Promise(setImmediate)
  await new Promise(setImmediate)
  assert.equal(api.photos.value.length, 2)
  assert.equal(api.capturedPose.value.url, 'photo-2')
  assert.equal(api.isReview.value, false)
  assert.equal(holds.length, 2)
  release()
  await pending
  assert.equal(api.isReview.value, true)
  assert.equal(api.capturedPose.value, null)
})

test('pausing during shutter feedback preserves the taken shot and cancels the next shot', async () => {
  const { api } = setupCamera(3, {
    waitForCaptureFeedback: (signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
    }),
  })
  await api.startCamera()
  const pending = api.capturePhotos()
  await new Promise(setImmediate)
  assert.equal(api.photos.value.length, 1)
  api.cancelCapture()
  await pending
  assert.equal(api.photos.value.length, 1)
  assert.equal(api.capturedPose.value, null)
  assert.equal(api.isCapturing.value, false)
})

test('shutter feedback waits 1200ms and can be aborted', async () => {
  let cleared = false
  const { waitForCaptureFeedback } = loadUtilities({
    setTimeout(fn, ms) { assert.equal(ms, 1200); return 9 },
    clearTimeout(id) { assert.equal(id, 9); cleared = true },
  })
  const controller = new AbortController()
  const pending = waitForCaptureFeedback(controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(cleared, true)
})
