import './style.css'
import { exportSize, render } from './draw/render'
import { IMAGE_ERROR, downloadBlob, exportPng, loadImage, pickImageFile } from './input'
import { loadSettings, sanitize, saveSettings, type Scene, type Settings } from './scene'
import { createControls } from './ui/controls'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function mountApp(root: HTMLElement): void {
  let scene: Scene = { ...loadSettings(storage()), image: null }

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
      if (!scene.image) return
      downloadBlob(await exportPng(scene), `mockup-${scene.deviceId}.png`)
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
  async function useFile(f: File | null) {
    if (!f) {
      showError()
      return
    }
    try {
      update({ image: await loadImage(f) })
      error.textContent = ''
    } catch {
      showError()
    }
  }
  function showError() {
    error.textContent = IMAGE_ERROR
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
  stage.addEventListener('dragover', (e) => {
    e.preventDefault()
    stage.classList.add('dragging')
  })
  stage.addEventListener('dragleave', () => stage.classList.remove('dragging'))
  stage.addEventListener('drop', (e) => {
    e.preventDefault()
    stage.classList.remove('dragging')
    void useFile(pickImageFile(e.dataTransfer?.files))
  })
  window.addEventListener('paste', (e) => {
    const f = pickImageFile(e.clipboardData?.files)
    if (f) void useFile(f)
  })

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(stage)
  update({})
}

const root = document.getElementById('app')
if (root && !import.meta.env.VITEST) mountApp(root)
