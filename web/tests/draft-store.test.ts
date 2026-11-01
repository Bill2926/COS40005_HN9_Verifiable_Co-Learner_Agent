import { describe, expect, it } from 'vitest'
import { createDraftStore, draftAfterSwitch } from '../app/drafts/store'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

describe('exercise drafts', () => {
  it('keeps each exercise draft when switching and restores it on the way back', () => {
    const store = createDraftStore(memoryStorage())
    const sumDraft = 'def total(ds):\n    return 6\n'
    const countDraft = 'def count_even(ds):\n    return 2\n'
    const countStarter = 'def count_even(ds):\n    pass\n'

    const enteredCount = draftAfterSwitch(store, {
      leavingId: 'sum_of_a_list',
      leavingCode: sumDraft,
      enteringId: 'count_the_even_numbers',
      enteringStarter: countStarter,
    })

    expect(enteredCount).toBe(countStarter)
    expect(store.read('sum_of_a_list')).toBe(sumDraft)
    expect(store.read('count_the_even_numbers')).toBeNull()

    const backToSum = draftAfterSwitch(store, {
      leavingId: 'count_the_even_numbers',
      leavingCode: countDraft,
      enteringId: 'sum_of_a_list',
      enteringStarter: 'def total(ds):\n    pass\n',
    })

    expect(backToSum).toBe(sumDraft)
    expect(store.read('count_the_even_numbers')).toBe(countDraft)
    expect(store.read('sum_of_a_list')).toBe(sumDraft)
  })
})
