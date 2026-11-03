import { createSaveStripHandler } from '../server/saveStrip.js'

export const maxDuration = 60
export default createSaveStripHandler(() => ({
  url: process.env.GOOGLE_DRIVE_UPLOAD_URL,
  secret: process.env.GOOGLE_DRIVE_UPLOAD_SECRET,
}))
