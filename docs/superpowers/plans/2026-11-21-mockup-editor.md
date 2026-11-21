# Mockup Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, browser-only web page. Pick a device, drop in a screenshot, tweak a few options, and download a PNG device mockup sized for slides.

**Architecture:** Device specs live in a JSON table (`specs.json`). One pure function turns each spec into frame geometry, with per-kind rules. Pure layout functions compute the canvas, device placement and image rectangles. A single `render(ctx, scene, scale)` draws both the preview and the export with Canvas 2D. A thin vanilla-TS UI layer edits the `Scene` and re-renders.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Vitest 3 + jsdom, no UI framework, GitHub Pages via GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-21-mockup-editor-design.md`
**Device data:** `docs/superpowers/plans/2026-11-21-device-specs.json` (72 models, researched and fact-checked 2026-11-21)

## Global Constraints

- No network requests carrying user data. No backend, analytics, trackers, ads, or sign-in.
- All frames are drawn in code. No third-party device artwork.
- Export long side = **3840 px**. Aspect presets: `16:9` (3840×2160, default), `4:3` (3840×2880), `1:1` (3840×3840), `9:16` (2160×3840), `tight`.
- Tight padding = **8%** of the device's larger frame dimension on every side.
- Defaults: device `iphone-17`, color index 0, `portrait`, fit `fill`, aspect `16:9`, background `transparent`, device size `0.8` (slider range 0.5–0.95).
- Landscape is only for `phone` and `tablet`. The screenshot stays upright relative to the viewer.
- Download is disabled until an image is loaded. The Size slider is disabled when aspect is `tight`.
- The drop shadow is always on and there is no control for it.
- `localStorage` access is always wrapped in try/catch. Unknown or corrupt values fall back to defaults.
- Target browsers: current desktop Chrome, Safari, and Firefox. The layout must not break at 375 px wide.

## Review Focus

1. **Corrupt or stale saved settings** (an old `deviceId` that was removed, a non-JSON string, or out-of-range numbers) → the app loads with defaults for the bad fields and does not crash. *Test in Task 3.*
2. **Non-image or unreadable file** (a PDF, or a HEIC that Chrome cannot decode) → an inline error "Couldn't read that image. Try a PNG or JPG." appears and the previous image stays. *Test in Task 5.*
3. **Pasting text or dropping several files** → text is ignored, and from several files the first image is used. *Test in Task 5.*
4. **Transparent export** → the checkerboard appears only in the preview, never in the exported PNG. *Test in Task 4.*
5. **Extreme screenshot shapes** (a 100×4000 strip, or a landscape shot on a portrait phone) → fill crops from the center and fit letterboxes, and neither produces NaN or zero-size rects. *Test in Task 2.*

---

## File Structure

```
index.html                    app shell
vite.config.ts                base: './' so it works under a GitHub Pages subpath
tsconfig.json
package.json
src/
  main.ts                     boot: load settings, build UI, first render
  style.css
  devices/
    specs.json                copied verbatim from docs/superpowers/plans/2026-11-21-device-specs.json
    types.ts                  DeviceSpec, Device, Geometry types
    geometry.ts               deviceFromSpec(): per-kind frame rules
    catalog.ts                DEVICES, getDevice(), devicesByFamily()
    catalog.test.ts
  layout.ts                   pure math: canvasSize, frameBox, placeDevice, imageRect, screenRectOnCanvas
  layout.test.ts
  scene.ts                    Scene type, DEFAULTS, loadSettings/saveSettings
  scene.test.ts
  draw/
    background.ts             drawBackground, GRADIENTS
    frame.ts                  drawDevice (body, screen, cutout, buttons, shadow)
    render.ts                 render(ctx, scene, scale, opts)
    render.test.ts            uses a recording fake ctx
    fakeCtx.ts                test helper
  input.ts                    pickImageFile, loadImage, exportPng
  input.test.ts
  ui/controls.ts              builds the control panel and binds it to the scene
dev/
  contact-sheet.html          dev-only grid of every device
  contact-sheet.ts
