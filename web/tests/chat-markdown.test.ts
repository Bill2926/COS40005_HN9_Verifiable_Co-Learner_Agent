import { describe, expect, it } from 'vitest'
import { parseChatMarkdown } from '../app/workspace/chat-markdown'

describe('parseChatMarkdown', () => {
  it('turns backticks in a sentence into inline code', () => {
    expect(parseChatMarkdown('Write a `for` loop with `in ds`.')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Write a ' },
          { type: 'code', value: 'for' },
          { type: 'text', value: ' loop with ' },
          { type: 'code', value: 'in ds' },
          { type: 'text', value: '.' },
        ],
      },
    ])
  })

  it('renders bold and italic', () => {
    expect(parseChatMarkdown('This is **very** _important_ and *clear*')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'This is ' },
          { type: 'strong', children: [{ type: 'text', value: 'very' }] },
          { type: 'text', value: ' ' },
          { type: 'em', children: [{ type: 'text', value: 'important' }] },
          { type: 'text', value: ' and ' },
          { type: 'em', children: [{ type: 'text', value: 'clear' }] },
        ],
      },
    ])
  })

  it('leaves markers inside inline code alone', () => {
    expect(parseChatMarkdown('Use `a * b` and `**x**`')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Use ' },
          { type: 'code', value: 'a * b' },
          { type: 'text', value: ' and ' },
          { type: 'code', value: '**x**' },
        ],
      },
    ])
  })

  it('does not treat snake_case or a lone star as emphasis', () => {
    expect(parseChatMarkdown('total_cost and my_var_name, 2 * 3 * 4')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'total_cost and my_var_name, 2 * 3 * 4' }] },
    ])
  })

  it('keeps an unfinished marker as plain text while a reply is still streaming', () => {
    expect(parseChatMarkdown('Take the `total')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'Take the `total' }] },
    ])
    expect(parseChatMarkdown('Take **the')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'Take **the' }] },
    ])
  })

  it('splits paragraphs on a blank line and keeps single newlines as line breaks', () => {
    expect(parseChatMarkdown('First line\nsecond line\n\nNext paragraph')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'First line' },
          { type: 'break' },
          { type: 'text', value: 'second line' },
        ],
      },
      { type: 'paragraph', children: [{ type: 'text', value: 'Next paragraph' }] },
    ])
  })

  it('renders a fenced code block with its language', () => {
    expect(parseChatMarkdown('Try this:\n```python\nfor n in ds:\n    total += n\n```\nThen run it.')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'Try this:' }] },
      { type: 'codeblock', language: 'python', value: 'for n in ds:\n    total += n' },
      { type: 'paragraph', children: [{ type: 'text', value: 'Then run it.' }] },
    ])
  })

  it('shows a fence that has not closed yet as code, so it does not flash as text', () => {
    expect(parseChatMarkdown('```python\nfor n in ds:')).toEqual([
      { type: 'codeblock', language: 'python', value: 'for n in ds:' },
    ])
  })

  it('renders bullet and numbered lists', () => {
    expect(parseChatMarkdown('- one\n- two `x`\n\n1. first\n2. second')).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          [{ type: 'text', value: 'one' }],
          [{ type: 'text', value: 'two ' }, { type: 'code', value: 'x' }],
        ],
      },
      {
        type: 'list',
        ordered: true,
        items: [
          [{ type: 'text', value: 'first' }],
          [{ type: 'text', value: 'second' }],
        ],
      },
    ])
  })

  it('shows a heading as bold text instead of a page heading', () => {
    expect(parseChatMarkdown('## Step 2')).toEqual([
      { type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: 'Step 2' }] }] },
    ])
  })

  it('keeps a materials heading as a heading', () => {
    expect(parseChatMarkdown('## A first program', { headings: true })).toEqual([
      { type: 'heading', level: 2, children: [{ type: 'text', value: 'A first program' }] },
    ])
  })

  it('never produces markup from html in a reply', () => {
    expect(parseChatMarkdown('<b>hi</b> <script>alert(1)</script>')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '<b>hi</b> <script>alert(1)</script>' }] },
    ])
  })

  it('returns nothing for an empty reply', () => {
    expect(parseChatMarkdown('')).toEqual([])
    expect(parseChatMarkdown('  \n\n ')).toEqual([])
  })
})

describe('emphasis around inline code', () => {
  it('lets bold wrap an inline code span', () => {
    expect(parseChatMarkdown('**`print()` shows text on the screen.**')).toEqual([
      {
        type: 'paragraph',
        children: [{
          type: 'strong',
          children: [
            { type: 'code', value: 'print()' },
            { type: 'text', value: ' shows text on the screen.' },
          ],
        }],
      },
    ])
  })
})
