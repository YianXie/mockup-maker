import type { Size } from '../layout'
import type { Background } from '../scene'

export const GRADIENTS: { name: string; stops: [string, string]; angle: number }[] = [
  { name: 'Indigo → Pink', stops: ['#6366F1', '#EC4899'], angle: 135 },
  { name: 'Teal → Sky', stops: ['#14B8A6', '#38BDF8'], angle: 135 },
  { name: 'Peach → Rose', stops: ['#FDBA74', '#FB7185'], angle: 135 },
  { name: 'Slate → Gray', stops: ['#CBD5E1', '#F1F5F9'], angle: 180 },
  { name: 'Mint → Lime', stops: ['#6EE7B7', '#D9F99D'], angle: 135 },
  { name: 'Night', stops: ['#0F172A', '#334155'], angle: 160 },
]

/** Effective pixels-per-unit of the current transform. */
export function currentScale(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform()
  return Math.hypot(m.a, m.b) || 1
}

export function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, size: Size, preview: boolean): void {
  if (bg.type === 'solid') {
    ctx.fillStyle = bg.color
    ctx.fillRect(0, 0, size.w, size.h)
  } else if (bg.type === 'gradient') {
    const g = GRADIENTS[bg.preset] ?? GRADIENTS[0]
    // CSS-style angle: 180deg = top → bottom, 90deg = left → right.
    const a = ((g.angle - 90) * Math.PI) / 180
    const half = (Math.abs(size.w * Math.cos(a)) + Math.abs(size.h * Math.sin(a))) / 2
    const cx = size.w / 2
    const cy = size.h / 2
    const grad = ctx.createLinearGradient(cx - Math.cos(a) * half, cy - Math.sin(a) * half, cx + Math.cos(a) * half, cy + Math.sin(a) * half)
    grad.addColorStop(0, g.stops[0])
    grad.addColorStop(1, g.stops[1])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size.w, size.h)
  } else if (preview) {
    // Checkerboard: 16 CSS-ish px squares regardless of preview scale.
    const sq = 16 / currentScale(ctx)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, size.w, size.h)
    ctx.fillStyle = '#E5E5E5'
    for (let y = 0, row = 0; y < size.h; y += sq, row++)
      for (let x = (row % 2) * sq; x < size.w; x += 2 * sq) ctx.fillRect(x, y, sq, sq)
  }
}
