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

// One stored event as the learning pattern reads it: when it happened, its kind,
// the module it belongs to (from the payload, null when it has none) and the
// payload itself.
export interface ActivityRow {
  time: string
  type: ActivityEventType
  moduleId: string | null
  payload: Record<string, unknown>
}

export interface ActivityRecorder {
  record: (event: ActivityEvent) => Promise<void>
  // The student's events oldest first; what the learning pattern computes from.
  forStudent: (studentId: string) => Promise<ActivityRow[]>
}

const droppedKeys = new Set(['code', 'draft', 'keystrokes'])

export function activityPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !droppedKeys.has(key)))
}

export function createMemoryActivityLog(now: () => Date = () => new Date()): ActivityRecorder & { events: ActivityEvent[] } {
  const events: ActivityEvent[] = []
  // Each event paired with the time it was recorded, so the two can never drift apart.
  const rows: { event: ActivityEvent, time: string }[] = []
  return {
    events,
    async record(event) {
      const stored: ActivityEvent = {
        studentId: event.studentId,
        courseId: event.courseId,
        type: event.type,
        payload: activityPayload(event.payload),
      }
      events.push(stored)
      rows.push({ event: stored, time: now().toISOString() })
    },
    async forStudent(studentId) {
      return rows
        .filter(row => row.event.studentId === studentId)
        .map(({ event, time }) => ({
          time,
          type: event.type,
          moduleId: typeof event.payload.moduleId === 'string' ? event.payload.moduleId : null,
          payload: { ...event.payload },
        }))
    },
  }
}
