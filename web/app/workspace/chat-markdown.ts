// The small slice of Markdown a teacher or deskmate reply uses: paragraphs,
// inline code, bold, italic, bullet and numbered lists, and fenced code. It
// produces a tree, never HTML, so a reply cannot inject markup. Every rule
// degrades to plain text while a reply is still streaming in, so a half-typed
// `code span or **bold never flashes or throws.

export type InlineNode =
  | { type: 'text', value: string }
  | { type: 'code', value: string }
  | { type: 'strong', children: InlineNode[] }
  | { type: 'em', children: InlineNode[] }
  | { type: 'break' }

export type BlockNode =
  | { type: 'paragraph', children: InlineNode[] }
  | { type: 'codeblock', language: string, value: string }
  | { type: 'list', ordered: boolean, items: InlineNode[][] }

const fence = /^\s*```\s*([\w+-]*)\s*$/
const bullet = /^\s*[-*+]\s+(.*)$/
const numbered = /^\s*\d+[.)]\s+(.*)$/
const heading = /^\s{0,3}#{1,6}\s+(.*)$/

export function parseChatMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: BlockNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean, items: InlineNode[][] } | null = null

  function endParagraph() {
    if (paragraph.length === 0) return
    const children: InlineNode[] = []
    paragraph.forEach((line, index) => {
      if (index > 0) children.push({ type: 'break' })
      children.push(...parseInline(line))
    })
    blocks.push({ type: 'paragraph', children })
    paragraph = []
  }

  function endList() {
    if (!list) return
    blocks.push({ type: 'list', ordered: list.ordered, items: list.items })
    list = null
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''

    const open = fence.exec(line)
    if (open) {
      endParagraph()
      endList()
      const body: string[] = []
      index += 1
      while (index < lines.length && !fence.test(lines[index] ?? '')) {
        body.push(lines[index] ?? '')
        index += 1
      }
      blocks.push({ type: 'codeblock', language: open[1] ?? '', value: body.join('\n') })
      continue
    }

    if (line.trim() === '') {
      endParagraph()
      endList()
      continue
    }

    const bulletMatch = bullet.exec(line)
    const numberMatch = bulletMatch ? null : numbered.exec(line)
    const item = bulletMatch ?? numberMatch
    if (item) {
      endParagraph()
      const ordered = numberMatch !== null
      if (list && list.ordered !== ordered) endList()
      list ??= { ordered, items: [] }
      list.items.push(parseInline(item[1] ?? ''))
      continue
    }

    const headingMatch = heading.exec(line)
    if (headingMatch) {
      endParagraph()
      endList()
      blocks.push({
        type: 'paragraph',
        children: [{ type: 'strong', children: parseInline(headingMatch[1] ?? '') }],
      })
      continue
    }

    endList()
    paragraph.push(line)
  }

  endParagraph()
  endList()
  return blocks
}

// Inline code is swapped for a placeholder first so its contents are never read
// as emphasis, yet emphasis can still wrap it: **`print()` shows text**.
const slot = /(\d+)/g

function parseInline(source: string): InlineNode[] {
  const codes: string[] = []
  const masked = source
    .replace(/[]/g, '')
    .replace(/`([^`\n]+)`/g, (_, value: string) => `${codes.push(value) - 1}`)
  if (codes.length === 0) return parseEmphasis(masked)
  return restoreCode(parseEmphasis(masked), codes)
}

function restoreCode(nodes: InlineNode[], codes: string[]): InlineNode[] {
  return nodes.flatMap((node): InlineNode[] => {
    if (node.type === 'strong' || node.type === 'em') {
      return [{ ...node, children: restoreCode(node.children, codes) }]
    }
    if (node.type !== 'text') return [node]
    const out: InlineNode[] = []
    let cursor = 0
    for (const match of node.value.matchAll(slot)) {
      const start = match.index ?? 0
      if (start > cursor) out.push({ type: 'text', value: node.value.slice(cursor, start) })
      out.push({ type: 'code', value: codes[Number(match[1])] ?? '' })
      cursor = start + match[0].length
    }
    if (cursor < node.value.length) out.push({ type: 'text', value: node.value.slice(cursor) })
    return out
  })
}

// A marker opens only next to a word and closes only next to one, so
// total_cost, 2 * 3 * 4 and a lone * stay as typed.
const strong = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/
const emphasis = /(?<![\w*_])([*_])(?![\s*_])(.+?)(?<![\s*_])\1(?![\w*_])/

function parseEmphasis(source: string): InlineNode[] {
  const bold = strong.exec(source)
  const slanted = emphasis.exec(source)
  const hit = bold && (!slanted || bold.index <= slanted.index) ? bold : slanted
  if (!hit) return source.length > 0 ? [{ type: 'text', value: source }] : []

  const before = source.slice(0, hit.index)
  const after = source.slice(hit.index + hit[0].length)
  return [
    ...(before ? [{ type: 'text', value: before } as const] : []),
    { type: hit === bold ? 'strong' : 'em', children: parseEmphasis(hit[2] ?? '') },
    ...parseEmphasis(after),
  ]
}
