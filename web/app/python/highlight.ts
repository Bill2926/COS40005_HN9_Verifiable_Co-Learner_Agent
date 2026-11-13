import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const pythonHighlightColours = {
  comment: 'var(--color-ink-400)',
  keyword: 'var(--color-purple-600)',
  literal: 'var(--color-emerald-600)',
  name: 'var(--color-brand-600)',
  text: 'var(--color-ink-800)',
} as const

const pythonHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: pythonHighlightColours.comment },
  { tag: tags.keyword, color: pythonHighlightColours.keyword, fontWeight: '700' },
  { tag: [tags.number, tags.string, tags.bool, tags.null], color: pythonHighlightColours.literal },
  { tag: tags.variableName, color: pythonHighlightColours.name, fontWeight: '700' },
  { tag: [tags.operator, tags.punctuation], color: pythonHighlightColours.text },
])

export const pythonHighlighting = syntaxHighlighting(pythonHighlightStyle)
