import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const serverContext = { exports: {}, Buffer, fetch, AbortSignal }
vm.runInNewContext(compile(readFileSync(new URL('server/saveStrip.ts', root), 'utf8')), serverContext)
const { createSaveStripHandler, validateStripPayload } = serverContext.exports
const config = { url: 'https://script.google.com/macros/s/test-deployment/exec', secret: 'test-only-secret-not-a-real-credential-123456789' }
const uploadId = '12345678-1234-4123-8123-123456789abc'
function payload() {
  const bytes = Buffer.alloc(33)
  Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes)
  bytes.write('IHDR', 12)
  bytes.writeUInt32BE(1080, 16)
  bytes.writeUInt32BE(1350, 20)
  return { image: bytes.toString('base64'), frameId: 'frame-3-1', uploadId }
}
async function invoke({ method = 'POST', body = payload(), headers = {}, configured = true, send, raw = false } = {}) {
  const request = Readable.from(raw ? [Buffer.from(JSON.stringify(body))] : [])
  request.method = method
  request.headers = { 'content-type': 'application/json', ...headers }
  if (!raw) request.body = body
  let status, result
  const response = { set statusCode(value) { status = value }, setHeader() {}, end(value) { result = JSON.parse(value) } }
  const handler = createSaveStripHandler(() => configured ? config : {}, send ?? (async () => ({ ok: true, json: async () => ({ ok: true }) })))
  await handler(request, response)
  return { status, result }
}

test('unconfigured album does not advertise saving and rejects uploads', async () => {
  assert.deepEqual(await invoke({ method: 'GET', configured: false }), { status: 200, result: { enabled: false } })
  assert.equal((await invoke({ configured: false })).status, 503)
})

test('availability response exposes no server secret', async () => {
  const response = await invoke({ method: 'GET' })
  assert.deepEqual(response.result, { enabled: true })
  assert.ok(!JSON.stringify(response).includes(config.secret))
})

test('valid upload forwards server secret but returns only confirmation to guest', async () => {
  let sent
  const response = await invoke({ send: async (url, options) => {
    assert.equal(url, config.url)
    sent = JSON.parse(options.body)
    return { ok: true, json: async () => ({ ok: true, privateUrl: 'never-return-this' }) }
  } })
  assert.equal(sent.secret, config.secret)
  assert.equal(sent.uploadId, uploadId)
  assert.equal(response.status, 200)
  assert.deepEqual(response.result, { saved: true })
})

test('local Vite raw request stream and Vercel parsed body are both accepted', async () => {
  assert.equal((await invoke({ raw: true })).status, 200)
  assert.equal((await invoke()).status, 200)
})

test('cross-site uploads and unsupported methods are rejected', async () => {
  assert.equal((await invoke({ headers: { 'sec-fetch-site': 'cross-site' } })).status, 403)
  assert.equal((await invoke({ method: 'DELETE' })).status, 405)
})

test('wrong file, layout, identifier, and oversized requests are rejected', async () => {
  assert.throws(() => validateStripPayload({ ...payload(), image: 'bm90LXBuZw==' }), /PNG/)
  assert.throws(() => validateStripPayload({ ...payload(), frameId: 'frame-3-2' }), /size/)
  assert.throws(() => validateStripPayload({ ...payload(), uploadId: '../invalid' }), /identifier/)
  assert.equal((await invoke({ headers: { 'content-length': String(6 * 1024 * 1024) } })).status, 413)
  assert.equal((await invoke({ headers: { 'content-type': 'text/plain' } })).status, 415)
})

test('upstream refusal never produces a false saved message', async () => {
  const response = await invoke({ send: async () => ({ ok: true, json: async () => ({ ok: false }) }) })
  assert.equal(response.status, 502)
  assert.equal(response.result.saved, undefined)
})

function loadAppsScript() {
  const files = new Set()
  const properties = { UPLOAD_SECRET: config.secret }
  let creates = 0
  let folderId
  const context = {
    console, Date, JSON, Number, String,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key], setProperties: (values) => Object.assign(properties, values) }) },
    Utilities: { base64Decode: (value) => [...Buffer.from(value, 'base64')], newBlob: (bytes, type, name) => ({ bytes, type, name }), formatDate: () => '2026-11-03' },
    LockService: { getScriptLock: () => ({ tryLock: () => true, hasLock: () => true, releaseLock() {} }) },
    DriveApp: { getFolderById: (id) => { folderId = id; return { getFilesByName: (name) => ({ hasNext: () => files.has(name) }), createFile: ({ name }) => { creates++; files.add(name) } } } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }) },
  }
  vm.runInNewContext(readFileSync(new URL('google-drive/Code.gs', root), 'utf8'), context)
  return { post: (body) => context.doPost({ postData: { contents: JSON.stringify(body) } }), creates: () => creates, folder: () => folderId, properties }
}

test('Apps Script saves to the requested folder and deduplicates retries', () => {
  const script = loadAppsScript()
  const body = { ...payload(), secret: config.secret }
  assert.equal(script.post(body).ok, true)
  assert.equal(script.post(body).ok, true)
  assert.equal(script.creates(), 1)
  assert.equal(script.folder(), '1-6fIRYcKmRnlqRhqp4r7BK9tYCOOGDI3')
})

test('Apps Script rejects incorrect secret without touching Drive', () => {
  const script = loadAppsScript()
  assert.equal(script.post({ ...payload(), secret: 'wrong' }).ok, false)
  assert.equal(script.creates(), 0)
})

test('Apps Script enforces the daily cap', () => {
  const script = loadAppsScript()
  script.properties.UPLOAD_DAY = '2026-11-03'
  script.properties.UPLOAD_COUNT = '1000'
  assert.equal(script.post({ ...payload(), secret: config.secret }).ok, false)
  assert.equal(script.creates(), 0)
})

function setupLeaveDialog() {
  const source = readFileSync(new URL('src/components/CapturedPhotosReview.vue', root), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0]
  const events = []
  let shown = 0
  const context = { exports: {}, require: () => ({ ref: (value) => ({ value }) }), defineProps: () => ({}), defineEmits: () => (event) => events.push(event) }
  vm.runInNewContext(compile(source + '\nglobalThis.dialogApi = { leaveDialog, pendingAction, isAlbumSaving, requestLeave, stayAndSave, continueLeaving };'), context)
  context.dialogApi.leaveDialog.value = { showModal() { shown++ }, close() {} }
  return { ...context.dialogApi, events, shown: () => shown }
}

test('both destructive actions wait for confirmation', () => {
  for (const action of ['restart', 'back']) {
    const dialog = setupLeaveDialog()
    dialog.requestLeave(action)
    assert.equal(dialog.shown(), 1)
    assert.deepEqual(dialog.events, [])
    dialog.continueLeaving()
    assert.deepEqual(dialog.events, [action])
    dialog.continueLeaving()
    assert.deepEqual(dialog.events, [action])
  }
})

test('go back and save preserves the session', () => {
  const dialog = setupLeaveDialog()
  dialog.requestLeave('restart')
  dialog.stayAndSave()
  dialog.continueLeaving()
  assert.deepEqual(dialog.events, [])
})

test('actions cannot discard the session during an album upload', () => {
  const dialog = setupLeaveDialog()
  dialog.isAlbumSaving.value = true
  dialog.requestLeave('back')
  assert.equal(dialog.shown(), 0)
  assert.deepEqual(dialog.events, [])
})