.github/workflows/deploy.yml
README.md
```

---

### Task 1: Scaffold + device catalog

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` (just a `<div id="app">` and the module script for now), `.gitignore` (`node_modules`, `dist`)
- Create: `src/devices/specs.json` (copied verbatim from the plan's JSON), `src/devices/types.ts`, `src/devices/geometry.ts`, `src/devices/catalog.ts`
- Test: `src/devices/catalog.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Family = 'iPhone' | 'iPad' | 'Mac' | 'Watch' | 'Android'
  type Kind = 'phone' | 'tablet' | 'laptop' | 'watch'
  type CutoutType = 'none' | 'notch' | 'island' | 'punch' | 'homebutton' | 'laptop-notch'
  interface DeviceSpec { id: string; name: string; family: Family; kind: Kind;
    screen: { w: number; h: number }; cutout: { type: CutoutType; w?: number; scale?: number; align?: 'left' };
    radiusPt: number; scale: number; colors: { name: string; hex: string }[]; year: number; source: string }
  interface Rect { x: number; y: number; w: number; h: number }
  interface Device { spec: DeviceSpec; geometry: Geometry }
  interface Geometry {           // all in device screen pixels, portrait (laptop: native landscape), origin = body top-left
    frame: { w: number; h: number }  // full bounding box incl. buttons/crown/base
    body: Rect & { r: number }       // main body (laptop: lid)
    screen: Rect & { r: number }
    cutouts: Cutout[]                // drawn on top of the screenshot in body color / black
    buttons: (Rect & { r: number })[]
    base?: Rect                      // laptop only (bottom deck)
  }
  type Cutout = { shape: 'pill' | 'circle' | 'notch' | 'homebutton'; rect: Rect }
  deviceFromSpec(spec: DeviceSpec): Device
  DEVICES: Device[]               // in specs.json order
  getDevice(id: string): Device | undefined
  devicesByFamily(): { family: Family; devices: Device[] }[]   // family order: iPhone, iPad, Mac, Watch, Android
  ```

- [ ] **Step 1: Scaffold.** Run `npm create vite@latest . -- --template vanilla-ts`, delete the template's demo files, then `npm i -D vitest@3 jsdom`. Add the scripts `"test": "vitest run"` and `"dev"`, `"build"`, `"preview"`. Set `vite.config.ts` to `base: './'` and `test.environment: 'jsdom'`. Turn on `"resolveJsonModule": true` and `"strict": true` in tsconfig.

- [ ] **Step 2: Write the failing tests** in `catalog.test.ts`:
  - `has 72 devices with unique ids`: `DEVICES.length === 72`, and `new Set(ids).size === 72`.
  - `every spec is sane`: for each device, `colors.length >= 1`, every hex matches `/^#[0-9A-F]{6}$/`, and `screen.w > screen.h` exactly when `kind === 'laptop'`.
  - `geometry nests`: for each device, the screen lies inside the body, the body lies inside the frame, every cutout rect lies inside the body, and every number is finite and ≥ 0.
  - `default device exists`: `getDevice('iphone-17')` is defined.
  - `island sizes`: for `iphone-15`, the island cutout has `rect.w === 126*3` and `rect.h === 37*3`. For `iphone-18-pro`, `rect.w` equals `126*3*0.7` within 0.01.
  - `oneplus-12 punch is left-aligned`: the circle's center x is less than `screen.x + screen.w*0.2`.
  - `families grouped`: `devicesByFamily().map(g => g.family)` equals `['iPhone','iPad','Mac','Watch','Android']`.

- [ ] **Step 3: Run** `npm test`. Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Implement `deviceFromSpec` in `geometry.ts`** with these rules. W is screen.w and H is screen.h, in px.

  | | screen radius `sr` | bezel (sides / top / bottom) | body radius |
  |---|---|---|---|
  | phone | `radiusPt*scale` if both > 0, else `0.09*W` | `0.045*W` all sides | `sr + bezel` |
  | phone + `homebutton` | 0 | sides `0.07*W`, top & bottom `0.20*W` | `0.16*W` |
  | tablet | `radiusPt*scale` if > 0, else `0.045*W` | `0.06*W` all sides | `sr + bezel` |
  | laptop (lid) | top corners `0.012*W`, bottom 0 | sides & top `0.022*W`, bottom `0.045*W` | `0.03*W` top corners |
  | watch | `0.22*W` | `0.10*W` all sides | `sr + bezel` |

  The radius rules are chosen so the bezel stays an even thickness all the way round.

  Cutouts (positions relative to `screen`):
  - `notch`: shape `notch`, width `cutout.w*W`, height `0.075*W`, centered at the top.
  - `island`: shape `pill`, width `126*scale*(cutout.scale??1)`, height `37*scale*(cutout.scale??1)`, top at `11*scale`, centered.
  - `punch`: shape `circle`, diameter `0.04*W`, center y `0.035*W`. Center x is `0.5*W`, or `0.08*W` when `align === 'left'`.
  - `homebutton`: shape `homebutton`, a circle of diameter `0.16*W` centered in the bottom bezel. It lies outside the screen but inside the body.
  - `laptop-notch`: shape `notch`, width `0.07*W`, height `32*scale`, centered at the top.
  - `none`: no cutouts.

  Buttons protrude `0.012*W` from the body, with radius `0.006*W`. Fractions below are of body height.
  - Phone, all models: power button on the right side at y 0.22, length 0.10.
  - Apple phones also get left-side buttons: action/mute at 0.15 (length 0.04) and volume at 0.22 and 0.30 (length 0.06 each).
  - Android phones have no left-side buttons. Their volume rocker is on the right side below power, at 0.36 with length 0.12.
  - Watch: crown on the right at y 0.28, length 0.20, protruding `0.06*W`; side button at y 0.58, length 0.18.
  - Tablet: a top-edge button at x 0.80 of body width, length 0.08, protruding upward.
  - Laptop: no buttons. Add `base` under the lid: width `1.12×` lid width, height `0.035*W`, centered horizontally.

  `frame` is the bounding box of all of the above. Shift every rect so the frame starts at (0,0).

- [ ] **Step 5: Implement `catalog.ts`** by importing `specs.json`, then mapping it through `deviceFromSpec` and the two lookups.

- [ ] **Step 6: Run** `npm test`. Expected: all catalog tests PASS.

- [ ] **Step 7: Commit.** Message: `feat: device catalog with generated frame geometry`.

---

### Task 2: Layout math

**Files:**
- Create: `src/layout.ts`
- Test: `src/layout.test.ts`

**Interfaces:**
- Consumes: `Device` and `Rect` from Task 1.
- Produces:
  ```ts
  type Aspect = '16:9' | '4:3' | '1:1' | '9:16' | 'tight'
  type Orientation = 'portrait' | 'landscape'
  type Fit = 'fill' | 'fit'
  interface Size { w: number; h: number }
  interface Placement { x: number; y: number; scale: number; rotated: boolean } // device px → canvas px
  frameBox(device: Device, o: Orientation): Size          // swaps w/h when rotated; laptop/watch never rotate
  canvasSize(aspect: Aspect, frame: Size): Size           // long side 3840; tight = frame + 8% padding, scaled
  placeDevice(canvas: Size, frame: Size, aspect: Aspect, deviceSize: number): Placement
  screenRectOnCanvas(device: Device, p: Placement): Rect  // axis-aligned, upright screen rect after rotation
  imageRect(img: Size, screen: Rect, fit: Fit): Rect
  ```

- [ ] **Step 1: Write the failing tests:**
  - `canvasSize presets`: `16:9` gives `{w:3840,h:2160}`, `4:3` gives `{3840,2880}`, `1:1` gives `{3840,3840}`, and `9:16` gives `{2160,3840}`.
  - `tight canvas`: for frame `{w:1000,h:2000}`, padding is `0.08*2000 = 160`, so the padded size is `1320×2320`, scaled to a long side of 3840. Expect `{w: Math.round(1320*3840/2320), h: 3840}`.
  - `placeDevice centers at size`: canvas 3840×2160, frame 1000×2000, size 0.8 → `scale = 0.8*min(3840/1000, 2160/2000) = 0.864`. The device is centered.
  - `placeDevice tight ignores size`: with aspect `tight`, the result is the same for size 0.5 and size 0.95, and the frame ends up 160/2320 of the canvas from the edges.
  - `landscape swaps`: `frameBox(phone, 'landscape')` equals the portrait box with w and h swapped. `frameBox(laptop, 'landscape')` equals the portrait box.
  - `screenRectOnCanvas landscape is wide`: for `iphone-17` in landscape, `rect.w > rect.h`.
  - `imageRect fill crops center`: an image 1000×1000 in screen `{0,0,100,200}` → `{x:-50, y:0, w:200, h:200}`.
  - `imageRect fit letterboxes`: the same input gives `{x:0, y:50, w:100, h:100}`.
  - `imageRect extreme strip`: an image 100×4000 under both fill and fit has finite values with w>0 and h>0. *(Review Focus 5.)*

- [ ] **Step 2: Run** `npm test -- layout`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions in `layout.ts`. When `rotated`, the device is turned 90° counter-clockwise, so the top of the device points left. `screenRectOnCanvas` returns the rotated screen's axis-aligned bounds.
- [ ] **Step 4: Run** `npm test -- layout`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: layout math for canvas, placement and image fit`.

---

### Task 3: Scene and saved settings

**Files:**
- Create: `src/scene.ts`
- Test: `src/scene.test.ts`

**Interfaces:**
- Consumes: `Aspect`, `Orientation`, `Fit` (Task 2); `getDevice` (Task 1).
- Produces:
  ```ts
  type Background = { type: 'transparent' } | { type: 'solid'; color: string } | { type: 'gradient'; preset: number }
  interface Settings { deviceId: string; colorIndex: number; orientation: Orientation; fit: Fit;
    aspect: Aspect; background: Background; deviceSize: number }
  interface Scene extends Settings { image: CanvasImageSource & { width: number; height: number } | null }
  DEFAULTS: Settings
  loadSettings(storage: Pick<Storage,'getItem'> | null): Settings   // key 'mockup-maker:v1'
  saveSettings(storage: Pick<Storage,'setItem'> | null, s: Settings): void
  ```

- [ ] **Step 1: Write the failing tests:**
  - `defaults when empty`: `loadSettings(fakeStorage({}))` deep-equals `DEFAULTS`.
  - `round trip`: save, then load, gives the same object back.
  - `bad JSON`: a stored `'{not json'` gives `DEFAULTS`.
  - `unknown device`: stored `deviceId: 'iphone-3g'` → the result has `deviceId: 'iphone-17'` and the other valid fields are kept. *(Review Focus 1.)*
  - `clamps and validates`: `deviceSize: 7` → 0.95; `colorIndex: 99` → 0 (out of range for the device); `aspect: 'banana'` → `'16:9'`; `background: {type:'gradient', preset: 42}` → `{type:'transparent'}`.
  - `storage throws`: when `getItem` throws, the result is `DEFAULTS`. When `setItem` throws, `saveSettings` does not throw.
  - `null storage`: works the same way as empty storage.
- [ ] **Step 2: Run** `npm test -- scene`. Expected: FAIL.
- [ ] **Step 3: Implement.** Validate field by field, and replace any invalid field with its default. Gradient presets are valid for `0 ≤ preset < GRADIENTS.length`. Use 6 for now: export a `GRADIENT_COUNT = 6` constant from `scene.ts` and have Task 4 assert that `GRADIENTS.length === GRADIENT_COUNT`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: scene model with validated persisted settings`.

---

### Task 4: Drawing and render

**Files:**
- Create: `src/draw/background.ts`, `src/draw/frame.ts`, `src/draw/render.ts`, `src/draw/fakeCtx.ts`
- Create: `dev/contact-sheet.html`, `dev/contact-sheet.ts`
- Test: `src/draw/render.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  ```ts
  GRADIENTS: { name: string; stops: [string, string]; angle: number }[]   // exactly GRADIENT_COUNT (6)
  drawBackground(ctx, bg: Background, size: Size, preview: boolean): void
  drawDevice(ctx, device: Device, color: string, p: Placement, image: Scene['image'], fit: Fit): void
  render(ctx: CanvasRenderingContext2D, scene: Scene, scale: number, opts: { preview: boolean }): Size
     // draws in export coordinates under ctx.scale(scale, scale); returns export canvas size
  createFakeCtx(): CanvasRenderingContext2D & { calls: { op: string; args: unknown[] }[] }  // records ops; gradient/pattern stubs
  ```

- [ ] **Step 1: Write the failing tests** with the fake ctx:
  - `transparent export draws no checkerboard`: render with `preview:false` and a transparent background → no `fillRect` happens before the first device op. *(Review Focus 4.)*
  - `transparent preview draws checkerboard`: with `preview:true` there are `fillRect` calls before the device ops.
  - `solid background fills canvas`: the first fill is a `fillRect(0,0,3840,2160)` while `fillStyle` is the chosen color.
  - `screenshot is clipped`: in the call log, a `clip` comes before the `drawImage` of the screenshot, and a `restore` comes after it.
  - `cutouts after image`: the cutout fill ops come after `drawImage`.
  - `no image draws placeholder`: with `image:null`, no `drawImage` is called and a `fillText` containing `"Drop a screenshot"` is called, in preview mode only.
  - `GRADIENTS length`: equals `GRADIENT_COUNT`.
- [ ] **Step 2: Run** `npm test -- render`. Expected: FAIL.
- [ ] **Step 3: Implement `drawBackground`.** The checkerboard uses 32 px squares in `#ffffff` and `#e5e5e5`, in preview only. Gradients are linear across the canvas at the preset's angle. Choose 6 soft, slide-friendly presets (for example indigo→pink, teal→sky, peach→rose, slate→gray, mint→lime, and night `#0f172a`→`#334155`).
- [ ] **Step 4: Implement `drawDevice`** in this order: `save` → translate/scale/rotate from the placement → shadow (blur `0.03×frame.h`, offsetY `0.015×frame.h`, `rgba(0,0,0,0.25)`) applied only to the body fill → buttons and base in the body color darkened by 8% → body → screen rect filled `#000` → `restore`. Then, in canvas coordinates using `screenRectOnCanvas`, `save`, draw a rounded-rect `clip` at the screen radius × placement scale, and `drawImage` at `imageRect`. Draw the placeholder text instead when the image is null and in preview. `restore`. Finally redraw the cutouts in rotated device space: pill, circle and notch in `#000`; homebutton as a ring in the body color darkened by 15%. Laptop base: a rounded rect, with a small 0.12-wide scoop at the top center drawn 10% darker.
- [ ] **Step 5: Implement `render`**: compute frameBox → canvasSize → placeDevice, then `ctx.save(); ctx.scale(scale, scale)`, then background, then device, then `restore`. Return the canvas size.
- [ ] **Step 6: Run** `npm test`. Expected: PASS.
- [ ] **Step 7: Contact sheet.** `dev/contact-sheet.html` draws every device in a 6-column grid at 400 px per cell. Each cell uses a gray placeholder image (a canvas filled with a gradient) and has the device name as a caption. Add `dev/contact-sheet.html` as a second Vite input only when `mode === 'development'`.
- [ ] **Step 8: Visual check.** Run `npm run dev`, open `/dev/contact-sheet.html`, and look at it. Each frame should be recognizable, cutouts should sit inside screens, and no frame should overlap its cell. Fix any geometry constants that look clearly wrong, rerun `npm test`, then commit.
- [ ] **Step 9: Commit.** Message: `feat: canvas rendering of backgrounds and device frames`.

---

### Task 5: Image input and export

**Files:**
- Create: `src/input.ts`
- Test: `src/input.test.ts`

**Interfaces:**
- Produces:
  ```ts
  pickImageFile(files: ArrayLike<File> | null | undefined): File | null  // first file whose type starts with 'image/'
  loadImage(file: File): Promise<ImageBitmap | HTMLImageElement>       // createImageBitmap, fallback <img>+objectURL; rejects with Error('unreadable')
  exportPng(scene: Scene): Promise<Blob>                                // offscreen canvas at full size, render(scale 1, preview:false)
  downloadBlob(blob: Blob, filename: string): void                      // a[download] + objectURL, revoked after click
  IMAGE_ERROR = "Couldn't read that image. Try a PNG or JPG."
  ```

- [ ] **Step 1: Write the failing tests:**
  - `pickImageFile skips non-images`: for `[text.txt (text/plain), b.png (image/png), c.jpg]` it returns `b.png`. *(Review Focus 3.)*
  - `pickImageFile none`: `[]`, `null`, and `[a.pdf]` all give `null`.
  - `loadImage rejects garbage`: a `File(['nope'], 'x.png', {type:'image/png'})` with `createImageBitmap` stubbed to reject and `Image` stubbed to fire `onerror` → the promise rejects. *(Review Focus 2.)*
- [ ] **Step 2: Run** `npm test -- input`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions. `exportPng` uses `document.createElement('canvas')` sized from `render`'s returned size. Get that size first with a dry call to `canvasSize(...)`, then `toBlob('image/png')`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: image loading, paste/drop selection and PNG export`.

---

### Task 6: UI shell and wiring

**Files:**
- Create: `src/ui/controls.ts`, `src/main.ts`, `src/style.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: everything above.
- Produces: `mountApp(root: HTMLElement): void` in `main.ts`.

Layout: on desktop, the preview fills the left side and a 280 px control panel sits on the right. Below 720 px wide the panel stacks under the preview. Controls, top to bottom, with these exact labels:
1. **Device:** `<select>` with an `<optgroup>` per family.
2. **Color:** round swatch buttons from `spec.colors`, with the name in `title`.
3. **Orientation:** a segmented Portrait / Landscape control, hidden for laptop and watch.
4. **Screenshot:** a segmented Fill / Fit control.
5. **Aspect ratio:** a segmented 16:9 / 4:3 / 1:1 / 9:16 / Tight control.
6. **Background:** a "None" button (transparent), a color input, and 6 gradient swatches.
7. **Size:** a range input from 0.5 to 0.95, step 0.01, disabled when Tight is selected.
8. **Upload image:** a button that triggers a hidden `<input type=file accept="image/*">`.
9. **Download PNG:** the primary button, disabled until an image is loaded. The file is named `mockup-<deviceId>.png`.

Behavior:
- Every control updates the `Scene`, calls `saveSettings(localStorage-or-null, …)`, and schedules a re-render with `requestAnimationFrame`, coalesced so several updates render once.
- Changing device resets `colorIndex` to 0, and resets orientation to portrait if the new kind can't rotate.
- Preview canvas: its pixel size is `export size × scale`, where `scale = min(containerW/exportW, containerH/exportH) × devicePixelRatio`. Its CSS size is the pixel size divided by DPR. Re-render on container resize with a `ResizeObserver`.
- Drag-over the preview shows a dashed outline. Drop uses `pickImageFile(e.dataTransfer.files)`. A window `paste` listener uses `pickImageFile(e.clipboardData.files)` and ignores the event when that returns null. On a load error, show `IMAGE_ERROR` under the preview for 5 s and keep the old image.
- Clicking the preview while it is empty opens the file picker.
- Page title: "Mockup Maker". Footer line: "Runs entirely in your browser — images are never uploaded."

- [ ] **Step 1: Implement** `controls.ts` (build the DOM, bind events, and expose `sync(scene)` to update the controls' enabled state) and `main.ts`. Keep the CSS plain: system font, neutral grays, 8 px radius.
- [ ] **Step 2: Run** `npm test && npm run build`. Expected: tests PASS and the build succeeds with no TS errors.
- [ ] **Step 3: Manual check in the browser** (`npm run dev`):
  - Choose iPhone 17 and upload a PNG. It appears clipped inside the screen, under the Dynamic Island.
  - Switch to Landscape. The device rotates and the screenshot stays upright.
  - Fill/Fit visibly changes cropping.
  - Each aspect changes the canvas shape. With Tight selected, Size is disabled.
  - Transparent, solid, and gradient backgrounds all work.
  - Download produces a 3840×2160 PNG. Opened in Preview, a transparent background is transparent, with no checkerboard.
  - Paste a screenshot with ⌘V, and drag-and-drop a file.
  - Drop a `.pdf` and the error message appears.
  - Reload the page and the settings are kept.
  - Pick MacBook Pro 14", Apple Watch Ultra, and Pixel 10 and check they look right.
  - At 375 px wide (devtools), the panel stacks and nothing overflows.
- [ ] **Step 4: Commit.** Message: `feat: editor UI with preview, controls and download`.

---

### Task 7: Deploy and README

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1:** Create a workflow that runs on push to `main`. It uses Node 22 and runs `npm ci && npm test && npm run build`, then `actions/upload-pages-artifact` with `path: dist` and `actions/deploy-pages`. It needs the permissions `pages: write` and `id-token: write`.
- [ ] **Step 2:** In the README, describe what the tool is, add the run-locally commands (`npm i`, `npm run dev`, `npm test`), and explain how to add a device: append a row to `src/devices/specs.json` and check the contact sheet. Note that frames are stylized drawings and not official artwork.
- [ ] **Step 3:** Run `npm run build && npx vite preview`. Open the printed URL and confirm the app works from `dist/`, including the relative asset paths.
- [ ] **Step 4: Commit.** Message: `chore: GitHub Pages deploy and README`.
- [ ] **Step 5 (the user does this):** In the GitHub repo, go to Settings → Pages → Source and choose "GitHub Actions". Then push.
