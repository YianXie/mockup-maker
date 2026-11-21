import { afterEach, describe, expect, it, vi } from 'vitest'
import { IMAGE_ERROR, loadImage, pickImageFile } from './input'

const f = (name: string, type: string) => new File(['x'], name, { type })

describe('pickImageFile', () => {
  it('skips non-images and takes the first image', () => {
    expect(pickImageFile([f('text.txt', 'text/plain'), f('b.png', 'image/png'), f('c.jpg', 'image/jpeg')])?.name).toBe('b.png')
  })
  it('returns null when there is no image', () => {
    expect(pickImageFile([])).toBeNull()
    expect(pickImageFile(null)).toBeNull()
    expect(pickImageFile(undefined)).toBeNull()
    expect(pickImageFile([f('a.pdf', 'application/pdf')])).toBeNull()
  })
})

describe('loadImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rejects garbage', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('decode')))
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    class BadImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) { queueMicrotask(() => this.onerror?.()) }
    }
    vi.stubGlobal('Image', BadImage)
    await expect(loadImage(f('x.png', 'image/png'))).rejects.toThrow('unreadable')
  })

  it('uses createImageBitmap when it works', async () => {
    const bmp = { width: 10, height: 20 }
    vi.stubGlobal('createImageBitmap', () => Promise.resolve(bmp))
    await expect(loadImage(f('x.png', 'image/png'))).resolves.toBe(bmp)
  })

  it('has the exact error copy', () => {
    expect(IMAGE_ERROR).toBe("Couldn't read that image. Try a PNG or JPG.")
  })
})
