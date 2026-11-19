// How many turns a student may have in one calendar day in which an agent is asked to propose.
export const dailyProposingTurnLimit = 60

// One proposing turn, reserved for a student on a calendar day (YYYY-MM-DD).
// True when this turn is within the day's limit; false when the day is already full.
// The caller decides which calendar the day belongs to.
export interface DailyTurnAllowance {
  take: (studentId: string, day: string) => Promise<boolean>
}

export function createMemoryDailyTurnAllowance(): DailyTurnAllowance {
  const taken = new Map<string, number>()

  return {
    async take(studentId, day) {
      const key = `${studentId}\0${day}`
      const count = taken.get(key) ?? 0
      if (count >= dailyProposingTurnLimit) return false
      taken.set(key, count + 1)
      return true
    },
  }
}
