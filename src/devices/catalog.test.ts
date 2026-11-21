import { describe, expect, it } from 'vitest'
import { DEVICES, devicesByFamily, getDevice } from './catalog'
import type { Rect } from './types'

const inside = (a: Rect, b: Rect, eps = 1e-6) =>
  a.x >= b.x - eps && a.y >= b.y - eps && a.x + a.w <= b.x + b.w + eps && a.y + a.h <= b.y + b.h + eps

describe('catalog', () => {
  it('has 72 devices with unique ids', () => {
    expect(DEVICES.length).toBe(72)
    expect(new Set(DEVICES.map((d) => d.spec.id)).size).toBe(72)
  })

  it('every spec is sane', () => {
    for (const { spec } of DEVICES) {
      expect(spec.colors.length, spec.id).toBeGreaterThanOrEqual(1)
      for (const c of spec.colors) expect(c.hex, spec.id).toMatch(/^#[0-9A-F]{6}$/)
      expect(spec.screen.w > spec.screen.h, spec.id).toBe(spec.kind === 'laptop')
    }
  })

  it('geometry nests', () => {
    for (const { spec, geometry: g } of DEVICES) {
      const frame = { x: 0, y: 0, w: g.frame.w, h: g.frame.h }
      expect(inside(g.screen, g.glass), `${spec.id} screen in glass`).toBe(true)
      expect(inside(g.glass, g.body), `${spec.id} glass in body`).toBe(true)
      expect(g.glass.x - g.body.x, `${spec.id} band`).toBeGreaterThan(0)
      expect(inside(g.body, frame), `${spec.id} body in frame`).toBe(true)
      for (const c of g.cutouts) expect(inside(c.rect, g.body), `${spec.id} cutout`).toBe(true)
      for (const b of g.buttons) expect(inside(b, frame), `${spec.id} button`).toBe(true)
      if (g.base) expect(inside(g.base, frame), `${spec.id} base`).toBe(true)
      const nums = [g.frame.w, g.frame.h, ...Object.values(g.body), ...Object.values(g.screen)]
      for (const n of nums) {
        expect(Number.isFinite(n), spec.id).toBe(true)
        expect(n, spec.id).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('default device exists', () => {
    expect(getDevice('iphone-17')).toBeDefined()
    expect(getDevice('nope')).toBeUndefined()
  })

  it('island sizes', () => {
    const i15 = getDevice('iphone-15')!.geometry.cutouts.find((c) => c.shape === 'pill')!
    expect(i15.rect.w).toBe(126 * 3)
    expect(i15.rect.h).toBe(37 * 3)
    const i18 = getDevice('iphone-18-pro')!.geometry.cutouts.find((c) => c.shape === 'pill')!
    expect(i18.rect.w).toBeCloseTo(126 * 3 * 0.7, 2)
  })

  it('oneplus-12 punch is left-aligned', () => {
    const g = getDevice('oneplus-12')!.geometry
    const hole = g.cutouts.find((c) => c.shape === 'circle')!
    expect(hole.rect.x + hole.rect.w / 2).toBeLessThan(g.screen.x + g.screen.w * 0.2)
  })

  it('families grouped', () => {
    expect(devicesByFamily().map((g) => g.family)).toEqual(['iPhone', 'iPad', 'Mac', 'Watch', 'Android'])
  })
})

describe('dropdown order', () => {
  it('sorts each family by name, numbers in numeric order', () => {
    for (const { devices } of devicesByFamily()) {
      const names = devices.map((d) => d.spec.name)
      const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      expect(names).toEqual(sorted)
    }
    const iphones = devicesByFamily()[0].devices.map((d) => d.spec.id)
    expect(iphones.indexOf('iphone-11')).toBeLessThan(iphones.indexOf('iphone-12'))
    expect(iphones.indexOf('iphone-17-pro')).toBeLessThan(iphones.indexOf('iphone-18-pro'))
  })
})
