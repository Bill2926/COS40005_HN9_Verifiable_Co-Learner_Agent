import { createClient } from '@supabase/supabase-js'
import { quizObservation, type QuizAnswerRow, type QuizAnswerStore, type RecordedQuizAnswer } from './quiz-answer-store'

const selected = 'recorded_at, student_id, module_id, question_id, choice, correct'

// Postgres raises this on a unique-constraint violation.
const uniqueViolation = '23505'

export function createSupabaseQuizAnswerStore(options: {
  url: string
  secretKey: string
}): QuizAnswerStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  async function existing(studentId: string, moduleId: string, questionId: string): Promise<QuizAnswerRow> {
    const result = await supabase
      .from('quiz_answers')
      .select(selected)
      .eq('student_id', studentId)
      .eq('module_id', moduleId)
      .eq('question_id', questionId)
      .single()
    if (result.error) throw new Error(result.error.message)
    return presentQuizAnswer(result.data)
  }

  return {
    async observationsForStudent(studentId) {
      const observations = []
      const pageSize = 500
      for (let offset = 0; ; offset += pageSize) {
        const result = await supabase.from('quiz_answers').select(selected)
          .eq('student_id', studentId)
          .order('recorded_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1)
        if (result.error) throw new Error(result.error.message)
        observations.push(...result.data.map(row => quizObservation(presentQuizAnswer(row))))
        if (result.data.length < pageSize) return observations
      }
    },
    async record(answer): Promise<RecordedQuizAnswer> {
      const result = await supabase
        .from('quiz_answers')
        .insert({
          student_id: answer.studentId,
          module_id: answer.moduleId,
          question_id: answer.questionId,
          choice: answer.choice,
          correct: answer.correct,
        })
        .select(selected)
        .single()
      // The unique constraint keeps only the first answer. A second one is not
      // an error: the first answer stands and comes back unchanged.
      if (result.error) {
        if (result.error.code === uniqueViolation) {
          return { row: await existing(answer.studentId, answer.moduleId, answer.questionId), stored: false }
        }
        throw new Error(result.error.message)
      }
      return { row: presentQuizAnswer(result.data), stored: true }
    },
    async forStudentModule(studentId, moduleId) {
      const result = await supabase
        .from('quiz_answers')
        .select(selected)
        .eq('student_id', studentId)
        .eq('module_id', moduleId)
        .order('recorded_at', { ascending: true })
        .order('id', { ascending: true })
      if (result.error) throw new Error(result.error.message)
      return (result.data ?? []).map(presentQuizAnswer)
    },
  }
}

interface QuizAnswerRecord {
  recorded_at: string
  student_id: string
  module_id: string
  question_id: string
  choice: number
  correct: boolean
}

function presentQuizAnswer(row: QuizAnswerRecord): QuizAnswerRow {
  return {
    time: row.recorded_at,
    studentId: row.student_id,
    moduleId: row.module_id,
    questionId: row.question_id,
    choice: row.choice,
    correct: row.correct,
  }
}
