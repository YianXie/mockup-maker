import { devicesByFamily, getDevice } from '../devices/catalog'
import { GRADIENTS } from '../draw/background'
import { ASPECTS, canRotate } from '../layout'
import { SIZE_MAX, SIZE_MIN, type Scene, type Settings } from '../scene'

export interface ControlHandlers {
  onChange(patch: Partial<Settings>): void
  onUpload(): void
  onDownload(): void
}

export interface Controls {
  el: HTMLElement
  sync(scene: Scene): void
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.append(...kids)
  return el
}

function group(label: string, name: string, ...kids: Node[]) {
  return h('div', { class: 'group', 'data-group': name }, h('div', { class: 'label' }, label), ...kids)
}

function segmented(attr: string, options: [string, string][], onPick: (v: string) => void) {
  const wrap = h('div', { class: 'seg', role: 'group' })
  for (const [value, text] of options) {
    const b = h('button', { type: 'button', [`data-${attr}`]: value, 'aria-pressed': 'false' }, text)
    b.addEventListener('click', () => onPick(value))
    wrap.append(b)
  }
  return wrap
}

function press(scope: HTMLElement, attr: string, value: string) {
  scope.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)))
}

export function createControls(h_: ControlHandlers): Controls {
  // Device
  const select = h('select', { name: 'device', 'aria-label': 'Device' })
  for (const { family, devices } of devicesByFamily()) {
    const og = h('optgroup', { label: family })
    for (const d of devices) og.append(h('option', { value: d.spec.id }, d.spec.name))
    select.append(og)
  }
  select.addEventListener('change', () => {
    const d = getDevice(select.value)!
    h_.onChange({ deviceId: select.value, colorIndex: 0, ...(canRotate(d) ? {} : { orientation: 'portrait' }) })
  })

  const colors = h('div', { class: 'swatches' })

  const orientation = segmented('orientation', [['portrait', 'Portrait'], ['landscape', 'Landscape']], (v) =>
    h_.onChange({ orientation: v as Settings['orientation'] }),
  )
  const fit = segmented('fit', [['fill', 'Fill'], ['fit', 'Fit']], (v) => h_.onChange({ fit: v as Settings['fit'] }))
  const aspect = segmented(
    'aspect',
    ASPECTS.map((a) => [a, a === 'tight' ? 'Tight' : a]),
    (v) => h_.onChange({ aspect: v as Settings['aspect'] }),
  )

  // Background
  const none = h('button', { type: 'button', class: 'swatch none', 'data-bg': 'transparent', title: 'None (transparent)', 'aria-pressed': 'false' })
  none.addEventListener('click', () => h_.onChange({ background: { type: 'transparent' } }))
  const picker = h('input', { type: 'color', name: 'bgcolor', title: 'Solid color', value: '#ffffff' })
  const pickerWrap = h('label', { class: 'swatch picker', 'data-bg': 'solid', 'aria-pressed': 'false' }, picker)
  picker.addEventListener('input', () => h_.onChange({ background: { type: 'solid', color: picker.value } }))
  const bgRow = h('div', { class: 'swatches' }, none, pickerWrap)
  GRADIENTS.forEach((g, i) => {
    const b = h('button', { type: 'button', class: 'swatch', 'data-bg': `gradient-${i}`, title: g.name, 'aria-pressed': 'false' })
    b.style.background = `linear-gradient(${g.angle}deg, ${g.stops[0]}, ${g.stops[1]})`
    b.addEventListener('click', () => h_.onChange({ background: { type: 'gradient', preset: i } }))
    bgRow.append(b)
  })

  const size = h('input', { type: 'range', name: 'size', min: String(SIZE_MIN), max: String(SIZE_MAX), step: '0.01', 'aria-label': 'Device size' })
  size.addEventListener('input', () => h_.onChange({ deviceSize: Number(size.value) }))

  const upload = h('button', { type: 'button', 'data-action': 'upload' }, 'Upload image')
  upload.addEventListener('click', () => h_.onUpload())
  const download = h('button', { type: 'button', class: 'primary', 'data-action': 'download' }, 'Download PNG')
  download.addEventListener('click', () => h_.onDownload())

  const el = h(
    'aside',
    { class: 'panel' },
    group('Device', 'device', select),
    group('Color', 'color', colors),
    group('Orientation', 'orientation', orientation),
    group('Screenshot', 'fit', fit),
    group('Aspect ratio', 'aspect', aspect),
    group('Background', 'background', bgRow),
    group('Size', 'size', size),
    h('div', { class: 'actions' }, upload, download),
  )

  let colorsFor = ''
  return {
    el,
    sync(scene) {
      const d = getDevice(scene.deviceId)!
      select.value = scene.deviceId
      if (colorsFor !== scene.deviceId) {
        colorsFor = scene.deviceId
        colors.replaceChildren(
          ...d.spec.colors.map((c, i) => {
            const b = h('button', { type: 'button', class: 'swatch', 'data-color': String(i), title: c.name, 'aria-label': c.name })
            b.style.background = c.hex
            b.addEventListener('click', () => h_.onChange({ colorIndex: i }))
            return b
          }),
        )
      }
      press(colors, 'color', String(scene.colorIndex))
      ;(el.querySelector('[data-group=orientation]') as HTMLElement).hidden = !canRotate(d)
      press(orientation, 'orientation', scene.orientation)
      press(fit, 'fit', scene.fit)
      press(aspect, 'aspect', scene.aspect)
      const bg = scene.background
      press(bgRow, 'bg', bg.type === 'gradient' ? `gradient-${bg.preset}` : bg.type)
      if (bg.type === 'solid') picker.value = bg.color
      size.value = String(scene.deviceSize)
      size.disabled = scene.aspect === 'tight'
      download.disabled = !scene.image
    },
  }
}
