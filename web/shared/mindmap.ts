// Note colours are palette tokens. Each pair is a tint and a darker text colour
// so the note stays readable on the light theme and, if a dark theme is on, on
// a dark ground. The app itself stays light (see docs/agents/palette.md).

export const noteColours = ['ink', 'brand', 'sky', 'emerald', 'amber', 'rose', 'purple'] as const

export type NoteColour = (typeof noteColours)[number]

export function isNoteColour(value: unknown): value is NoteColour {
  return typeof value === 'string' && (noteColours as readonly string[]).includes(value)
}
