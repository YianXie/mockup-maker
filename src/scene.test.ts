import { describe, expect, it } from 'vitest'
import { DEFAULTS, loadSettings, saveSettings, type Settings } from './scene'

const KEY = 'mockup-maker:v1'
function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('settings', () => {
  it('defaults when empty', () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULTS)
  })
  it('defaults are the spec values', () => {
    expect(DEFAULTS).toEqual({
      deviceId: 'iphone-17', colorIndex: 0, orientation: 'portrait', fit: 'fill',
      aspect: '16:9', background: { type: 'transparent' }, deviceSize: 0.8,
    })
  })
  it('round trip', () => {
    const s = fakeStorage()
    const v: Settings = { deviceId: 'pixel-10', colorIndex: 1, orientation: 'landscape', fit: 'fit',
      aspect: 'tight', background: { type: 'gradient', preset: 3 }, deviceSize: 0.6 }
    saveSettings(s, v)
    expect(loadSettings(s)).toEqual(v)
  })
  it('bad JSON', () => {
    expect(loadSettings(fakeStorage({ [KEY]: '{not json' }))).toEqual(DEFAULTS)
  })
  it('unknown device falls back, keeps other fields', () => {
    const r = loadSettings(fakeStorage({ [KEY]: JSON.stringify({ ...DEFAULTS, deviceId: 'iphone-3g', fit: 'fit' }) }))
    expect(r.deviceId).toBe('iphone-17')
    expect(r.fit).toBe('fit')
  })
  it('clamps and validates', () => {
    const r = loadSettings(fakeStorage({ [KEY]: JSON.stringify({
      ...DEFAULTS, deviceSize: 7, colorIndex: 99, aspect: 'banana', background: { type: 'gradient', preset: 42 } }) }))
    expect(r.deviceSize).toBe(0.95)
    expect(r.colorIndex).toBe(0)
    expect(r.aspect).toBe('16:9')
    expect(r.background).toEqual({ type: 'transparent' })
  })
  it('validates solid color', () => {
    const ok = loadSettings(fakeStorage({ [KEY]: JSON.stringify({ ...DEFAULTS, background: { type: 'solid', color: '#112233' } }) }))
    expect(ok.background).toEqual({ type: 'solid', color: '#112233' })
    const bad = loadSettings(fakeStorage({ [KEY]: JSON.stringify({ ...DEFAULTS, background: { type: 'solid', color: 'url(x)' } }) }))
    expect(bad.background).toEqual({ type: 'transparent' })
  })
  it('landscape on a device that cannot rotate becomes portrait', () => {
    const r = loadSettings(fakeStorage({ [KEY]: JSON.stringify({ ...DEFAULTS, deviceId: 'macbook-neo', orientation: 'landscape' }) }))
    expect(r.orientation).toBe('portrait')
  })
  it('storage throws', () => {
    const boom = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(loadSettings(boom)).toEqual(DEFAULTS)
    expect(() => saveSettings(boom, DEFAULTS)).not.toThrow()
  })
  it('null storage', () => {
    expect(loadSettings(null)).toEqual(DEFAULTS)
    expect(() => saveSettings(null, DEFAULTS)).not.toThrow()
  })
})
