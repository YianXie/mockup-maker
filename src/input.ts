import { exportSize, render } from './draw/render'
import type { Scene, SceneImage } from './scene'

export const IMAGE_ERROR = "Couldn't read that image. Try a PNG or JPG."

/** First file whose MIME type is an image, or null. */
export function pickImageFile(files: ArrayLike<File> | null | undefined): File | null {
  if (!files) return null
  for (let i = 0; i < files.length; i++) if (files[i].type.startsWith('image/')) return files[i]
  return null
}

/** Decodes an image file locally. Rejects with Error('unreadable') if the browser can't decode it. */
export async function loadImage(file: File): Promise<SceneImage> {
  try {
    return await createImageBitmap(file)
  } catch {
    // Fallback: some browsers decode formats via <img> that createImageBitmap rejects (or lack it).
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('unreadable'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Renders the scene at full export size (no checkerboard/placeholder) and returns a PNG blob. */
export function exportPng(scene: Scene): Promise<Blob> {
  const size = exportSize(scene)
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  render(canvas.getContext('2d')!, scene, 1, { preview: false })
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/png'))
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
