import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountApp } from '../main'

const $ = <T extends Element>(root: HTMLElement, sel: string) => root.querySelector<T>(sel)!

function setup() {
  document.body.innerHTML = '<div id="app"></div>'
  const root = document.getElementById('app')!
  mountApp(root)
  return root
}

describe('app shell', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  it('lists every device grouped by family', () => {
    const root = setup()
    const sel = $<HTMLSelectElement>(root, 'select[name=device]')
    expect(sel.querySelectorAll('optgroup')).toHaveLength(5)
    expect(sel.options).toHaveLength(72)
    expect(sel.value).toBe('iphone-17')
  })

  it('download is disabled until an image is loaded', () => {
    const root = setup()
    expect($<HTMLButtonElement>(root, 'button[data-action=download]').disabled).toBe(true)
  })

  it('tight aspect disables the size slider', () => {
    const root = setup()
    const size = $<HTMLInputElement>(root, 'input[name=size]')
    expect(size.disabled).toBe(false)
    $<HTMLButtonElement>(root, 'button[data-aspect="tight"]').click()
    expect(size.disabled).toBe(true)
  })

  it('switching to a laptop hides orientation and resets color', () => {
    const root = setup()
    ;[...root.querySelectorAll<HTMLButtonElement>('[data-color]')][1].click()
    $<HTMLButtonElement>(root, 'button[data-orientation="landscape"]').click()
    const sel = $<HTMLSelectElement>(root, 'select[name=device]')
    sel.value = 'macbook-pro-14-notch'
    sel.dispatchEvent(new Event('change'))
    expect($<HTMLElement>(root, '[data-group=orientation]').hidden).toBe(true)
    const saved = JSON.parse(localStorage.getItem('mockup-maker:v1')!)
    expect(saved).toMatchObject({ deviceId: 'macbook-pro-14-notch', colorIndex: 0, orientation: 'portrait' })
  })

  it('restores saved settings on load', () => {
    localStorage.setItem('mockup-maker:v1', JSON.stringify({ deviceId: 'pixel-10', aspect: '1:1' }))
    const root = setup()
    expect($<HTMLSelectElement>(root, 'select[name=device]').value).toBe('pixel-10')
    expect($<HTMLButtonElement>(root, 'button[data-aspect="1:1"]').getAttribute('aria-pressed')).toBe('true')
  })
})
