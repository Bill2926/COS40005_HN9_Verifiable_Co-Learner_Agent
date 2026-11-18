import { createClient } from '@supabase/supabase-js'
import type { MindmapPosition, MindmapRecord, MindmapStore } from './mindmap-store'

export function createSupabaseMindmapStore(options: { url: string, secretKey: string }): MindmapStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async read(studentId, courseId) {
      const [positions, notes, links] = await Promise.all([
        supabase.from('mindmap_positions').select('module_id, x, y')
          .eq('student_id', studentId).eq('course_id', courseId),
        supabase.from('mindmap_notes').select('id, text, colour, x, y, image_path')
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
          x: row.x,
          y: row.y,
          imagePath: row.image_path ?? null,
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
      await write(studentId, courseId, record)
    },
    async insertNote(studentId, courseId, note, link) {
      const inserted = await supabase.rpc('insert_mindmap_note', {
        p_student_id: studentId,
        p_course_id: courseId,
        p_note_id: note.id,
        p_text: note.text,
        p_colour: note.colour,
        p_x: note.x,
        p_y: note.y,
        p_link_id: link.id,
        p_target_kind: link.target.kind,
        p_target_id: link.target.kind === 'module' ? link.target.moduleId : link.target.noteId,
      })
      if (inserted.error) throw new Error(inserted.error.message)
      return inserted.data === true
    },
    async updateNote(studentId, courseId, note) {
      const updated = await supabase.from('mindmap_notes').update({
        text: note.text,
        colour: note.colour,
        x: note.x,
        y: note.y,
        image_path: note.imagePath ?? null,
      }).eq('id', note.id).eq('student_id', studentId).eq('course_id', courseId)
      if (updated.error) throw new Error(updated.error.message)
    },
    async deleteNote(studentId, courseId, noteId) {
      const targeting = await supabase.from('mindmap_links').delete()
        .eq('student_id', studentId).eq('course_id', courseId)
        .eq('target_kind', 'note').eq('target_id', noteId)
      if (targeting.error) throw new Error(targeting.error.message)
      const removed = await supabase.from('mindmap_notes').delete()
        .eq('id', noteId).eq('student_id', studentId).eq('course_id', courseId)
        .select('id')
      if (removed.error) throw new Error(removed.error.message)
      return removed.data.length > 0
    },
    async insertLink(studentId, courseId, link) {
      const inserted = await supabase.from('mindmap_links').insert({
        id: link.id,
        student_id: studentId,
        course_id: courseId,
        from_note_id: link.fromNoteId,
        target_kind: link.target.kind,
        target_id: link.target.kind === 'module' ? link.target.moduleId : link.target.noteId,
      })
      if (inserted.error?.code === '23505') return false
      if (inserted.error) throw new Error(inserted.error.message)
      return true
    },
    async deleteLink(studentId, courseId, linkId) {
      const removed = await supabase.from('mindmap_links').delete()
        .eq('id', linkId).eq('student_id', studentId).eq('course_id', courseId)
        .select('id')
      if (removed.error) throw new Error(removed.error.message)
      return removed.data.length > 0
    },
    async upsertPosition(studentId, courseId, position) {
      const saved = await supabase.from('mindmap_positions').upsert({
        student_id: studentId,
        course_id: courseId,
        module_id: position.moduleId,
        x: position.x,
        y: position.y,
      }, { onConflict: 'student_id,course_id,module_id' })
      if (saved.error) throw new Error(saved.error.message)
    },
    importPositions: updateArrangement,
    resetPositions: (studentId, courseId) => updateArrangement(studentId, courseId, null),
  }

  async function updateArrangement(studentId: string, courseId: string, positions: MindmapPosition[] | null): Promise<boolean> {
    const updated = await supabase.rpc('update_mindmap_arrangement', {
      p_student_id: studentId,
      p_course_id: courseId,
      p_positions: positions,
    })
    if (updated.error) throw new Error(updated.error.message)
    return updated.data === true
  }

  async function write(studentId: string, courseId: string, record: MindmapRecord) {
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
      x: note.x,
      y: note.y,
      image_path: note.imagePath ?? null,
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
}
