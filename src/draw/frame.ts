import type { Device, RoundRect } from '../devices/types'
import { imageRect, screenRectOnCanvas, type Fit, type Placement } from '../layout'
import type { SceneImage } from '../scene'
import { currentScale } from './background'

/** Darken a #RRGGBB color by `amount` (0..1). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.round(c * (1 - amount)).toString(16).padStart(2, '0')
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`
}

function roundRectPath(ctx: CanvasRenderingContext2D, r: RoundRect | (RoundRect & { radii: number[] })) {
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, 'radii' in r ? r.radii : Math.min(r.r, r.w / 2, r.h / 2))
}

function enterDeviceSpace(ctx: CanvasRenderingContext2D, device: Device, p: Placement) {
  if (p.rotated) {
    ctx.translate(p.x, p.y + device.geometry.frame.w * p.scale)
    ctx.rotate(-Math.PI / 2)
  } else {
    ctx.translate(p.x, p.y)
  }
  ctx.scale(p.scale, p.scale)
}

const PLACEHOLDER = ['Drop a screenshot,', 'paste, or', 'click Upload']

export function drawDevice(
  ctx: CanvasRenderingContext2D,
  device: Device,
  color: string,
  p: Placement,
  image: SceneImage | null,
  fit: Fit,
  preview: boolean,
): void {
  const g = device.geometry
  const W = device.spec.screen.w

  // 1) Chrome: body (+ laptop base) with a soft shadow, then buttons, then the black screen.
  ctx.save()
  const px = currentScale(ctx) * p.scale // canvas pixels per device px (shadows ignore transforms)
  enterDeviceSpace(ctx, device, p)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 0.03 * g.frame.h * px
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0.015 * g.frame.h * px
  ctx.fillStyle = color
  roundRectPath(ctx, g.body)
  ctx.fill()
  if (g.base) {
    const b = g.base
    ctx.fillStyle = shade(color, 0.08)
    roundRectPath(ctx, { ...b, r: 0, radii: [0, 0, b.h * 0.6, b.h * 0.6] })
    ctx.fill()
  }
  ctx.restore()
  if (g.base) {
    const b = g.base
    const sw = 0.12 * b.w
    ctx.fillStyle = shade(color, 0.18)
    roundRectPath(ctx, { x: b.x + (b.w - sw) / 2, y: b.y, w: sw, h: b.h * 0.35, r: 0, radii: [0, 0, b.h * 0.3, b.h * 0.3] })
    ctx.fill()
  }
  ctx.fillStyle = shade(color, 0.08)
  for (const btn of g.buttons) {
    roundRectPath(ctx, btn)
    ctx.fill()
  }
  // Re-fill the body edge over button roots so buttons read as protruding.
  ctx.fillStyle = color
  roundRectPath(ctx, g.body)
  ctx.fill()
  ctx.fillStyle = '#0B0B0C'
  roundRectPath(ctx, g.glass)
  ctx.fill()
  ctx.fillStyle = '#000000'
  roundRectPath(ctx, g.screen)
  ctx.fill()
  ctx.restore()

  // 2) Screenshot (upright, in canvas space), clipped to the rounded screen.
  const sr = screenRectOnCanvas(device, p)
  ctx.save()
  roundRectPath(ctx, { ...sr, r: g.screen.r * p.scale })
  ctx.clip()
  if (image) {
    const ir = imageRect({ w: image.width, h: image.height }, sr, fit)
    ctx.drawImage(image, ir.x, ir.y, ir.w, ir.h)
  } else if (preview) {
    ctx.fillStyle = '#26262B'
    ctx.fillRect(sr.x, sr.y, sr.w, sr.h)
    const fs = Math.min(sr.w, sr.h) * 0.075
    ctx.fillStyle = '#A1A1AA'
    ctx.font = `500 ${fs}px system-ui, -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    PLACEHOLDER.forEach((line, i) => ctx.fillText(line, sr.x + sr.w / 2, sr.y + sr.h / 2 + (i - 1) * fs * 1.35))
  }
  ctx.restore()

  // 3) Cutouts on top of the screenshot, back in device space.
  ctx.save()
  enterDeviceSpace(ctx, device, p)
  for (const c of g.cutouts) {
    const r = c.rect
    ctx.beginPath()
    if (c.shape === 'pill') {
      ctx.fillStyle = '#000000'
      ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2)
      ctx.fill()
    } else if (c.shape === 'circle') {
      ctx.fillStyle = '#000000'
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (c.shape === 'notch') {
      ctx.fillStyle = '#000000'
      ctx.roundRect(r.x, r.y, r.w, r.h, [0, 0, r.h * 0.45, r.h * 0.45])
      ctx.fill()
    } else {
      ctx.strokeStyle = '#3F3F46'
      ctx.lineWidth = 0.008 * W
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 - ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}
