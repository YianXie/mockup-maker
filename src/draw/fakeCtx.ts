/** Test helper: a CanvasRenderingContext2D stand-in that records method calls and property sets. */
export type Call = { op: string; args: unknown[] }
export type FakeCtx = CanvasRenderingContext2D & { calls: Call[] }

export function createFakeCtx(): FakeCtx {
  const calls: Call[] = []
  const props: Record<string, unknown> = {}
  const special: Record<string, (...a: unknown[]) => unknown> = {
    createLinearGradient: () => ({ addColorStop: () => {} }),
    measureText: () => ({ width: 0 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }
  const target = { calls } as unknown as FakeCtx
  return new Proxy(target, {
    get(t, key: string) {
      if (key === 'calls') return calls
      if (key in props) return props[key]
      return (...args: unknown[]) => {
        calls.push({ op: key, args })
        return special[key]?.(...args)
      }
    },
    set(_t, key: string, value) {
      props[key] = value
      calls.push({ op: `set:${key}`, args: [value] })
      return true
    },
  }) as FakeCtx
}
