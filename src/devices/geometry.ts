import type { Cutout, Device, DeviceSpec, Geometry, Rect, RoundRect } from './types'

/** Turns a researched spec into stylized frame geometry (device screen pixels). */
export function deviceFromSpec(spec: DeviceSpec): Device {
  const W = spec.screen.w
  const H = spec.screen.h
  const ptRadius = spec.radiusPt > 0 && spec.scale > 0 ? spec.radiusPt * spec.scale : 0
  const isHome = spec.cutout.type === 'homebutton'

  // Bezels and radii per kind.
  let sr: number
  let side: number
  let top: number
  let bottom: number
  let bodyR: number
  switch (spec.kind) {
    case 'phone':
      if (isHome) {
        sr = 0
        side = 0.07 * W
        top = bottom = 0.2 * W
        bodyR = 0.16 * W
      } else {
        sr = ptRadius || 0.09 * W
        side = top = bottom = 0.045 * W
        bodyR = sr + side
      }
      break
    case 'tablet':
      sr = ptRadius || 0.045 * W
      side = top = bottom = 0.06 * W
      bodyR = sr + side
      break
    case 'laptop':
      sr = 0.012 * W
      side = top = 0.022 * W
      bottom = 0.045 * W
      bodyR = 0.03 * W
      break
    case 'watch':
      sr = 0.22 * W
      side = top = bottom = 0.1 * W
      bodyR = sr + side
      break
  }

  // Body/screen in local coords (body at 0,0); shifted into frame coords at the end.
  const body: RoundRect = { x: 0, y: 0, w: W + 2 * side, h: H + top + bottom, r: bodyR }
  const screen: RoundRect = { x: side, y: top, w: W, h: H, r: sr }
  // Thin colored band; everything inside it is black glass.
  const bandK = { phone: 0.014, tablet: 0.012, laptop: 0.006, watch: 0.035 }[spec.kind]
  const band = bandK * W
  const glass: RoundRect = { x: band, y: band, w: body.w - 2 * band, h: body.h - 2 * band, r: Math.max(0, bodyR - band) }

  const cutouts: Cutout[] = []
  const centeredTop = (w: number, h: number, y: number): Rect => ({ x: screen.x + (W - w) / 2, y: screen.y + y, w, h })
  switch (spec.cutout.type) {
    case 'notch':
      cutouts.push({ shape: 'notch', rect: centeredTop((spec.cutout.w ?? 0.42) * W, 0.075 * W, 0) })
      break
    case 'island': {
      const k = spec.cutout.scale ?? 1
      cutouts.push({ shape: 'pill', rect: centeredTop(126 * spec.scale * k, 37 * spec.scale * k, 11 * spec.scale) })
      break
    }
    case 'punch': {
      const d = 0.04 * W
      const cx = spec.cutout.align === 'left' ? 0.08 * W : 0.5 * W
      const cy = 0.035 * W
      cutouts.push({ shape: 'circle', rect: { x: screen.x + cx - d / 2, y: screen.y + cy - d / 2, w: d, h: d } })
      break
    }
    case 'homebutton': {
      const d = 0.16 * W
      const cy = screen.y + H + bottom / 2
      cutouts.push({ shape: 'homebutton', rect: { x: body.w / 2 - d / 2, y: cy - d / 2, w: d, h: d } })
      break
    }
    case 'laptop-notch':
      cutouts.push({ shape: 'notch', rect: centeredTop(0.07 * W, 32 * spec.scale, 0) })
      break
    case 'none':
      break
  }

  // Buttons (fractions of body height), protruding outside the body.
  const p = 0.012 * W
  const br = 0.006 * W
  const buttons: RoundRect[] = []
  const right = (y: number, len: number, out = p) => buttons.push({ x: body.w - br, y: y * body.h, w: out + br, h: len * body.h, r: br })
  const left = (y: number, len: number) => buttons.push({ x: -p, y: y * body.h, w: p + br, h: len * body.h, r: br })
  let base: Rect | undefined
  switch (spec.kind) {
    case 'phone':
      right(0.22, 0.1)
      if (spec.family === 'Android') {
        right(0.36, 0.12)
      } else {
        left(0.15, 0.04)
        left(0.22, 0.06)
        left(0.3, 0.06)
      }
      break
    case 'watch':
      right(0.28, 0.2, 0.06 * W)
      right(0.58, 0.18)
      break
    case 'tablet':
      buttons.push({ x: 0.8 * body.w, y: -p, w: 0.08 * body.w, h: p + br, r: br })
      break
    case 'laptop': {
      const bw = 1.12 * body.w
      base = { x: (body.w - bw) / 2, y: body.h, w: bw, h: 0.035 * W }
      break
    }
  }

  // Bounding box of everything, then shift so frame starts at (0,0).
  const rects: Rect[] = [body, ...buttons, ...(base ? [base] : [])]
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const maxY = Math.max(...rects.map((r) => r.y + r.h))
  const shift = <T extends Rect>(r: T): T => ({ ...r, x: r.x - minX, y: r.y - minY })

  const geometry: Geometry = {
    frame: { w: maxX - minX, h: maxY - minY },
    body: shift(body),
    glass: shift(glass),
    screen: shift(screen),
    cutouts: cutouts.map((c) => ({ ...c, rect: shift(c.rect) })),
    buttons: buttons.map(shift),
    ...(base ? { base: shift(base) } : {}),
  }
  return { spec, geometry }
}
