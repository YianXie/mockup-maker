# Mockup Editor — Design

Date: 2026-11-21

## Intent

A small personal web tool. Pick a device, drop in a screenshot, and get a
clean device mockup image that looks good on a presentation slide. The user
is not a designer. It has to be obvious to use, and the output only needs to
look "ok on a slideshow", not photoreal.

It is free, needs no sign-in, and runs entirely in the browser. Uploaded
images never leave the user's machine.

## Goals

- Choose a device model from a dropdown, grouped by family (iPhone, iPad,
  Mac, Apple Watch, Android).
- Upload a screenshot (file picker, drag-and-drop, or paste from the
  clipboard). It appears inside the device's screen.
- A few simple edits:
  - **Canvas aspect ratio:** 16:9 (default, for slides), 4:3, 1:1, 9:16,
    and "Tight", which crops to the device plus padding.
  - **Background:** transparent (default), solid color, or one of about 6
    gradient presets.
  - **Frame color:** a few presets per device (e.g. black, silver, white).
  - **Orientation:** portrait or landscape, for phones and tablets only.
  - **Image fit:** fill (crop to the screen, default) or fit (letterbox).
  - **Device size:** a slider for how much of the canvas the device fills.
- Live preview that matches the export exactly.
- Download the result as a PNG at slide-friendly resolution (16:9 → 3840×2160).

## Non-goals

- Several devices on one canvas, text, annotations, arrows.
- 3D perspective, tilt, shadows beyond one simple soft drop shadow.
- Saving or reopening projects, or a history.
- Video or animated mockups.
- Photoreal frames.

## Anti-goals (failure even if it works)

- Any upload of the user's image to a server.
- Accounts, sign-in, ads, trackers, or paywalls.
- A cluttered, designer-grade UI. If a control needs explaining, cut it.

## Constraints

- Static site with no backend. It must be hostable for free (GitHub Pages).
- No device artwork with unclear licensing. All frames are drawn by our own
  code.
- Works in current desktop Chrome, Safari, and Firefox. Mobile layout should
  not break, but desktop is the target.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Frames generated from a device table** | Stylized, not photoreal. One data row per model, so broad coverage is cheap and new models are easy to add. | **Chosen** |
| B. Existing open-source CSS device frames | More detail, but a fixed and often outdated model list, and DOM-to-image export is flaky. | Rejected |
| C. Photoreal PNG frame images | Licensing problems (Apple marketing assets, unlicensed Android renders) and manual screen alignment per model. | Rejected |

The user picked A.

## Design

### Tech (builder's call, stated here)

- Vite + TypeScript, no UI framework. The UI is one panel of controls.
- Canvas 2D rendering. A single `render(ctx, scene, scale)` function draws
  both the preview (scaled down) and the export (full size), so they cannot
  drift apart.
- Vitest for unit tests.
- Deployed to GitHub Pages through a GitHub Actions workflow.

### Device table

Each device is a data record, for example:

```ts
{
  id: "iphone-15-pro",
  name: "iPhone 15 Pro",
  family: "iPhone",          // iPhone | iPad | Mac | Watch | Android
  kind: "phone",             // phone | tablet | laptop | watch
  screen: { w: 1179, h: 2556 },   // native pixels, portrait
  screenRadius: 0.11,        // corner radius as a fraction of screen width
  bezel: 0.035,              // bezel thickness as a fraction of screen width
  bodyRadius: ...,           // outer corner radius
  cutout: { type: "island", w: ..., h: ..., top: ... }, // none|notch|island|punch|homebutton
  buttons: [...],            // simple side-button rectangles (optional)
  colors: [{ name: "Black Titanium", body: "#2b2b2d" }, ...]
}
```

Proportions are relative, so one drawing routine per `kind` covers every model:

- **phone:** rounded body, rounded screen, a cutout, small side-button
  stubs. Older iPhones with a home button use the `homebutton` cutout and
  larger top and bottom bezels.
- **tablet:** an even bezel and an optional camera dot. Home-button iPads
  are out of scope for v1.
