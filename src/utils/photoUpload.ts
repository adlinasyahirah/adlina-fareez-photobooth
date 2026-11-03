import { getCoverCrop, type CapturedPhoto } from './photoCapture'

export const MAX_UPLOAD_PHOTO_BYTES = 15 * 1024 * 1024
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export function validatePhotoFile(file: Pick<File, 'name' | 'type' | 'size'>): void {
  const extensionAllowed = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  if (!TYPES.has(file.type.toLowerCase()) && !(file.type === '' && extensionAllowed)) {
    throw new Error('Please choose a JPG, PNG, WebP or HEIC photo.')
  }
  if (!file.size) throw new Error('This photo is empty. Please choose another one.')
  if (file.size > MAX_UPLOAD_PHOTO_BYTES) throw new Error('Please choose a photo smaller than 15 MB.')
}

export function getPhotoTargets(photoCount: number, filled: boolean[], replaceIndex: number | null, fileCount: number): number[] {
  if (filled.length !== photoCount || ![1, 2, 3].includes(photoCount)) throw new Error('Choose a valid strip first.')
  const targets = replaceIndex === null
    ? filled.flatMap((hasPhoto, index) => hasPhoto ? [] : [index])
    : [replaceIndex]
  if (targets.some((index) => index < 0 || index >= photoCount)) throw new Error('Choose a valid photo slot.')
  if (fileCount < 1 || fileCount > targets.length) {
    throw new Error(`Please choose ${targets.length === 1 ? 'one photo' : `up to ${targets.length} photos`} for the available slots.`)
  }
  return targets.slice(0, fileCount)
}

/** Decode locally, honour browser EXIF orientation and resize; gallery photos are never mirrored. */
export async function prepareUploadedPhoto(file: File, aspectRatio: number, signal: AbortSignal): Promise<CapturedPhoto> {
  validatePhotoFile(file)
  if (signal.aborted) throw new DOMException('Photo selection cancelled', 'AbortError')
  const url = URL.createObjectURL(file)
  const image = new Image()
  let canvas: HTMLCanvasElement | null = null
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', onAbort)
        image.onload = null
        image.onerror = null
      }
      const onAbort = () => {
        cleanup()
        image.src = ''
        reject(new DOMException('Photo selection cancelled', 'AbortError'))
      }
      image.onload = () => { cleanup(); resolve() }
      image.onerror = () => { cleanup(); reject(new Error('This photo could not open in your browser. Please choose a JPG or PNG version.')) }
      signal.addEventListener('abort', onAbort, { once: true })
      image.src = url
    })
    if (signal.aborted) throw new DOMException('Photo selection cancelled', 'AbortError')
    if (image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error('This photo is too large to process. Please choose a smaller version.')
    const crop = getCoverCrop(image.naturalWidth, image.naturalHeight, aspectRatio)
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(Math.min(crop.width, 1600)))
    canvas.height = Math.max(1, Math.round(canvas.width / aspectRatio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare this photo. Please try again.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
    return { url: canvas.toDataURL('image/jpeg', .92), width: canvas.width, height: canvas.height }
  } finally {
    image.onload = null
    image.onerror = null
    image.src = ''
    URL.revokeObjectURL(url)
    if (canvas) { canvas.width = 0; canvas.height = 0 }
  }
}
