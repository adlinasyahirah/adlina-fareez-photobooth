import stripLayouts from './stripLayouts.json'

export type PhotoCount = 1 | 2 | 3

export interface PhotoSlot {
  x: number
  y: number
  width: number
  height: number
}

export interface StripLayout {
  width: number
  height: number
  slots: PhotoSlot[]
}

export interface WeddingFrame {
  id: string
  name: string
  photoCount: PhotoCount
  image: string
  overlay: string
  layout: StripLayout
}

const images = import.meta.glob<string>('../assets/Strips*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const overlays = import.meta.glob<string>('../assets/overlays/Strips*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const themes = [
  { number: 1, name: 'Something Blue' },
  { number: 2, name: 'Ivory Garden' },
  { number: 3, name: 'Dusty Rose' },
] as const

export const weddingFrames: WeddingFrame[] = themes.flatMap((theme) =>
  ([1, 2, 3] as const).map((photoCount) => {
    const image = images[`../assets/Strips${theme.number}-${photoCount}.png`]
    const overlay = overlays[`../assets/overlays/Strips${theme.number}-${photoCount}.png`]
    if (!overlay) throw new Error(`Missing strip overlay: ${theme.number}-${photoCount}`)
    if (!image) throw new Error(`Missing frame: ${theme.number}-${photoCount}`)
    return {
      id: `frame-${theme.number}-${photoCount}`,
      name: theme.name,
      photoCount,
      image,
      overlay,
      layout: stripLayouts[photoCount],
    }
  }),
)
