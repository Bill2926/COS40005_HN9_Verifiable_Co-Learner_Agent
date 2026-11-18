export const campuses = ['Hanoi', 'Da Nang', 'Ho Chi Minh City', 'Can Tho'] as const

export type Campus = typeof campuses[number]

export const campusRule = 'Choose Hanoi, Da Nang, Ho Chi Minh City or Can Tho.'

export function isCampus(value: unknown): value is Campus {
  return typeof value === 'string' && (campuses as readonly string[]).includes(value)
}
