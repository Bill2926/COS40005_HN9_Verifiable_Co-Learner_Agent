import { describe, expect, it } from 'vitest'
import { claimIntro, introSeenKey, introStart } from '../app/sign-in/intro'

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value) },
    items,
  }
}

describe('claimIntro', () => {
  it('plays on the first visit and records it', () => {
    const storage = memoryStorage()
    expect(claimIntro(storage, false)).toBe(true)
    expect(storage.items.get(introSeenKey)).toBe('1')
  })

  it('never plays twice on the same device', () => {
    const storage = memoryStorage()
    claimIntro(storage, false)
    expect(claimIntro(storage, false)).toBe(false)
  })

  it('skips under reduced motion but still records the visit', () => {
    const storage = memoryStorage()
    expect(claimIntro(storage, true)).toBe(false)
    expect(storage.items.get(introSeenKey)).toBe('1')
  })

  it('skips when storage is missing or throws', () => {
    expect(claimIntro(undefined, false)).toBe(false)
    const throwing = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(claimIntro(throwing, false)).toBe(false)
  })
})

describe('introStart', () => {
  const lockup = { left: 48, top: 48, width: 200, height: 32 }

  it('moves the lockup centre onto the focus point', () => {
    const start = introStart(lockup, { left: 0, top: 0, width: 720, height: 900 }, { x: 360, y: 450 }, 2.5)
    expect(start.x).toBe(360 - 148)
    expect(start.y).toBe(450 - 64)
    expect(start.scale).toBe(2.5)
  })

  it('shrinks the start scale to fit a narrow stage', () => {
    const start = introStart(lockup, { left: 0, top: 0, width: 348, height: 600 }, { x: 174, y: 200 }, 2.5)
    expect(start.scale).toBe(1.5)
  })

  it('never starts smaller than the resting size', () => {
    const start = introStart(lockup, { left: 0, top: 0, width: 150, height: 600 }, { x: 75, y: 200 }, 2.5)
    expect(start.scale).toBe(1)
  })
})
