import { getDevice } from '../devices/catalog'
import { canvasSize, frameBox, placeOriented, type Size } from '../layout'
import { DEFAULTS, type Scene } from '../scene'
import { drawBackground } from './background'
import { drawDevice } from './frame'

export function exportSize(scene: Scene): Size {
  const device = getDevice(scene.deviceId) ?? getDevice(DEFAULTS.deviceId)!
  return canvasSize(scene.aspect, frameBox(device, scene.orientation))
}

/** Draws the scene in export coordinates under ctx.scale(scale). Returns the export canvas size. */
export function render(ctx: CanvasRenderingContext2D, scene: Scene, scale: number, opts: { preview: boolean }): Size {
  const device = getDevice(scene.deviceId) ?? getDevice(DEFAULTS.deviceId)!
  const size = canvasSize(scene.aspect, frameBox(device, scene.orientation))
  const p = placeOriented(size, device, scene.orientation, scene.aspect, scene.deviceSize)
  const color = (device.spec.colors[scene.colorIndex] ?? device.spec.colors[0]).hex
  ctx.save()
  ctx.scale(scale, scale)
  drawBackground(ctx, scene.background, size, opts.preview)
  drawDevice(ctx, device, color, p, scene.image, scene.fit, opts.preview)
  ctx.restore()
  return size
}
