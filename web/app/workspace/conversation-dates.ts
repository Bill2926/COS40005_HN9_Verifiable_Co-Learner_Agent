export interface MessageDate {
  // The day separator shown above the message, or null when it continues the
  // previous message's day or has no time.
  day: string | null
  // The local time beside the message, or null when it has no time.
  time: string | null
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function localParts(at: Date, timeZone: string | undefined) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(entry => entry.type === type)?.value ?? ''
  const year = Number(part('year'))
  const month = Number(part('month'))
  const day = Number(part('day'))
  return {
    // Days since the epoch for this calendar date, so adjacent days differ by one.
    dayNumber: Math.round(Date.UTC(year, month - 1, day) / 86_400_000),
    label: `${day} ${months[month - 1]} ${year}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

// Dates each message for the conversation in the student's time zone (the
// browser's when none is given). Messages stored before times were recorded
// get neither a separator nor a time.
export function dateMessages(
  messages: readonly { createdAt?: string }[],
  now: Date = new Date(),
  timeZone?: string,
): MessageDate[] {
  const today = localParts(now, timeZone).dayNumber
  let previousDay: number | null = null
  return messages.map((message) => {
    if (!message.createdAt) return { day: null, time: null }
    const at = new Date(message.createdAt)
    if (Number.isNaN(at.getTime())) return { day: null, time: null }
    const local = localParts(at, timeZone)
    const day = local.dayNumber === previousDay
      ? null
      : local.dayNumber === today
        ? 'Today'
        : local.dayNumber === today - 1 ? 'Yesterday' : local.label
    previousDay = local.dayNumber
    return { day, time: local.time }
  })
}
