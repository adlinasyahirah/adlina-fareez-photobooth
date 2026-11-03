import type { WeddingFrame } from '../data/frames'

export async function isCoupleAlbumReady(signal: AbortSignal): Promise<boolean> {
  const response = await fetch('/api/save-strip', { signal, cache: 'no-store' })
  if (!response.ok) return false
  const result = await response.json() as { enabled?: boolean }
  return result.enabled === true
}

export async function sendStripToCouple(blob: Blob, frame: WeddingFrame, uploadId: string, signal: AbortSignal): Promise<void> {
  if (blob.size > 3 * 1024 * 1024) throw new Error('This strip is too large to send. Please download it instead.')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)))
  }
  const response = await fetch('/api/save-strip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: btoa(parts.join('')), frameId: frame.id, uploadId }),
    signal,
  })
  let result: { saved?: boolean; error?: string }
  try { result = await response.json() as typeof result }
  catch { throw new Error('Your strip could not be sent. Please try again or download it.') }
  if (!response.ok || result.saved !== true) throw new Error(result.error ?? 'Your strip was not confirmed as saved. Please try again or download it.')
}
