export type Family = 'iPhone' | 'iPad' | 'Mac' | 'Watch' | 'Android'
export type Kind = 'phone' | 'tablet' | 'laptop' | 'watch'
export type CutoutType = 'none' | 'notch' | 'island' | 'punch' | 'homebutton' | 'laptop-notch'

export interface DeviceSpec {
  id: string
  name: string
  family: Family
  kind: Kind
  screen: { w: number; h: number }
  cutout: { type: CutoutType; w?: number; scale?: number; align?: 'left' }
  radiusPt: number
  scale: number
  colors: { name: string; hex: string }[]
  year: number
  source: string
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type RoundRect = Rect & { r: number }

export interface Cutout {
  shape: 'pill' | 'circle' | 'notch' | 'homebutton'
  rect: Rect
}

/** All values in device screen pixels, portrait (laptop: native landscape). Origin = frame top-left. */
export interface Geometry {
  frame: { w: number; h: number }
  body: RoundRect
  /** black front glass inside the thin colored band */
  glass: RoundRect
  screen: RoundRect
  cutouts: Cutout[]
  buttons: RoundRect[]
  base?: Rect
}

export interface Device {
  spec: DeviceSpec
  geometry: Geometry
}
