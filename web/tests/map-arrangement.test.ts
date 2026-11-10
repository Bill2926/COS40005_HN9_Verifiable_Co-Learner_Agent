import { describe, expect, it } from 'vitest'
import { avoid, connectors, defaultArrangement, placeCard, pointAt } from '../app/map/arrangement'
import type { MapTopic } from '../shared/turn'

const card = { width: 200, height: 100 }
const canvas = { width: 1000, height: 500 }

describe('map arrangement', () => {
  it('converts between a point and a box, and clamps both inside the canvas', () => {
    expect(placeCard({ x: 0.25, y: 0.5 }, card, canvas)).toEqual({
      x: 200,
      y: 200,
      width: 200,
      height: 100,
    })
    expect(placeCard({ x: -0.2, y: 3 }, card, canvas)).toEqual({
      x: 0,
      y: 400,
      width: 200,
      height: 100,
    })
    expect(pointAt(200, 200, card, canvas)).toEqual({ x: 0.25, y: 0.5 })
    expect(pointAt(-50, 1000, card, canvas)).toEqual({ x: 0, y: 1 })
    expect(pointAt(10, 10, { width: 1200, height: 800 }, canvas)).toEqual({ x: 0, y: 0 })
    expect(placeCard({ x: 0.4, y: 0.6 }, { width: 1200, height: 800 }, canvas)).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    })
  })

  it('starts a wide canvas from frame 18:444, and flows any topic the frame leaves out', () => {
    const arrangement = defaultArrangement(
      ['variable', 'if_else', 'for_loop', 'nested_loop', 'while_loop'],
      { width: 1440, height: 900 },
    )

    // Frame 18:444, kept as fractions of the room a card can move in.
    expect(arrangement.variable).toEqual({ x: 0.082, y: 0.162 })
    expect(arrangement.if_else).toEqual({ x: 0.42, y: 0.116 })
    expect(arrangement.for_loop).toEqual({ x: 0.144, y: 0.352 })
    expect(arrangement.nested_loop).toEqual({ x: 0.541, y: 0.705 })
    // Fifth topic, one row of five, last column: left 1179.2 of a 1232-wide room, top 64 of an 820-tall room.
    expect(arrangement.while_loop).toEqual({ x: 0.9571428571428572, y: 0.07804878048780488 })
  })

  it('draws one connector for each consecutive pair, in course order, styled by the topic it leads into', () => {
    const topics: MapTopic[] = [
      { id: 'variable', name: 'Variables', summary: 'Foundation', state: 'mastered', current: false },
      { id: 'if_else', name: 'If / else', summary: 'Branching logic', state: 'mastered', current: false },
      { id: 'for_loop', name: 'For loops', summary: 'Repeating with a running total', state: 'open', current: true },
      {
        id: 'nested_loop',
        name: 'Nested loops',
        summary: 'Loops inside loops',
        state: 'closed',
        current: false,
        closedReason: 'Needs For loops.',
      },
    ]
    const boxes = {
      variable: { x: 0, y: 0, width: 100, height: 40 },
      if_else: { x: 300, y: 20, width: 100, height: 40 },
      for_loop: { x: 40, y: 200, width: 120, height: 50 },
      nested_loop: { x: 400, y: 360, width: 110, height: 60 },
    }

    const lines = connectors(topics, boxes)

    expect(lines.map(line => [line.from, line.to, line.kind])).toEqual([
      ['variable', 'if_else', 'mastered'],
      ['if_else', 'for_loop', 'current'],
      ['for_loop', 'nested_loop', 'closed'],
    ])
    expect(lines.map(line => line.path)).toEqual([
      'M 50 20 C 200 20, 200 40, 350 40',
      'M 350 40 C 225 40, 225 225, 100 225',
      'M 100 225 C 277.5 225, 277.5 390, 455 390',
    ])
  })

  it('moves a card out from under a panel by the shortest route', () => {
    const canvas = { width: 800, height: 600 }
    const card = { x: 300, y: 140, width: 100, height: 80 }
    const panel = { x: 250, y: 120, width: 200, height: 160 }

    // Above is 108px, below 148px, and either side 158px, with the 8px gap.
    expect(avoid(card, [panel], canvas)).toEqual({ x: 300, y: 32, width: 100, height: 80 })
  })

  it('stays inside the canvas when a shorter route would leave it', () => {
    const canvas = { width: 400, height: 300 }
    const card = { x: 0, y: 0, width: 100, height: 80 }
    const panel = { x: 0, y: 0, width: 180, height: 150 }

    // Above and left leave the canvas. Below is 158px and inside; right is 188px.
    expect(avoid(card, [panel], canvas)).toEqual({ x: 0, y: 158, width: 100, height: 80 })
  })

  it('leaves the card where it is when there is no room inside the canvas', () => {
    const canvas = { width: 220, height: 180 }
    const card = { x: 60, y: 50, width: 100, height: 80 }
    const panel = { x: 0, y: 0, width: 220, height: 180 }

    expect(avoid(card, [panel], canvas)).toEqual({ x: 60, y: 50, width: 100, height: 80 })
  })

  it('leaves a card that is already clear of every panel where it is', () => {
    const canvas = { width: 800, height: 600 }
    const card = { x: 20, y: 20, width: 100, height: 80 }
    const panel = { x: 400, y: 300, width: 200, height: 120 }

    expect(avoid(card, [panel], canvas)).toEqual({ x: 20, y: 20, width: 100, height: 80 })
  })
})
