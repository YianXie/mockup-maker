import type { Device, Rect } from './devices/types'

export type Aspect = '16:9' | '4:3' | '1:1' | '9:16' | 'tight'
export type Orientation = 'portrait' | 'landscape'
export type Fit = 'fill' | 'fit'
export interface Size {
  w: number
  h: number
}
/**
 * Maps device px → canvas px. Not rotated: (u,v) → (x + u·s, y + v·s).
 * Rotated 90° counter-clockwise (device top points left): (u,v) → (x + v·s, y + (frameW − u)·s).
 */
export interface Placement {
  x: number
  y: number
  scale: number
  rotated: boolean
}

export const EXPORT_LONG_SIDE = 3840
export const TIGHT_PADDING = 0.08
export const ASPECTS: Aspect[] = ['16:9', '4:3', '1:1', '9:16', 'tight']

export function canRotate(device: Device): boolean {
  return device.spec.kind === 'phone' || device.spec.kind === 'tablet'
}

export function frameBox(device: Device, o: Orientation): Size {
  const { w, h } = device.geometry.frame
  return o === 'landscape' && canRotate(device) ? { w: h, h: w } : { w, h }
}

const RATIOS: Record<Exclude<Aspect, 'tight'>, [number, number]> = {
  '16:9': [16, 9],
  '4:3': [4, 3],
  '1:1': [1, 1],
  '9:16': [9, 16],
}

function tightPad(frame: Size): number {
  return TIGHT_PADDING * Math.max(frame.w, frame.h)
}

export function canvasSize(aspect: Aspect, frame: Size): Size {
  let rw: number
  let rh: number
  if (aspect === 'tight') {
    const pad = tightPad(frame)
    rw = frame.w + 2 * pad
    rh = frame.h + 2 * pad
  } else {
    ;[rw, rh] = RATIOS[aspect]
  }
  const k = EXPORT_LONG_SIDE / Math.max(rw, rh)
  return { w: Math.round(rw * k), h: Math.round(rh * k) }
}

/** `frame` is the oriented frame box (from frameBox). */
export function placeDevice(canvas: Size, frame: Size, aspect: Aspect, deviceSize: number): Placement {
  const rotated = false
  let scale: number
  if (aspect === 'tight') {
    const pad = tightPad(frame)
    scale = Math.min(canvas.w / (frame.w + 2 * pad), canvas.h / (frame.h + 2 * pad))
  } else {
    scale = deviceSize * Math.min(canvas.w / frame.w, canvas.h / frame.h)
  }
  return { x: (canvas.w - frame.w * scale) / 2, y: (canvas.h - frame.h * scale) / 2, scale, rotated }
}

/** Placement for a device in a given orientation (sets `rotated`). */
export function placeOriented(canvas: Size, device: Device, o: Orientation, aspect: Aspect, deviceSize: number): Placement {
  const p = placeDevice(canvas, frameBox(device, o), aspect, deviceSize)
  return { ...p, rotated: o === 'landscape' && canRotate(device) }
}

export function mapRect(device: Device, p: Placement, r: Rect): Rect {
  if (!p.rotated) return { x: p.x + r.x * p.scale, y: p.y + r.y * p.scale, w: r.w * p.scale, h: r.h * p.scale }
  const fw = device.geometry.frame.w
  return { x: p.x + r.y * p.scale, y: p.y + (fw - r.x - r.w) * p.scale, w: r.h * p.scale, h: r.w * p.scale }
}

export function screenRectOnCanvas(device: Device, p: Placement): Rect {
  return mapRect(device, p, device.geometry.screen)
}

export function imageRect(img: Size, screen: Rect, fit: Fit): Rect {
  const iw = Math.max(img.w, 1)
  const ih = Math.max(img.h, 1)
  const k = fit === 'fill' ? Math.max(screen.w / iw, screen.h / ih) : Math.min(screen.w / iw, screen.h / ih)
  const w = iw * k
  const h = ih * k
  return { x: screen.x + (screen.w - w) / 2, y: screen.y + (screen.h - h) / 2, w, h }
}
