import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const pythonHighlightColours = {
  comment: '#94a3b8',
  keyword: '#9333ea',
  literal: '#059669',
  name: '#4f46e5',
  text: '#1e293b',
} as const

const pythonHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: pythonHighlightColours.comment },
  { tag: tags.keyword, color: pythonHighlightColours.keyword, fontWeight: '700' },
  { tag: [tags.number, tags.string, tags.bool, tags.null], color: pythonHighlightColours.literal },
  { tag: tags.variableName, color: pythonHighlightColours.name, fontWeight: '700' },
  { tag: [tags.operator, tags.punctuation], color: pythonHighlightColours.text },
])

export const pythonHighlighting = syntaxHighlighting(pythonHighlightStyle)
