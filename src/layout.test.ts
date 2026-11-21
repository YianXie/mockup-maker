import { describe, expect, it } from 'vitest'
import { getDevice } from './devices/catalog'
import { canvasSize, frameBox, imageRect, placeDevice, placeOriented, screenRectOnCanvas } from './layout'

const frame = { w: 1000, h: 2000 }

describe('canvasSize', () => {
  it('presets', () => {
    expect(canvasSize('16:9', frame)).toEqual({ w: 3840, h: 2160 })
    expect(canvasSize('4:3', frame)).toEqual({ w: 3840, h: 2880 })
    expect(canvasSize('1:1', frame)).toEqual({ w: 3840, h: 3840 })
    expect(canvasSize('9:16', frame)).toEqual({ w: 2160, h: 3840 })
  })
  it('tight canvas', () => {
    expect(canvasSize('tight', frame)).toEqual({ w: Math.round((1320 * 3840) / 2320), h: 3840 })
  })
})

describe('placeDevice', () => {
  it('centers at size', () => {
    const p = placeDevice({ w: 3840, h: 2160 }, frame, '16:9', 0.8)
    expect(p.scale).toBeCloseTo(0.864, 6)
    expect(p.x).toBeCloseTo((3840 - 1000 * 0.864) / 2, 6)
    expect(p.y).toBeCloseTo((2160 - 2000 * 0.864) / 2, 6)
  })
  it('tight ignores size', () => {
    const c = canvasSize('tight', frame)
    const a = placeDevice(c, frame, 'tight', 0.5)
    const b = placeDevice(c, frame, 'tight', 0.95)
    expect(a).toEqual(b)
    expect(a.y / c.h).toBeCloseTo(160 / 2320, 6)
  })
})

describe('frameBox', () => {
  it('landscape swaps for phones, not laptops', () => {
    const phone = getDevice('iphone-17')!
    const p = frameBox(phone, 'portrait')
    expect(frameBox(phone, 'landscape')).toEqual({ w: p.h, h: p.w })
    const mac = getDevice('macbook-pro-14-notch')!
    expect(frameBox(mac, 'landscape')).toEqual(frameBox(mac, 'portrait'))
  })
})

describe('screenRectOnCanvas', () => {
  it('landscape is wide', () => {
    const d = getDevice('iphone-17')!
    const p = placeOriented({ w: 3840, h: 2160 }, d, 'landscape', '16:9', 0.8)
    expect(p.rotated).toBe(true)
    const r = screenRectOnCanvas(d, p)
    expect(r.w).toBeGreaterThan(r.h)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(3840)
  })
  it('portrait maps straight', () => {
    const d = getDevice('iphone-17')!
    const p = { x: 10, y: 20, scale: 2, rotated: false }
    const s = d.geometry.screen
    expect(screenRectOnCanvas(d, p)).toEqual({ x: 10 + s.x * 2, y: 20 + s.y * 2, w: s.w * 2, h: s.h * 2 })
  })
})

describe('imageRect', () => {
  const screen = { x: 0, y: 0, w: 100, h: 200 }
  it('fill crops center', () => {
    expect(imageRect({ w: 1000, h: 1000 }, screen, 'fill')).toEqual({ x: -50, y: 0, w: 200, h: 200 })
  })
  it('fit letterboxes', () => {
    expect(imageRect({ w: 1000, h: 1000 }, screen, 'fit')).toEqual({ x: 0, y: 50, w: 100, h: 100 })
  })
  it('extreme strip stays finite', () => {
    for (const fit of ['fill', 'fit'] as const) {
      const r = imageRect({ w: 100, h: 4000 }, screen, fit)
      for (const n of Object.values(r)) expect(Number.isFinite(n)).toBe(true)
      expect(r.w).toBeGreaterThan(0)
      expect(r.h).toBeGreaterThan(0)
    }
  })
})
