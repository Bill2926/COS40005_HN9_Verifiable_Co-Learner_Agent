import { createClient } from '@supabase/supabase-js'
import type { DailyTurnAllowance } from './daily-turn-allowance'

// Not scoped to a course: the 60 turns are the student's for the day, in every course.
export function createSupabaseDailyTurnAllowance(options: {
  url: string
  secretKey: string
}): DailyTurnAllowance {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async take(studentId, day) {
      const result = await supabase.rpc('take_daily_proposing_turn', {
        p_student_id: studentId,
        p_day: day,
      })
      if (result.error) throw new Error(result.error.message)
      return result.data === true
    },
  }
}
