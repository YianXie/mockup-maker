// Node ≥25 ships a global `localStorage` getter that returns undefined without --localstorage-file,
// shadowing jsdom's. Expose jsdom's Storage to tests instead.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom
if (dom && typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true })
}