- **laptop:** a lid with the screen and a thin top bezel, a camera notch on
  newer MacBooks, and a flatter, wider base drawn beneath it.
- **watch:** a rounded-square case, the screen, a digital crown, and a side
  button. No band.

### Initial model list (v1)

- **iPhone:** 11, 12/12 mini, 13/13 mini, 14/14 Plus, 14 Pro/Pro Max,
  15/15 Plus/15 Pro/Pro Max, 16/16 Plus/16 Pro/Pro Max, 16e,
  17/17 Pro/Pro Max, iPhone Air, SE (3rd gen)
- **iPad:** iPad (A16), iPad mini (A17 Pro), iPad Air 11"/13" (M2/M3),
  iPad Pro 11"/13" (M4)
- **Mac:** MacBook Air 13"/15", MacBook Pro 14"/16"
- **Apple Watch:** Series 10/11 (42 mm/46 mm), Ultra 2/3, SE (40 mm/44 mm)
- **Android:** Pixel 8/8 Pro, 9/9 Pro/9 Pro XL, 10/10 Pro, Galaxy S24/S24
  Ultra, S25/S25 Ultra, Galaxy A55, OnePlus 12/13

Models with identical dimensions can share a record under a combined name.
The builder checks screen resolution and cutout type against public spec
sheets. Small inaccuracies in bezel or cutout size are fine, since the
frames are stylized.

### Layout math

- Canvas size comes from the aspect ratio. The long side is 3840 px for
  export.
- The device is scaled to fit inside the canvas at `deviceSize` (default
  80%) of the limiting dimension, then centered.
- "Tight" sets the canvas to the device bounding box plus 8% padding.
- Landscape rotates the device drawing by 90°, and the screenshot is placed
  in the rotated screen.
- Fill: the image covers the screen rect and is center-cropped. Fit: the
  image is contained and the rest of the screen is black.
- The screenshot is clipped to the rounded screen shape. Cutouts are drawn
  on top of it.

### UI

```
┌──────────────────────────────┬──────────────┐
│                              │ Device   [▼] │
│                              │ Color    ●●○ │
│        live preview          │ Portrait/Land│
│     (drop image here)        │ Fill / Fit   │
│                              │ Aspect  [16:9]│
│                              │ Background   │
│                              │  ⌀ ■ ▧▧▧▧    │
│                              │ Size  ──●──  │
│                              │ [Upload]     │
│                              │ [Download PNG]│
└──────────────────────────────┴──────────────┘
```

- Empty state: the device shows a neutral placeholder screen with the text
  "Drop a screenshot, paste, or click Upload".
- The last chosen device and settings are remembered in `localStorage`.
  This is wrapped in try/catch, and the app falls back to defaults.
- Transparent background shows as a checkerboard in the preview only.

### Error handling

- Non-image file: inline message, nothing else changes.
- Very large images are fine because the canvas downsamples. Aspect
  mismatch with the screen is handled by Fill/Fit, with no warning.

### Testing

- Unit tests: device table validity (every record has its required fields,
  sane ratios, and at least one color, and ids are unique), plus the layout
  math (canvas sizing, device fit, fill/fit rects, landscape).
- Manual visual pass: render every device once and look at a contact sheet.
  A small dev-only page that draws all devices in a grid makes this quick.

## Calls made during review (correct if wrong)

- **Landscape:** the screenshot stays upright relative to the viewer, so a
  landscape screenshot fills a landscape screen.
- **Tight aspect:** the Size slider is disabled, since the canvas is defined
  by the device plus padding.
- **Shadow:** always on, subtle, no control.
- **Solid background:** a free color picker (native `<input type="color">`).
- **Default device:** the newest base iPhone in the list (iPhone 17).
- **Download with no screenshot:** disabled until an image is loaded.

## Left to the builder

- Exact bezel, radius, and cutout numbers per model, from spec sheets and
  eyeballing.
- Gradient presets and color palettes.
- Visual styling of the control panel. Keep it plain and neat.
- Shadow parameters.
