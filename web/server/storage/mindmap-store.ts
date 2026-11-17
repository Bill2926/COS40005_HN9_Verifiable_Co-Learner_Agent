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
}

export function createMemoryMindmapStore(): MindmapStore {
  const stored = new Map<string, MindmapRecord>()
  const key = (studentId: string, courseId: string) => `${studentId}\0${courseId}`
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
  }
}
