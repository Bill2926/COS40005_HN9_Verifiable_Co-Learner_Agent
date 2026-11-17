export interface MindmapPosition {
  moduleId: string
  x: number
  y: number
}

export interface MindmapNote {
  id: string
  text: string
  colour: string
  imagePath: string | null
  x: number
  y: number
}

export type MindmapLinkTarget =
  | { kind: 'module', moduleId: string }
  | { kind: 'note', noteId: string }

export interface MindmapLink {
  id: string
  fromNoteId: string
  target: MindmapLinkTarget
}

export interface MindmapRecord {
  positions: MindmapPosition[]
  notes: MindmapNote[]
  links: MindmapLink[]
}

export interface MindmapStore {
  read: (studentId: string, courseId: string) => Promise<MindmapRecord>
  save: (studentId: string, courseId: string, record: MindmapRecord) => Promise<void>
  insertNote: (studentId: string, courseId: string, note: MindmapNote) => Promise<void>
  updateNote: (studentId: string, courseId: string, note: MindmapNote) => Promise<void>
  deleteNote: (studentId: string, courseId: string, noteId: string) => Promise<boolean>
  insertLink: (studentId: string, courseId: string, link: MindmapLink) => Promise<boolean>
  deleteLink: (studentId: string, courseId: string, linkId: string) => Promise<boolean>
  upsertPosition: (studentId: string, courseId: string, position: MindmapPosition) => Promise<void>
  importPositions: (studentId: string, courseId: string, positions: MindmapPosition[]) => Promise<boolean>
  resetPositions: (studentId: string, courseId: string) => Promise<boolean>
}

function sameTarget(left: MindmapLinkTarget, right: MindmapLinkTarget): boolean {
  if (left.kind === 'module' && right.kind === 'module') return left.moduleId === right.moduleId
  if (left.kind === 'note' && right.kind === 'note') return left.noteId === right.noteId
  return false
}

export function createMemoryMindmapStore(): MindmapStore {
  const stored = new Map<string, MindmapRecord>()
  const resetArrangements = new Set<string>()
  const key = (studentId: string, courseId: string) => `${studentId}\0${courseId}`
  function load(studentId: string, courseId: string): MindmapRecord {
    const id = key(studentId, courseId)
    const existing = stored.get(id)
    if (existing) return existing
    const created: MindmapRecord = { positions: [], notes: [], links: [] }
    stored.set(id, created)
    return created
  }
  return {
    async read(studentId, courseId) {
      const record = stored.get(key(studentId, courseId))
      return record
        ? structuredClone(record)
        : { positions: [], notes: [], links: [] }
    },
    async save(studentId, courseId, record) {
      stored.set(key(studentId, courseId), structuredClone(record))
    },
    async insertNote(studentId, courseId, note) {
      load(studentId, courseId).notes.push(structuredClone(note))
    },
    async updateNote(studentId, courseId, note) {
      const record = load(studentId, courseId)
      const index = record.notes.findIndex(item => item.id === note.id)
      if (index >= 0) record.notes[index] = structuredClone(note)
    },
    async deleteNote(studentId, courseId, noteId) {
      const record = load(studentId, courseId)
      const before = record.notes.length
      record.notes = record.notes.filter(note => note.id !== noteId)
      record.links = record.links.filter(link =>
        link.fromNoteId !== noteId && !(link.target.kind === 'note' && link.target.noteId === noteId))
      return record.notes.length !== before
    },
    async insertLink(studentId, courseId, link) {
      const record = load(studentId, courseId)
      const exists = record.links.some(item =>
        item.fromNoteId === link.fromNoteId && sameTarget(item.target, link.target))
      if (exists) return false
      record.links.push(structuredClone(link))
      return true
    },
    async deleteLink(studentId, courseId, linkId) {
      const record = load(studentId, courseId)
      const before = record.links.length
      record.links = record.links.filter(link => link.id !== linkId)
      return record.links.length !== before
    },
    async upsertPosition(studentId, courseId, position) {
      const record = load(studentId, courseId)
      const existing = record.positions.find(item => item.moduleId === position.moduleId)
      if (existing) {
        existing.x = position.x
        existing.y = position.y
      }
      else {
        record.positions.push({ ...position })
      }
    },
    async importPositions(studentId, courseId, positions) {
      const record = load(studentId, courseId)
      if (resetArrangements.has(key(studentId, courseId)) || record.positions.length || !positions.length) return false
      record.positions = positions.map(position => ({ ...position }))
      return true
    },
    async resetPositions(studentId, courseId) {
      const record = load(studentId, courseId)
      resetArrangements.add(key(studentId, courseId))
      const hadPositions = record.positions.length > 0
      record.positions = []
      return hadPositions
    },
  }
}
