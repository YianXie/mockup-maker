import specs from './specs.json'
import { deviceFromSpec } from './geometry'
import type { Device, DeviceSpec, Family } from './types'

export const DEVICES: Device[] = (specs as DeviceSpec[]).map(deviceFromSpec)

const byId = new Map(DEVICES.map((d) => [d.spec.id, d]))

export function getDevice(id: string): Device | undefined {
  return byId.get(id)
}

const FAMILY_ORDER: Family[] = ['iPhone', 'iPad', 'Mac', 'Watch', 'Android']

export function devicesByFamily(): { family: Family; devices: Device[] }[] {
  const byName = (a: Device, b: Device) => a.spec.name.localeCompare(b.spec.name, 'en', { numeric: true })
  return FAMILY_ORDER.map((family) => ({ family, devices: DEVICES.filter((d) => d.spec.family === family).sort(byName) }))
}
