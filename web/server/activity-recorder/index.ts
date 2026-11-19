// The activity recorder: the one way the server appends to the activity log.
// The student handler and the turn handler both receive it. A payload never
// keeps code, a draft or keystrokes, even if a caller puts them on the event.

export const activityEventTypes = [
  'signed_in',
  'module_opened',
  'mode_switched',
  'layout_switched',
  'code_run',
  'run_finished',
  'pasted',
  'went_idle',
  'returned',
  'submitted',
  'quiz_answered',
  'message_sent',
  'note_created',
  'note_changed',
  'note_linked',
  'note_unlinked',
  'note_deleted',
  'mindmap_moved',
  'profile_changed',
] as const

export type ActivityEventType = (typeof activityEventTypes)[number]

export interface ActivityEvent {
  studentId: string
  courseId: string | null
  type: ActivityEventType
  payload: Record<string, unknown>
}

export interface ActivityRecorder {
  record: (event: ActivityEvent) => Promise<void>
}

const droppedKeys = new Set(['code', 'draft', 'keystrokes'])

export function activityPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !droppedKeys.has(key)))
}

export function createMemoryActivityLog(): ActivityRecorder & { events: ActivityEvent[] } {
  const events: ActivityEvent[] = []
  return {
    events,
    async record(event) {
      events.push({
        studentId: event.studentId,
        courseId: event.courseId,
        type: event.type,
        payload: activityPayload(event.payload),
      })
    },
  }
}
