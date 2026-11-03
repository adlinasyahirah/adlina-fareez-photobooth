import type { IncomingMessage, ServerResponse } from 'node:http'

export interface DriveConfig { url?: string; secret?: string }
const MAX_PNG_BYTES = 3 * 1024 * 1024
const MAX_JSON_BYTES = Math.ceil(MAX_PNG_BYTES / 3) * 4 + 2048
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export function isDriveConfigured(config: DriveConfig): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(config.url ?? '')
    && (config.secret?.length ?? 0) >= 32
}

export function validateStripPayload(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Invalid upload.')
  const { image, frameId, uploadId } = body as Record<string, unknown>
  if (typeof frameId !== 'string' || !/^frame-[123]-[123]$/.test(frameId)) throw new Error('Choose a valid strip.')
  if (typeof uploadId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(uploadId)) throw new Error('Invalid upload identifier.')
  if (typeof image !== 'string' || image.length > MAX_JSON_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new Error('Invalid PNG data.')
  const bytes = Buffer.from(image, 'base64')
  if (bytes.length > MAX_PNG_BYTES) throw new Error('This strip is too large. Please download it instead.')
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Only PNG strips are accepted.')
  const sizes: Record<string, [number, number]> = { '1': [1080, 1350], '2': [1080, 1920], '3': [600, 1800] }
  const expected = sizes[frameId.slice(-1)]!
  if (bytes.readUInt32BE(16) !== expected[0] || bytes.readUInt32BE(20) !== expected[1]) throw new Error('The strip size does not match your layout.')
  return { image, frameId, uploadId, fileName: `adlina-fareez-2026-11-21-${frameId}-${uploadId}.png` }
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (request.body !== undefined) {
    if (typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
      if (Buffer.byteLength(JSON.stringify(request.body)) > MAX_JSON_BYTES) throw new Error('Upload is too large.')
      return request.body
    }
    const text = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : String(request.body)
    if (Buffer.byteLength(text) > MAX_JSON_BYTES) throw new Error('Upload is too large.')
    return JSON.parse(text)
  }
  const chunks: Buffer[] = []
  let size = 0
  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size <= MAX_JSON_BYTES) chunks.push(chunk)
    })
    request.on('end', resolve)
    request.on('error', reject)
    request.on('aborted', () => reject(new Error('Upload cancelled.')))
  })
  if (size > MAX_JSON_BYTES) throw new Error('Upload is too large.')
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function createSaveStripHandler(getConfig: () => DriveConfig, send: typeof fetch = fetch) {
  return async (request: IncomingMessage & { body?: unknown }, response: ServerResponse): Promise<void> => {
    const reply = (status: number, body: Record<string, unknown>) => {
      response.statusCode = status
      response.setHeader('Content-Type', 'application/json')
      response.setHeader('Cache-Control', 'no-store')
      response.end(JSON.stringify(body))
    }
    const config = getConfig()
    if (request.method === 'GET') { reply(200, { enabled: isDriveConfigured(config) }); return }
    if (request.method !== 'POST') { response.setHeader('Allow', 'GET, POST'); reply(405, { error: 'Method not allowed.' }); return }
    if (request.headers['sec-fetch-site'] === 'cross-site') { reply(403, { error: 'Open the photobooth to send your strip.' }); return }
    if (!isDriveConfigured(config)) { reply(503, { error: 'The couple’s album is not connected yet. Please download your strip for now.' }); return }
    if (!request.headers['content-type']?.startsWith('application/json')) { reply(415, { error: 'Use a PNG strip upload.' }); return }
    if (Number(request.headers['content-length'] ?? 0) > MAX_JSON_BYTES) { reply(413, { error: 'This strip is too large. Please download it instead.' }); return }
    let payload: ReturnType<typeof validateStripPayload>
    try { payload = validateStripPayload(await readJson(request)) }
    catch (error) { reply(400, { error: error instanceof Error ? error.message : 'Invalid strip.' }); return }
    try {
      const upstream = await send(config.url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, secret: config.secret }),
        redirect: 'follow',
        signal: AbortSignal.timeout(45000),
      })
      if (!upstream.ok) throw new Error('Drive upload failed')
      const result = await upstream.json() as { ok?: boolean }
      if (result.ok !== true) throw new Error('Drive upload failed')
      // Never return the private Drive URL, folder contents, or credentials to guests.
      reply(200, { saved: true })
    } catch { reply(502, { error: 'Your strip was not confirmed as saved. Please try again or download it. Retrying will not create a duplicate.' }) }
  }
}
