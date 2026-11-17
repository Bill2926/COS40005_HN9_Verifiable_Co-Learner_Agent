export type MessageAuthor = 'student' | 'teacher' | 'deskmate' | 'event'

export interface StoredMessage {
  id: string
  sequence: number
  author: MessageAuthor
  approvedMove: string | null
  text: string
  exerciseId: string
  // When the message was written, as an ISO time. Messages written before
  // times were recorded have none.
  createdAt: string | null
}

export interface ResumePoint {
  moduleId: string
  exerciseId: string
}

export interface NewMessage {
  author: MessageAuthor
  approvedMove: string | null
  text: string
  exerciseId: string
}

export interface ConversationStore {
  displayName: (studentId: string) => Promise<string>
  resumePoint: (studentId: string) => Promise<ResumePoint | null>
  saveResumePoint: (studentId: string, point: ResumePoint) => Promise<void>
  messages: (studentId: string, moduleId: string) => Promise<StoredMessage[]>
  appendMessage: (studentId: string, moduleId: string, message: NewMessage) => Promise<StoredMessage>
}

export function createMemoryConversationStore(
  displayNames: Readonly<Record<string, string>> = {},
): ConversationStore {
  const resumePoints = new Map<string, ResumePoint>()
  const conversations = new Map<string, StoredMessage[]>()

  function key(studentId: string, moduleId: string) {
    return `${studentId}\0${moduleId}`
  }

  return {
    async displayName(studentId) {
      const name = displayNames[studentId]
      if (name === undefined) throw new Error('That student has no display name.')
      return name
    },
    async resumePoint(studentId) {
      const point = resumePoints.get(studentId)
      return point ? { ...point } : null
    },
    async saveResumePoint(studentId, point) {
      resumePoints.set(studentId, { moduleId: point.moduleId, exerciseId: point.exerciseId })
    },
    async messages(studentId, moduleId) {
      return (conversations.get(key(studentId, moduleId)) ?? []).map(message => ({ ...message }))
    },
    async appendMessage(studentId, moduleId, message) {
      const stored = conversations.get(key(studentId, moduleId)) ?? []
      const appended: StoredMessage = {
        id: crypto.randomUUID(),
        sequence: stored.length + 1,
        author: message.author,
        approvedMove: message.approvedMove,
        text: message.text,
        exerciseId: message.exerciseId,
        createdAt: new Date().toISOString(),
      }
      stored.push(appended)
      conversations.set(key(studentId, moduleId), stored)
      return { ...appended }
    },
  }
}
