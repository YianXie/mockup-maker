import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tick = () => new Promise((r) => setTimeout(r, 0))
const png = (name = 'a.png') => new File(['x'], name, { type: 'image/png' })
function paste(files: File[]) {
  const e = new Event('paste', { cancelable: true }) as Event & { clipboardData: unknown }
  e.clipboardData = { files }
  window.dispatchEvent(e)
}
let teardown: (() => void) | undefined
async function setup() {
  vi.resetModules()
  const { mountApp } = await import('../main')
  document.body.innerHTML = '<div id="app"></div>'
  const root = document.getElementById('app')!
  teardown = mountApp(root)
  return root
}
const saved = () => JSON.parse(localStorage.getItem('mockup-maker:v1')!)

describe('review fixes', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })
  afterEach(() => {
    teardown?.()
    vi.unstubAllGlobals()
    vi.doUnmock('../input')
  })

  it('clicking the solid swatch applies the current color (white by default)', async () => {
    const root = await setup()
    root.querySelector<HTMLInputElement>('input[name=bgcolor]')!.click()
    expect(saved().background).toEqual({ type: 'solid', color: '#ffffff' })
  })

  it('a drop anywhere on the page is captured instead of navigating away', async () => {
    await setup()
    const over = new Event('dragover', { cancelable: true, bubbles: true })
    document.body.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    const drop = new Event('drop', { cancelable: true, bubbles: true }) as Event & { dataTransfer: unknown }
    drop.dataTransfer = { files: [] }
    document.body.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
  })

  it('closes the previous bitmap when a new image replaces it', async () => {
    const a = { width: 10, height: 20, close: vi.fn() }
    const b = { width: 10, height: 20, close: vi.fn() }
    const queue = [a, b]
    vi.stubGlobal('createImageBitmap', () => Promise.resolve(queue.shift()))
    await setup()
    paste([png()])
    await tick()
    paste([png()])
    await tick()
    expect(a.close).toHaveBeenCalled()
    expect(b.close).not.toHaveBeenCalled()
  })

  it('a slower earlier load does not overwrite a newer one', async () => {
    let resolveSlow!: (v: unknown) => void
    const slow = { width: 1, height: 1, close: vi.fn() }
    const fast = { width: 2, height: 2, close: vi.fn() }
    const calls = [() => new Promise((r) => (resolveSlow = r)), () => Promise.resolve(fast)]
    vi.stubGlobal('createImageBitmap', () => calls.shift()!())
    await setup()
    paste([png('slow.png')])
    paste([png('fast.png')])
    await tick()
    resolveSlow(slow)
    await tick()
    expect(slow.close).toHaveBeenCalled()
    expect(fast.close).not.toHaveBeenCalled()
  })

  it('pasting a non-image file shows the error; pasting text does not', async () => {
    const root = await setup()
    paste([])
    expect(root.querySelector('.error')!.textContent).toBe('')
    paste([new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })])
    expect(root.querySelector('.error')!.textContent).toBe("Couldn't read that image. Try a PNG or JPG.")
  })

  it('export failure shows an error and the button is disabled while exporting', async () => {
    let reject!: (e: Error) => void
    vi.doMock('../input', async (orig) => ({
      ...(await orig<typeof import('../input')>()),
      exportPng: () => new Promise((_r, j) => (reject = j)),
    }))
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 1, height: 1, close() {} }))
    const root = await setup()
    paste([png()])
    await tick()
    const btn = root.querySelector<HTMLButtonElement>('[data-action=download]')!
    expect(btn.disabled).toBe(false)
    btn.click()
    expect(btn.disabled).toBe(true)
    reject(new Error('toBlob null'))
    await tick()
    expect(btn.disabled).toBe(false)
    expect(root.querySelector('.error')!.textContent).toBe("Couldn't export the PNG. Please try again.")
  })
})
