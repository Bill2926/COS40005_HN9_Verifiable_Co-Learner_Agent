import { describe, expect, it } from 'vitest'
import { arrangementScale, avoid, connectors, defaultArrangement, fitView, mergeArrangement, placeCard, pointAt, readLegacyArrangement, sizeClassOf, spread } from '../app/mindmap/arrangement'
import type { RoadmapModule } from '../shared/turn'

const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'

const card = { width: 200, height: 100 }
const canvas = { width: 1000, height: 500 }

describe('mindmap arrangement', () => {
  it('converts between a point and a box, including a card past the starting canvas', () => {
    expect(placeCard({ x: 0.25, y: 0.5 }, card, canvas)).toEqual({
      x: 200,
      y: 200,
      width: 200,
      height: 100,
    })
    expect(placeCard({ x: -0.2, y: 3 }, card, canvas)).toEqual({
      x: -160,
      y: 1200,
      width: 200,
      height: 100,
    })
    expect(pointAt(200, 200, card, canvas)).toEqual({ x: 0.25, y: 0.5 })
    expect(pointAt(-50, 1000, card, canvas)).toEqual({ x: -0.0625, y: 2.5 })
    expect(placeCard(pointAt(-50, 1000, card, canvas), card, canvas)).toMatchObject({ x: -50, y: 1000 })
    expect(pointAt(10, 10, { width: 1200, height: 800 }, canvas)).toEqual({ x: 0, y: 0 })
    expect(placeCard({ x: 0.4, y: 0.6 }, { width: 1200, height: 800 }, canvas)).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    })
  })

  it('places the 11 course modules on a wide canvas without overlap', () => {
    const canvas = { width: 1440, height: 900 }
    const scale = arrangementScale(canvas, 11)
    const card = { width: 232 * scale, height: 136 * scale }
    const modules = [
      'getting_started',
      'variables',
      'strings',
      'conditionals',
      'loops',
      'lists_and_tuples',
      'dictionaries_and_sets',
      'functions',
      'modules_and_library',
      'file_handling',
      'error_handling',
    ]
    const arrangement = defaultArrangement(modules, canvas)
    const boxes = modules.map((id) => {
      const point = arrangement[id]
      expect(point, id).toBeDefined()
      return placeCard(point!, card, canvas)
    })

    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(64)
      expect(box.x + box.width).toBeLessThanOrEqual(canvas.width)
      expect(box.y + box.height).toBeLessThanOrEqual(canvas.height - 56)
    }
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        const a = boxes[left]!
        const b = boxes[right]!
        const apart = a.x + a.width <= b.x
          || b.x + b.width <= a.x
          || a.y + a.height <= b.y
          || b.y + b.height <= a.y
        expect(apart, `${modules[left]} overlaps ${modules[right]}`).toBe(true)
      }
    }
  })

  it('places the 11 course modules on a compact canvas without overlap at 375px and 768px', () => {
    const modules = [
      'getting_started',
      'variables',
      'strings',
      'conditionals',
      'loops',
      'lists_and_tuples',
      'dictionaries_and_sets',
      'functions',
      'modules_and_library',
      'file_handling',
      'error_handling',
    ]

    for (const canvas of [
      { width: 375, height: 700 },
      { width: 768, height: 440 },
    ]) {
      const scale = arrangementScale(canvas, modules.length)
      const card = { width: 248 * scale, height: 112 * scale }
      const arrangement = defaultArrangement(modules, canvas)
      const boxes = modules.map((id) => {
        const point = arrangement[id]
        expect(point, id).toBeDefined()
        return placeCard(point!, card, canvas)
      })

      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(64)
        expect(box.x + box.width).toBeLessThanOrEqual(canvas.width)
        expect(box.y + box.height).toBeLessThanOrEqual(canvas.height - 56)
      }
      for (let left = 0; left < boxes.length; left += 1) {
        for (let right = left + 1; right < boxes.length; right += 1) {
          const a = boxes[left]!
          const b = boxes[right]!
          const separated = a.x + a.width <= b.x + 1
            || b.x + b.width <= a.x + 1
            || a.y + a.height <= b.y + 1
            || b.y + b.height <= a.y + 1
          expect(separated, `${modules[left]} overlaps ${modules[right]} on ${canvas.width}px`).toBe(true)
        }
      }
    }
  })

  it('keeps eleven modules apart when a compact canvas is too short for full-size cards', () => {
    const canvas = { width: 667, height: 220 }
    const modules = [
      'getting_started',
      'variables',
      'strings',
      'conditionals',
      'loops',
      'lists_and_tuples',
      'dictionaries_and_sets',
      'functions',
      'modules_and_library',
      'file_handling',
      'error_handling',
    ]
    const scale = arrangementScale(canvas, modules.length)
    const card = { width: 248 * scale, height: 112 * scale }
    const arrangement = defaultArrangement(modules, canvas)
    const boxes = modules.map((id) => {
      const point = arrangement[id]
      if (!point) throw new Error(`${id} has no starting point`)
      return placeCard(point, card, canvas)
    })

    expect(scale).toBeLessThan(1)
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(64)
      expect(box.x + box.width).toBeLessThanOrEqual(canvas.width)
      expect(box.y + box.height).toBeLessThanOrEqual(canvas.height - 80)
    }
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        const a = boxes[left]!
        const b = boxes[right]!
        const separated = a.x + a.width <= b.x
          || b.x + b.width <= a.x
          || a.y + a.height <= b.y
          || b.y + b.height <= a.y
        expect(separated).toBe(true)
      }
    }
  })

  it('draws one connector for each consecutive pair, in course order, styled by the module it leads into', () => {
    const modules: RoadmapModule[] = [
      { id: 'variable', name: 'Variables', part: 'Foundations', summary: 'Foundation', state: 'mastered', current: false, mastery: 0.96 },
      { id: 'if_else', name: 'If / else', part: 'Foundations', summary: 'Branching logic', state: 'mastered', current: false, mastery: 0.96 },
      { id: 'for_loop', name: 'For loops', part: 'Control Flow', summary: 'Repeating with a running total', state: 'open', current: true, mastery: 0.43 },
      {
        id: 'nested_loop',
        name: 'Nested loops',
        part: 'Control Flow',
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

    const lines = connectors(modules, boxes)

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

  it('moves a card off another card and leaves a clear card where it is', () => {
    const canvas = { width: 800, height: 600 }
    const first = { x: 40, y: 40, width: 100, height: 80 }
    const stacked = { x: 40, y: 40, width: 100, height: 80 }
    const clear = { x: 400, y: 400, width: 100, height: 80 }

    const [kept, moved, stayed] = spread([first, stacked, clear], canvas)

    expect(kept).toEqual(first)
    expect(stayed).toEqual(clear)
    expect(moved).toEqual({ x: 40, y: 132, width: 100, height: 80 })
  })

  it('moves a card off another card past the canvas edge without pulling it back on', () => {
    const canvas = { width: 800, height: 600 }
    const first = { x: -300, y: 40, width: 100, height: 80 }
    const stacked = { x: -300, y: 40, width: 100, height: 80 }

    const [, bounded] = spread([first, stacked], canvas)
    const [, unbounded] = spread([first, stacked], canvas, 12, [], false)

    // No spot off the card lies on the canvas, so the bounded spread gives up.
    expect(bounded).toEqual(stacked)
    expect(unbounded).toEqual({ x: -300, y: 132, width: 100, height: 80 })
  })

  it('leaves a card that is already clear of every panel where it is', () => {
    const canvas = { width: 800, height: 600 }
    const card = { x: 20, y: 20, width: 100, height: 80 }
    const panel = { x: 400, y: 300, width: 200, height: 120 }

    expect(avoid(card, [panel], canvas)).toEqual({ x: 20, y: 20, width: 100, height: 80 })
  })
})

describe('legacy mindmap arrangement', () => {
  it('reads both historical keys for the signed-in student and prefers the current size', () => {
    const values: Record<string, string> = {
      [`co-learner-roadmap-arrangement:${an}:wide`]: '{"loops":{"x":0.2,"y":0.3}}',
      [`co-learner-map-arrangement:${an}:compact`]: '{"loops":{"x":0.8,"y":0.1},"strings":{"x":0,"y":1}}',
      [`co-learner-roadmap-arrangement:${binh}:wide`]: '{"variables":{"x":0.5,"y":0.5}}',
    }
    const storage = { getItem: (key: string) => values[key] ?? null }

    expect(readLegacyArrangement(storage, an, 'wide')).toEqual({ loops: { x: 0.2, y: 0.3 }, strings: { x: 0, y: 1 } })
    expect(readLegacyArrangement(storage, an, 'compact')).toEqual({ loops: { x: 0.8, y: 0.1 }, strings: { x: 0, y: 1 } })
    expect(readLegacyArrangement(storage, binh, 'wide')).toEqual({ variables: { x: 0.5, y: 0.5 } })
    expect(sizeClassOf({ width: 1440, height: 900 })).toBe('wide')
    expect(sizeClassOf({ width: 1024, height: 559 })).toBe('compact')
    expect(sizeClassOf({ width: 375, height: 700 })).toBe('compact')
  })

  it('ignores corrupt JSON and stored data that is not an arrangement', () => {
    for (const raw of ['{', '', 'null', '[]', '42', '"for_loop"']) {
      expect(readLegacyArrangement(storageHolding(raw), an, 'wide')).toEqual({})
    }
  })

  it('ignores a malformed point and keeps a point that is on the canvas', () => {
    const store = readLegacyArrangement(storageHolding(JSON.stringify({
      for_loop: { x: 0.4, y: 0.6 },
      variable: { x: 'left', y: 0.2 },
      if_else: null,
      nested_loop: [0.1, 0.2],
      while_loop: { x: 0.3 },
      open_module: { y: 0.5, x: true },
    })), an, 'wide')

    expect(store).toEqual({ for_loop: { x: 0.4, y: 0.6 } })
  })

  it('keeps a point past the starting canvas, and ignores a far-off or non-finite one', () => {
    const store = readLegacyArrangement(storageHolding(JSON.stringify({
      for_loop: { x: -0.2, y: 0.4 },
      variable: { x: 0.2, y: 1.8 },
      if_else: { x: 0, y: 1 },
      loops: { x: 51, y: 0 },
      strings: { x: 0, y: -51 },
    })), an, 'wide')
    const overflow = readLegacyArrangement(storageHolding('{"nested_loop":{"x":1e309,"y":0.2}}'), an, 'compact')

    expect(store).toEqual({
      for_loop: { x: -0.2, y: 0.4 },
      variable: { x: 0.2, y: 1.8 },
      if_else: { x: 0, y: 1 },
    })
    expect(overflow).toEqual({})
  })

  it('uses the starting arrangement for a module with nothing saved', () => {
    const canvas = { width: 1440, height: 900 }
    const starting = defaultArrangement(
      ['variable', 'if_else', 'for_loop', 'nested_loop', 'while_loop'],
      canvas,
    )
    const shown = mergeArrangement(starting, {
      for_loop: { x: 0.5, y: 0.25 },
      not_a_module: { x: 1, y: 1 },
    })

    expect(shown.for_loop).toEqual({ x: 0.5, y: 0.25 })
    // Five cards on a 1440 × 900 canvas, kept clear of the floating panels.
    expect(shown.variable).toEqual({ x: 0.06291390728476821, y: 0.08376963350785341 })
    expect(shown.while_loop).toEqual({ x: 0.9370860927152318, y: 0.33507853403141363 })
    expect(shown.not_a_module).toBeUndefined()
    expect(mergeArrangement(starting, { variable: { x: 0, y: 0 } }).variable).toEqual({ x: 0, y: 0 })
  })
})

function storageHolding(raw: string) {
  return {
    getItem() {
      return raw
    },
  }
}

describe('fit all modules', () => {
  const limits = { min: 0.4, max: 1 }

  it('centres the cards at full size when they already fit', () => {
    const view = fitView([{ x: 100, y: 100, width: 200, height: 100 }], { width: 1000, height: 600 }, [], limits)

    expect(view.zoom).toBe(1)
    expect(view.pan).toEqual({ x: 300, y: 150 })
  })

  it('zooms out to bring a card dragged far off the board back into view, clear of the panels', () => {
    const canvas = { width: 1000, height: 600 }
    const conversation = { x: 640, y: 0, width: 360, height: 600 }
    const cards = [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: -1400, y: 900, width: 200, height: 100 },
    ]
    const { zoom, pan } = fitView(cards, canvas, [conversation], limits)

    expect(zoom).toBeLessThan(1)
    for (const card of cards) {
      const left = card.x * zoom + pan.x
      const top = card.y * zoom + pan.y
      expect(left).toBeGreaterThanOrEqual(0)
      expect(top).toBeGreaterThanOrEqual(0)
      expect(left + card.width * zoom).toBeLessThanOrEqual(conversation.x)
      expect(top + card.height * zoom).toBeLessThanOrEqual(canvas.height)
    }
  })

  it('stops at the smallest zoom when the cards are too spread out to fit', () => {
    const cards = [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 20000, y: 0, width: 200, height: 100 },
    ]

    expect(fitView(cards, { width: 1000, height: 600 }, [], limits).zoom).toBe(0.4)
  })
})
