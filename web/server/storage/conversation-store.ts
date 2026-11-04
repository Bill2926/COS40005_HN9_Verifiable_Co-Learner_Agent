export type MessageAuthor = 'student' | 'teacher' | 'deskmate' | 'event'

export interface StoredMessage {
  id: string
  sequence: number
  author: MessageAuthor
  approvedMove: string | null
  text: string
  exerciseId: string
}

export interface ResumePoint {
  topicId: string
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
  messages: (studentId: string, topicId: string) => Promise<StoredMessage[]>
  appendMessage: (studentId: string, topicId: string, message: NewMessage) => Promise<StoredMessage>
}

export function createMemoryConversationStore(
  displayNames: Readonly<Record<string, string>> = {},
): ConversationStore {
  const resumePoints = new Map<string, ResumePoint>()
  const conversations = new Map<string, StoredMessage[]>()

  function key(studentId: string, topicId: string) {
    return `${studentId}\0${topicId}`
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
      resumePoints.set(studentId, { topicId: point.topicId, exerciseId: point.exerciseId })
    },
    async messages(studentId, topicId) {
      return (conversations.get(key(studentId, topicId)) ?? []).map(message => ({ ...message }))
    },
    async appendMessage(studentId, topicId, message) {
      const stored = conversations.get(key(studentId, topicId)) ?? []
      const appended: StoredMessage = {
        id: crypto.randomUUID(),
        sequence: stored.length + 1,
        author: message.author,
        approvedMove: message.approvedMove,
        text: message.text,
        exerciseId: message.exerciseId,
      }
      stored.push(appended)
      conversations.set(key(studentId, topicId), stored)
      return { ...appended }
    },
  }
}
