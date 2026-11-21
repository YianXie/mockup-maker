import './style.css'
import { exportSize, render } from './draw/render'
import { IMAGE_ERROR, downloadBlob, exportPng, loadImage, pickImageFile } from './input'

export const EXPORT_ERROR = "Couldn't export the PNG. Please try again."
import { loadSettings, sanitize, saveSettings, type Scene, type Settings } from './scene'
import { createControls } from './ui/controls'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Mounts the editor into `root`. Returns a teardown that removes window-level listeners. */
export function mountApp(root: HTMLElement): () => void {
  const ac = new AbortController()
  const opts = { signal: ac.signal }
  let scene: Scene = { ...loadSettings(storage()), image: null }
  let exporting = false

  const canvas = document.createElement('canvas')
  canvas.className = 'preview-canvas'
  const stage = document.createElement('div')
  stage.className = 'stage'
  stage.append(canvas)
  const error = document.createElement('p')
  error.className = 'error'
  error.setAttribute('role', 'alert')
  const file = document.createElement('input')
  file.type = 'file'
  file.accept = 'image/*'
  file.hidden = true
  const main = document.createElement('main')
  main.className = 'preview'
  main.append(stage, error, file)

  const controls = createControls({
    onChange: (patch) => update(patch),
    onUpload: () => file.click(),
    onDownload: async () => {
      if (!scene.image || exporting) return
      exporting = true
      controls.setBusy(true)
      try {
        downloadBlob(await exportPng(scene), `mockup-${scene.deviceId}.png`)
      } catch {
        showError(EXPORT_ERROR)
      } finally {
        exporting = false
        controls.setBusy(false)
      }
    },
  })

  const footer = document.createElement('footer')
  footer.textContent = 'Runs entirely in your browser — images are never uploaded.'
  const header = document.createElement('header')
  header.innerHTML = '<h1>Mockup Maker</h1>'
  const layout = document.createElement('div')
  layout.className = 'layout'
  layout.append(main, controls.el)
  root.replaceChildren(header, layout, footer)

  // Rendering (coalesced to one per frame).
  let queued = false
  function draw() {
    queued = false
    const size = exportSize(scene)
    const dpr = window.devicePixelRatio || 1
    const availW = Math.max(stage.clientWidth, 1)
    const availH = Math.max(stage.clientHeight, 1)
    const cssScale = Math.min(availW / size.w, availH / size.h)
    canvas.style.width = `${Math.floor(size.w * cssScale)}px`
    canvas.style.height = `${Math.floor(size.h * cssScale)}px`
    canvas.width = Math.max(1, Math.round(size.w * cssScale * dpr))
    canvas.height = Math.max(1, Math.round(size.h * cssScale * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    render(ctx, scene, canvas.width / size.w, { preview: true })
  }
  function schedule() {
    if (queued) return
    queued = true
    requestAnimationFrame(draw)
  }

  function update(patch: Partial<Settings> & { image?: Scene['image'] }) {
    const { image, ...settings } = { image: scene.image, ...patch }
    const next = sanitize({ ...scene, ...settings })
    scene = { ...next, image }
    saveSettings(storage(), next)
    controls.sync(scene)
    stage.classList.toggle('empty', !scene.image)
    schedule()
  }

  // Image input: picker, drop, paste.
  let errorTimer: ReturnType<typeof setTimeout> | undefined
  let loadSeq = 0
  const release = (img: Scene['image']) => {
    if (img && 'close' in img && typeof img.close === 'function') img.close()
  }
  async function useFile(f: File | null) {
    const seq = ++loadSeq
    if (!f) {
      showError()
      return
    }
    try {
      const img = await loadImage(f)
      if (seq !== loadSeq) {
        release(img) // a newer file was chosen while this one decoded
        return
      }
      const old = scene.image
      update({ image: img })
      release(old)
      error.textContent = ''
      clearTimeout(errorTimer)
    } catch {
      if (seq === loadSeq) showError()
    }
  }
  function showError(message = IMAGE_ERROR) {
    error.textContent = message
    clearTimeout(errorTimer)
    errorTimer = setTimeout(() => (error.textContent = ''), 5000)
  }
  file.addEventListener('change', () => {
    if (file.files?.length) void useFile(pickImageFile(file.files))
    file.value = ''
  })
  stage.addEventListener('click', () => {
    if (!scene.image) file.click()
  })
  // Accept drops anywhere on the page so a near-miss never navigates the tab to the file.
  window.addEventListener('dragover', (e) => {
    e.preventDefault()
    stage.classList.add('dragging')
  }, opts)
  window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) stage.classList.remove('dragging')
  }, opts)
  window.addEventListener('drop', (e) => {
    e.preventDefault()
    stage.classList.remove('dragging')
    if (e.dataTransfer?.files.length) void useFile(pickImageFile(e.dataTransfer.files))
  }, opts)
  window.addEventListener('paste', (e) => {
    const files = e.clipboardData?.files
    if (!files?.length) return // plain text paste: ignore
    void useFile(pickImageFile(files))
  }, opts)

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
  ro?.observe(stage)
  update({})
  return () => {
    ac.abort()
    ro?.disconnect()
  }
}

const root = document.getElementById('app')
if (root && !import.meta.env.VITEST) mountApp(root)
