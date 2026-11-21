# Mockup Maker

A tiny, free device-mockup editor that runs entirely in your browser. Pick a device, drop in a screenshot, tweak a few options, and download a PNG sized for slides. No sign-in, and images are never uploaded.

- 72 devices: iPhone 11 → 18 Pro (incl. SE, Air, Duo), iPad, MacBook, Apple Watch, Pixel, Galaxy, OnePlus
- Upload, drag-and-drop, or paste (⌘V / Ctrl+V)
- Aspect ratio (16:9, 4:3, 1:1, 9:16, Tight), background (transparent, solid, gradients), frame color, portrait/landscape, fill/fit, size
- Exports at 3840 px on the long side

Device frames are stylized drawings generated in code from each model's screen specs. They are not official artwork.

## Run locally

```bash
npm i
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

## Add a device

1. Append a row to `src/devices/specs.json`: screen size in native pixels (portrait; laptops landscape), cutout type (`none`, `notch`, `island`, `punch`, `homebutton`, `laptop-notch`), display corner radius in points and scale factor if known (else `0`), and a few frame colors.
2. Run `npm test`. The catalog tests check ids, colors and that the geometry nests. Update the device count in `src/devices/catalog.test.ts`.
3. Open `http://localhost:5173/dev/contact-sheet.html` (add `?o=landscape` for landscape) and check that it looks right.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages. You only need to enable it once: **Settings → Pages → Source: GitHub Actions**.
