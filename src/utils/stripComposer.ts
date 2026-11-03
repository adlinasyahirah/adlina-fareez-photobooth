import type { WeddingFrame } from '../data/frames'
import { getCoverCrop, type CapturedPhoto } from './photoCapture'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error('An image has no usable dimensions.'))
      else resolve(image)
    }
    image.onerror = () => reject(new Error('A strip image could not load. Please try again.'))
    image.src = url
  })
}

export function getStripFilename(frame: WeddingFrame): string {
  const theme = frame.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `adlina-fareez-2026-11-21-${theme}-${frame.photoCount}-photo-strip.png`
}

/** Compose at the original artwork resolution; captures are already mirrored. */
export async function composeStrip(frame: WeddingFrame, photos: CapturedPhoto[]): Promise<Blob> {
  const { width, height, slots } = frame.layout
  if (photos.length !== frame.photoCount || slots.length !== frame.photoCount) {
    throw new Error('Complete all photos before creating your strip.')
  }
  const [overlay, ...images] = await Promise.all([
    loadImage(frame.overlay),
    ...photos.map((photo) => loadImage(photo.url)),
  ])
  if (!overlay || overlay.naturalWidth !== width || overlay.naturalHeight !== height) {
    throw new Error('The strip artwork does not match this layout.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create the strip. Please try again.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    slots.forEach((slot, index) => {
      const image = images[index]
      if (!image) throw new Error('A photo is missing from this strip.')
      const crop = getCoverCrop(image.naturalWidth, image.naturalHeight, slot.width / slot.height)
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, slot.x, slot.y, slot.width, slot.height)
    })
    // Transparent photo windows keep the original flowers, borders and typography on top.
    context.drawImage(overlay, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The strip could not be saved. Please try again.')), 'image/png')
    })
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
