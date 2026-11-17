import { describe, expect, it } from 'vitest'
import { dateMessages } from '../app/workspace/conversation-dates'

const now = new Date('2026-11-17T09:00:00Z')

describe('dateMessages', () => {
  it('puts a day separator before the first message of each day and a time on each message', () => {
    expect(dateMessages([
      { createdAt: '2026-11-12T03:05:00Z' },
      { createdAt: '2026-11-12T04:00:00Z' },
      { createdAt: '2026-11-16T10:00:00Z' },
      { createdAt: '2026-11-17T01:30:00Z' },
    ], now, 'Asia/Ho_Chi_Minh')).toEqual([
      { day: '12 Nov 2026', time: '10:05' },
      { day: null, time: '11:00' },
      { day: 'Yesterday', time: '17:00' },
      { day: 'Today', time: '08:30' },
    ])
  })

  it('reads days in the student\'s time zone', () => {
    // 23:30 UTC on the 16th is already the 17th in Hanoi.
    expect(dateMessages([{ createdAt: '2026-11-16T23:30:00Z' }], now, 'Asia/Ho_Chi_Minh'))
      .toEqual([{ day: 'Today', time: '06:30' }])
    expect(dateMessages([{ createdAt: '2026-11-16T23:30:00Z' }], now, 'UTC'))
      .toEqual([{ day: 'Yesterday', time: '23:30' }])
  })

  it('shows neither a separator nor a time for a message without one', () => {
    expect(dateMessages([
      {},
      { createdAt: '2026-11-17T01:30:00Z' },
      {},
    ], now, 'UTC')).toEqual([
      { day: null, time: null },
      { day: 'Today', time: '01:30' },
      { day: null, time: null },
    ])
  })
})
