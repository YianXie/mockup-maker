import { getDevice } from './devices/catalog'
import { ASPECTS, canRotate, type Aspect, type Fit, type Orientation } from './layout'

export type Background = { type: 'transparent' } | { type: 'solid'; color: string } | { type: 'gradient'; preset: number }

export interface Settings {
  deviceId: string
  colorIndex: number
  orientation: Orientation
  fit: Fit
  aspect: Aspect
  background: Background
  deviceSize: number
}

export type SceneImage = CanvasImageSource & { width: number; height: number }

export interface Scene extends Settings {
  image: SceneImage | null
}

export const GRADIENT_COUNT = 6
export const SIZE_MIN = 0.5
export const SIZE_MAX = 0.95
const KEY = 'mockup-maker:v1'

export const DEFAULTS: Settings = {
  deviceId: 'iphone-17',
  colorIndex: 0,
  orientation: 'portrait',
  fit: 'fill',
  aspect: '16:9',
  background: { type: 'transparent' },
  deviceSize: 0.8,
}

function validBackground(v: unknown): Background {
  const b = v as Partial<Record<string, unknown>> | null
  if (b && b.type === 'solid' && typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color)) {
    return { type: 'solid', color: b.color }
  }
  if (b && b.type === 'gradient' && Number.isInteger(b.preset) && (b.preset as number) >= 0 && (b.preset as number) < GRADIENT_COUNT) {
    return { type: 'gradient', preset: b.preset as number }
  }
  return { type: 'transparent' }
}

export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const device = typeof r.deviceId === 'string' ? getDevice(r.deviceId) : undefined
  const deviceId = device ? device.spec.id : DEFAULTS.deviceId
  const dev = device ?? getDevice(DEFAULTS.deviceId)!
  const ci = r.colorIndex
  const colorIndex = Number.isInteger(ci) && (ci as number) >= 0 && (ci as number) < dev.spec.colors.length ? (ci as number) : 0
  const orientation: Orientation = r.orientation === 'landscape' && canRotate(dev) ? 'landscape' : 'portrait'
  const fit: Fit = r.fit === 'fit' ? 'fit' : 'fill'
  const aspect: Aspect = ASPECTS.includes(r.aspect as Aspect) ? (r.aspect as Aspect) : DEFAULTS.aspect
  const ds = typeof r.deviceSize === 'number' && Number.isFinite(r.deviceSize) ? r.deviceSize : DEFAULTS.deviceSize
  const deviceSize = Math.min(SIZE_MAX, Math.max(SIZE_MIN, ds))
  return { deviceId, colorIndex, orientation, fit, aspect, background: validBackground(r.background), deviceSize }
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null): Settings {
  try {
    const s = storage?.getItem(KEY)
    return s ? sanitize(JSON.parse(s)) : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'> | null, s: Settings): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage unavailable (private mode, quota) — settings just won't persist
  }
}
