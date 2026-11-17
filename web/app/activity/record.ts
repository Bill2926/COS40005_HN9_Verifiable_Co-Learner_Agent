// Client reports of actions that do not already pass through a server handler.
// A failure here does not undo the action the student just took.

export async function recordStudentActivity(body: Record<string, unknown>): Promise<void> {
  try {
    await $fetch('/api/student', { method: 'POST', body })
  }
  catch {
    // The activity log is a record, not a gate.
  }
}
