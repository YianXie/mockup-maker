import { describe, expect, it } from 'vitest'
import { DEFAULTS, GRADIENT_COUNT, type Scene } from '../scene'
import { GRADIENTS } from './background'
import { createFakeCtx } from './fakeCtx'
import { render } from './render'

const img = { width: 1179, height: 2556 } as unknown as Scene['image']
const scene = (over: Partial<Scene> = {}): Scene => ({ ...DEFAULTS, image: img, ...over })
const ops = (ctx: ReturnType<typeof createFakeCtx>) => ctx.calls.map((c) => c.op)
const firstDeviceOp = (ctx: ReturnType<typeof createFakeCtx>) => ops(ctx).indexOf('translate')

describe('render', () => {
  it('returns export size', () => {
    expect(render(createFakeCtx(), scene(), 1, { preview: false })).toEqual({ w: 3840, h: 2160 })
  })

  it('transparent export draws no checkerboard', () => {
    const ctx = createFakeCtx()
    render(ctx, scene(), 1, { preview: false })
    expect(ops(ctx).slice(0, firstDeviceOp(ctx))).not.toContain('fillRect')
  })

  it('transparent preview draws checkerboard', () => {
    const ctx = createFakeCtx()
    render(ctx, scene(), 0.25, { preview: true })
    expect(ops(ctx).slice(0, firstDeviceOp(ctx))).toContain('fillRect')
  })

  it('solid background fills canvas', () => {
    const ctx = createFakeCtx()
    render(ctx, scene({ background: { type: 'solid', color: '#123456' } }), 1, { preview: false })
    const i = ops(ctx).indexOf('fillRect')
    expect(ctx.calls[i].args).toEqual([0, 0, 3840, 2160])
    const lastFill = ctx.calls.slice(0, i).filter((c) => c.op === 'set:fillStyle').pop()
    expect(lastFill?.args[0]).toBe('#123456')
  })

  it('screenshot is clipped', () => {
    const ctx = createFakeCtx()
    render(ctx, scene(), 1, { preview: false })
    const o = ops(ctx)
    const di = o.indexOf('drawImage')
    expect(di).toBeGreaterThan(-1)
    expect(o.slice(0, di).lastIndexOf('clip')).toBeGreaterThan(-1)
    expect(o.indexOf('restore', di)).toBeGreaterThan(di)
  })

  it('cutouts after image', () => {
    const ctx = createFakeCtx()
    render(ctx, scene(), 1, { preview: false })
    const o = ops(ctx)
    expect(o.indexOf('fill', o.indexOf('drawImage'))).toBeGreaterThan(-1)
  })

  it('no image draws placeholder in preview only', () => {
    const p = createFakeCtx()
    render(p, scene({ image: null }), 0.25, { preview: true })
    expect(ops(p)).not.toContain('drawImage')
    expect(p.calls.some((c) => c.op === 'fillText' && String(c.args[0]).includes('Drop a screenshot'))).toBe(true)
    const e = createFakeCtx()
    render(e, scene({ image: null }), 1, { preview: false })
    expect(ops(e)).not.toContain('fillText')
  })

  it('renders every device in both orientations without throwing', async () => {
    const { DEVICES } = await import('../devices/catalog')
    for (const d of DEVICES)
      for (const orientation of ['portrait', 'landscape'] as const)
        expect(() => render(createFakeCtx(), scene({ deviceId: d.spec.id, orientation }), 1, { preview: false })).not.toThrow()
  })

  it('fills black glass inside the colored body', () => {
    const ctx = createFakeCtx()
    render(ctx, scene(), 1, { preview: false })
    const fills = ctx.calls.filter((c) => c.op === 'set:fillStyle').map((c) => c.args[0])
    expect(fills).toContain('#0B0B0C')
  })

  it('GRADIENTS length', () => {
    expect(GRADIENTS.length).toBe(GRADIENT_COUNT)
  })
})
