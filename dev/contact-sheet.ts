import { DEVICES } from '../src/devices/catalog'
import { render } from '../src/draw/render'
import { DEFAULTS, type Scene } from '../src/scene'

// Placeholder "screenshot": a labelled gradient so cropping and orientation are visible.
const ph = document.createElement('canvas')
ph.width = 600
ph.height = 1200
const c = ph.getContext('2d')!
const g = c.createLinearGradient(0, 0, 600, 1200)
g.addColorStop(0, '#60A5FA')
g.addColorStop(1, '#F472B6')
c.fillStyle = g
c.fillRect(0, 0, 600, 1200)
c.fillStyle = '#fff'
c.font = 'bold 120px system-ui'
c.textAlign = 'center'
c.fillText('TOP', 300, 160)

const orientation = new URLSearchParams(location.search).get('o') === 'landscape' ? 'landscape' : 'portrait'
const grid = document.getElementById('grid')!
for (const d of DEVICES) {
  const scene: Scene = { ...DEFAULTS, deviceId: d.spec.id, orientation, aspect: '1:1', background: { type: 'solid', color: '#EEF2F7' }, image: ph }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 400
  render(canvas.getContext('2d')!, scene, 400 / 3840, { preview: true })
  const fig = document.createElement('figure')
  const cap = document.createElement('figcaption')
  cap.textContent = d.spec.name
  fig.append(canvas, cap)
  grid.append(fig)
}
