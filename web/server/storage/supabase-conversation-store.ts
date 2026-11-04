import { createClient } from '@supabase/supabase-js'
import type { ConversationStore, MessageAuthor, ResumePoint, StoredMessage } from './conversation-store'

export function createSupabaseConversationStore(options: {
  url: string
  secretKey: string
}): ConversationStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  async function conversationId(studentId: string, topicId: string): Promise<string> {
    const existing = await supabase
      .from('conversations')
      .select('id')
      .eq('student_id', studentId)
      .eq('topic_id', topicId)
      .maybeSingle()
    if (existing.error) throw new Error(existing.error.message)
    if (existing.data) return existing.data.id

    const inserted = await supabase
      .from('conversations')
      .insert({ student_id: studentId, topic_id: topicId })
      .select('id')
      .single()
    if (!inserted.error) return inserted.data.id
    if (inserted.error.code !== '23505') throw new Error(inserted.error.message)

    const again = await supabase
      .from('conversations')
      .select('id')
      .eq('student_id', studentId)
      .eq('topic_id', topicId)
      .single()
    if (again.error) throw new Error(again.error.message)
    return again.data.id
  }

  return {
    async displayName(studentId) {
      const result = await supabase
        .from('students')
        .select('display_name')
        .eq('id', studentId)
        .single()
      if (result.error) throw new Error(result.error.message)
      return result.data.display_name
    },
    async resumePoint(studentId) {
      const result = await supabase
        .from('resume_points')
        .select('topic_id, exercise_id')
        .eq('student_id', studentId)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      if (!result.data) return null
      return {
        topicId: result.data.topic_id,
        exerciseId: result.data.exercise_id,
      } satisfies ResumePoint
    },
    async saveResumePoint(studentId, point) {
      const result = await supabase.from('resume_points').upsert({
        student_id: studentId,
        topic_id: point.topicId,
        exercise_id: point.exerciseId,
      }, { onConflict: 'student_id' })
      if (result.error) throw new Error(result.error.message)
    },
    async messages(studentId, topicId) {
      const conversation = await supabase
        .from('conversations')
        .select('id')
        .eq('student_id', studentId)
        .eq('topic_id', topicId)
        .maybeSingle()
      if (conversation.error) throw new Error(conversation.error.message)
      if (!conversation.data) return []

      const result = await supabase
        .from('messages')
        .select('id, sequence, author, approved_move, text, exercise_id')
        .eq('conversation_id', conversation.data.id)
        .order('sequence', { ascending: true })
      if (result.error) throw new Error(result.error.message)
      return (result.data ?? []).map(presentRow)
    },
    async appendMessage(studentId, topicId, message) {
      const id = await conversationId(studentId, topicId)
      const result = await supabase
        .from('messages')
        .insert({
          conversation_id: id,
          author: message.author,
          approved_move: message.approvedMove,
          text: message.text,
          exercise_id: message.exerciseId,
        })
        .select('id, sequence, author, approved_move, text, exercise_id')
        .single()
      if (result.error) throw new Error(result.error.message)
      return presentRow(result.data)
    },
  }
}

function presentRow(row: {
  id: string
  sequence: number
  author: string
  approved_move: string | null
  text: string
  exercise_id: string
}): StoredMessage {
  return {
    id: row.id,
    sequence: row.sequence,
    author: authorOf(row.author),
    approvedMove: row.approved_move,
    text: row.text,
    exerciseId: row.exercise_id,
  }
}

function authorOf(author: string): MessageAuthor {
  if (author === 'student' || author === 'teacher' || author === 'deskmate' || author === 'event') {
    return author
  }
  throw new Error('Stored message has an unknown author.')
}
