export interface CapturedPhoto {
  url: string
  width: number
  height: number
}

export const CAPTURE_ASPECT_RATIO = 4 / 3

/** Match the centred object-fit: cover crop shown in the live viewfinder. */
export function getCoverCrop(width: number, height: number, aspectRatio: number) {
  if (![width, height, aspectRatio].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid camera dimensions')
  }
  const cropWidth = Math.min(width, height * aspectRatio)
  const cropHeight = Math.min(height, width / aspectRatio)
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight }
}

export function captureVideoFrame(video: HTMLVideoElement): CapturedPhoto {
  if (video.readyState < 2) throw new Error('Camera is not ready yet')
  const crop = getCoverCrop(video.videoWidth, video.videoHeight, CAPTURE_ASPECT_RATIO)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(Math.min(crop.width, 1280)))
  canvas.height = Math.max(1, Math.round(canvas.width / CAPTURE_ASPECT_RATIO))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Photo capture is not supported by this browser')
  // Keep the saved selfie consistent with the mirrored front camera preview.
  context.translate(canvas.width, 0)
  context.scale(-1, 1)
  context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
  return { url: canvas.toDataURL('image/jpeg', 0.92), width: canvas.width, height: canvas.height }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Countdown cancelled', 'AbortError'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Countdown cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function runCountdown(onTick: (seconds: number) => void, signal: AbortSignal): Promise<void> {
  for (const seconds of [3, 2, 1]) {
    if (signal.aborted) throw new DOMException('Countdown cancelled', 'AbortError')
    onTick(seconds)
    await delay(1000, signal)
  }
}

/** Keep the captured pose visible before the next countdown or finished strip. */
export function waitForCaptureFeedback(signal: AbortSignal): Promise<void> {
  return delay(1200, signal)
}
