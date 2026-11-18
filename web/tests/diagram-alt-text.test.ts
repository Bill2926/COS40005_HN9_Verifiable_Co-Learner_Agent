import { describe, expect, it } from 'vitest'
import { altTextFromMermaid } from '../scripts/diagram-alt-text'
import { fitWithin } from '../app/utils/shrink-image'

describe('alt text from a diagram', () => {
  it('describes each arrow using the node labels', () => {
    expect(altTextFromMermaid('flowchart LR\n  program[A program] --> shown["print()"]'))
      .toBe('Diagram: A program leads to print().')
    expect(altTextFromMermaid('flowchart LR\n  a[Start] --> b[Next]')).toBe('Diagram: Start leads to Next.')
  })

  it('reuses a label given earlier and keeps an arrow label', () => {
    expect(altTextFromMermaid('flowchart TD\n  a[Ask] --> b[Run]\n  b -->|yes| c[Done]'))
      .toBe('Diagram: Ask leads to Run; Run leads to Done (yes).')
  })

  it('refuses a diagram it cannot describe', () => {
    expect(() => altTextFromMermaid('sequenceDiagram\n  A->>B: hi')).toThrow('no arrows')
  })
})

describe('shrinking an image', () => {
  it('cuts the long side to the limit and keeps the proportions', () => {
    expect(fitWithin(4000, 2000, 1024)).toEqual({ width: 1024, height: 512 })
    expect(fitWithin(500, 3000, 1024)).toEqual({ width: 171, height: 1024 })
  })
  it('does not enlarge a small image', () => {
    expect(fitWithin(300, 200, 1024)).toEqual({ width: 300, height: 200 })
  })
})
