import { createClient } from '@supabase/supabase-js'
import type { MindmapRecord, MindmapStore } from './mindmap-store'

export function createSupabaseMindmapStore(options: { url: string, secretKey: string }): MindmapStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async read(studentId, courseId) {
      const [positions, notes, links] = await Promise.all([
        supabase.from('mindmap_positions').select('module_id, x, y')
          .eq('student_id', studentId).eq('course_id', courseId),
        supabase.from('mindmap_notes').select('id, text, colour, image_path, x, y')
          .eq('student_id', studentId).eq('course_id', courseId).order('id'),
        supabase.from('mindmap_links').select('id, from_note_id, target_kind, target_id')
          .eq('student_id', studentId).eq('course_id', courseId).order('id'),
      ])
      if (positions.error) throw new Error(positions.error.message)
      if (notes.error) throw new Error(notes.error.message)
      if (links.error) throw new Error(links.error.message)
      return {
        positions: positions.data.map(row => ({ moduleId: row.module_id, x: row.x, y: row.y })),
        notes: notes.data.map(row => ({
          id: row.id,
          text: row.text,
          colour: row.colour,
          imagePath: row.image_path,
          x: row.x,
          y: row.y,
        })),
        links: links.data.map(row => ({
          id: row.id,
          fromNoteId: row.from_note_id,
          target: row.target_kind === 'module'
            ? { kind: 'module' as const, moduleId: row.target_id }
            : { kind: 'note' as const, noteId: row.target_id },
        })),
      }
    },
    async save(studentId, courseId, record) {
      await replace(supabase, studentId, courseId, record)
    },
  }
}

async function replace(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
  courseId: string,
  record: MindmapRecord,
): Promise<void> {
  const cleared = await Promise.all([
    supabase.from('mindmap_links').delete().eq('student_id', studentId).eq('course_id', courseId),
    supabase.from('mindmap_positions').delete().eq('student_id', studentId).eq('course_id', courseId),
  ])
  for (const result of cleared) {
    if (result.error) throw new Error(result.error.message)
  }
  const notesCleared = await supabase.from('mindmap_notes').delete().eq('student_id', studentId).eq('course_id', courseId)
  if (notesCleared.error) throw new Error(notesCleared.error.message)

  if (record.positions.length > 0) {
    const inserted = await supabase.from('mindmap_positions').insert(record.positions.map(position => ({
      student_id: studentId,
      course_id: courseId,
      module_id: position.moduleId,
      x: position.x,
      y: position.y,
    })))
    if (inserted.error) throw new Error(inserted.error.message)
  }
  if (record.notes.length > 0) {
    const inserted = await supabase.from('mindmap_notes').insert(record.notes.map(note => ({
      id: note.id,
      student_id: studentId,
      course_id: courseId,
      text: note.text,
      colour: note.colour,
      image_path: note.imagePath,
      x: note.x,
      y: note.y,
    })))
    if (inserted.error) throw new Error(inserted.error.message)
  }
  if (record.links.length > 0) {
    const inserted = await supabase.from('mindmap_links').insert(record.links.map(link => ({
      id: link.id,
      student_id: studentId,
      course_id: courseId,
      from_note_id: link.fromNoteId,
      target_kind: link.target.kind,
      target_id: link.target.kind === 'module' ? link.target.moduleId : link.target.noteId,
    })))
    if (inserted.error) throw new Error(inserted.error.message)
  }
}
