import { describe, expect, it } from 'vitest'
import { createMemoryActivityLog } from '../server/activity-recorder'
import { handleStudent } from '../server/student'
import { createMemoryMindmapStore } from '../server/storage/mindmap-store'
import { createMemoryProfileStore } from '../server/storage/profile-store'
import { createMemoryStudentFileStore } from '../server/storage/student-file-store'

const studentId = '6f1b0c1e-1111-4111-8111-111111111111'
const otherStudentId = '6f1b0c1e-2222-4222-8222-222222222222'
const courseId = 'intro_python'
const moduleIds = ['getting_started', 'variables', 'strings', 'loops'] as const

// 1×1 PNG. The handler checks the decoded bytes, not the characters on the wire.
const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function setup() {
  const activity = createMemoryActivityLog()
  const profile = createMemoryProfileStore({
    [studentId]: { displayName: 'An', studentNumber: 'SWB0002', campus: 'Hanoi', picturePath: null },
    [otherStudentId]: { displayName: 'Bình', studentNumber: 'SWB0001', campus: null, picturePath: null },
  })
  const mindmap = createMemoryMindmapStore()
  const files = createMemoryStudentFileStore()
  const request = {
    sessionStudentId: studentId,
    email: 'an@example.com',
    courseId,
    moduleIds,
    activity,
    profile,
    mindmap,
    files,
  }
  const call = (body: unknown, extra: Partial<typeof request> & { preview?: boolean } = {}) =>
    handleStudent({ ...request, ...extra, body })
  return { activity, profile, mindmap, files, call }
}

describe('student handler', () => {
  it('rejects a request when there is no session', async () => {
    const { call } = setup()
    await expect(call({ event: 'signed_in' }, { sessionStudentId: null })).rejects.toMatchObject({
      name: 'SignInRequiredError',
      statusCode: 401,
    })
  })

  it('records one sign-in and nothing about a course', async () => {
    const { activity, call } = setup()
    await call({ event: 'signed_in' })
    expect(activity.events).toEqual([{
      studentId,
      courseId: null,
      type: 'signed_in',
      payload: {},
    }])
  })

  it.each([
    { body: { event: 'module_opened', moduleId: 'getting_started' }, type: 'module_opened', payload: { moduleId: 'getting_started' } },
    { body: { event: 'mode_switched', mode: 'practice' }, type: 'mode_switched', payload: { mode: 'practice' } },
    { body: { event: 'layout_switched', layout: 'mindmap' }, type: 'layout_switched', payload: { layout: 'mindmap' } },
  ] as const)('records one $type event', async ({ body, type, payload }) => {
    const { activity, call } = setup()
    await call(body)
    expect(activity.events).toEqual([{ studentId, courseId, type, payload }])
  })

  it('records a run without the code or the draft', async () => {
    const { activity, call } = setup()
    await call({ event: 'code_run', exerciseId: 'say_hello', code: 'print(1)', draft: 'print(1)', keystrokes: 'p' })
    expect(activity.events).toEqual([{
      studentId,
      courseId,
      type: 'code_run',
      payload: { exerciseId: 'say_hello' },
    }])
  })

  it('records nothing when a report is only read or is rejected', async () => {
    const { activity, call } = setup()
    await call({ event: 'open' })
    await expect(call({ event: 'module_opened', moduleId: 'not_a_module' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(call({ event: 'mode_switched', mode: 'exam' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(call({ event: 'code_run', code: 'print(1)' })).rejects.toMatchObject({ statusCode: 400 })
    expect(activity.events).toEqual([])
  })

  it('records nothing for a preview and writes nothing', async () => {
    const { activity, call } = setup()
    const state = await call({ event: 'note_created', text: 'A private note', colour: 'ink', x: 3, y: 4, target: { kind: 'module', moduleId: 'loops' } }, { preview: true })
    expect(activity.events).toEqual([])
    expect(state.mindmap.notes).toEqual([])
    expect((await call({ event: 'open' })).mindmap.notes).toEqual([])
  })

  it('changes the display name and leaves the student number and email alone', async () => {
    const { activity, call } = setup()
    const state = await call({ event: 'profile_changed', displayName: 'An Nguyen', studentNumber: 'SWB9999', email: 'other@example.com' })
    expect(state.profile).toMatchObject({
      displayName: 'An Nguyen',
      studentNumber: 'SWB0002',
      email: 'an@example.com',
      pictureUrl: null,
    })
    expect(activity.events).toEqual([{
      studentId,
      courseId,
      type: 'profile_changed',
      payload: { displayName: true, picture: false },
    }])
  })

  it('rejects a profile change that tries to set the student number on its own', async () => {
    const { activity, call } = setup()
    await expect(call({ event: 'profile_changed', studentNumber: 'SWB9999' })).rejects.toMatchObject({
      name: 'StudentRequestError',
      statusCode: 400,
    })
    expect((await call({ event: 'open' })).profile.studentNumber).toBe('SWB0002')
    expect(activity.events).toEqual([])
  })

  it('rejects a picture that is not a JPEG, PNG or WebP', async () => {
    const { call } = setup()
    await expect(call({
      event: 'profile_changed',
      picture: { contentType: 'image/gif', base64: tinyPng },
    })).rejects.toMatchObject({ statusCode: 400, message: /JPEG, PNG or WebP/ })
  })

  it('rejects a picture larger than 2 MB', async () => {
    const { call } = setup()
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 1)
    await expect(call({
      event: 'profile_changed',
      picture: { contentType: 'image/png', base64: bytes.toString('base64') },
    })).rejects.toMatchObject({ statusCode: 400, message: /2 MB/ })
  })

  it('stores a square picture and shows it on the profile', async () => {
    const { activity, call } = setup()
    const state = await call({
      event: 'profile_changed',
      picture: { contentType: 'image/png', base64: tinyPng },
    })
    expect(state.profile.pictureUrl).toMatch(/^memory:6f1b0c1e/)
    expect(activity.events.map(event => event.type)).toEqual(['profile_changed'])
    expect(activity.events[0]?.payload).toEqual({ displayName: false, picture: true })
    expect(JSON.stringify(activity.events)).not.toContain(tinyPng)
  })

  it('keeps a moved module and refuses to remove one', async () => {
    const { activity, call } = setup()
    const moved = await call({ event: 'mindmap_moved', kind: 'module', id: 'getting_started', x: 12, y: 40 })
    expect(moved.mindmap.positions).toEqual([{ moduleId: 'getting_started', x: 12, y: 40 }])
    await expect(call({ event: 'module_removed', moduleId: 'getting_started' })).rejects.toMatchObject({ statusCode: 400 })
    expect((await call({ event: 'open' })).mindmap.positions).toEqual([{ moduleId: 'getting_started', x: 12, y: 40 }])
    expect(activity.events).toEqual([{
      studentId,
      courseId,
      type: 'mindmap_moved',
      payload: { kind: 'module', id: 'getting_started' },
    }])
  })

  it('imports a device arrangement once', async () => {
    const { activity, call } = setup()
    const imported = await call({
      event: 'import_arrangement',
      positions: [
        { moduleId: 'getting_started', x: 1, y: 2 },
        { moduleId: 'variables', x: 3, y: 4 },
      ],
    })
    expect(imported.mindmap.positions).toEqual([
      { moduleId: 'getting_started', x: 1, y: 2 },
      { moduleId: 'variables', x: 3, y: 4 },
    ])
    await call({
      event: 'import_arrangement',
      positions: [{ moduleId: 'strings', x: 9, y: 9 }],
    })
    expect((await call({ event: 'open' })).mindmap.positions).toEqual([
      { moduleId: 'getting_started', x: 1, y: 2 },
      { moduleId: 'variables', x: 3, y: 4 },
    ])
    expect(activity.events).toEqual([{
      studentId,
      courseId,
      type: 'mindmap_moved',
      payload: { imported: true },
    }])
  })

  it('does not restore a local arrangement after an account reset', async () => {
    const { activity, call } = setup()
    await call({ event: 'mindmap_moved', kind: 'module', id: 'getting_started', x: 12, y: 40 })
    expect((await call({ event: 'reset_arrangement' })).mindmap.positions).toEqual([])
    const state = await call({
      event: 'import_arrangement',
      positions: [{ moduleId: 'getting_started', x: 1, y: 2 }],
    })
    expect(state.mindmap.positions).toEqual([])
    expect(activity.events.map(event => event.payload)).toEqual([
      { kind: 'module', id: 'getting_started' },
      { reset: true },
    ])
  })

  it('creates, recolours, links and deletes a note, one event each', async () => {
    const { activity, call } = setup()
    const created = await call({ event: 'note_created', text: 'A loop keeps going', colour: 'brand', x: 5, y: 6, target: { kind: 'module', moduleId: 'loops' } })
    const note = created.mindmap.notes[0]
    expect(note).toMatchObject({ text: 'A loop keeps going', colour: 'brand', x: 5, y: 6 })
    const other = await call({ event: 'note_created', text: 'Indexes start at zero', colour: 'ink', x: 8, y: 1, target: { kind: 'module', moduleId: 'strings' } })
    const second = other.mindmap.notes.find(item => item.text === 'Indexes start at zero')
    await call({ event: 'note_changed', noteId: note!.id, text: 'A loop keeps a running total', colour: 'emerald' })
    await call({ event: 'note_linked', noteId: note!.id, target: { kind: 'note', noteId: second!.id } })
    const linked = await call({ event: 'open' })
    expect(linked.mindmap.links).toEqual([
      expect.objectContaining({ fromNoteId: note!.id, target: { kind: 'module', moduleId: 'loops' } }),
      expect.objectContaining({ fromNoteId: second!.id, target: { kind: 'module', moduleId: 'strings' } }),
      expect.objectContaining({ fromNoteId: note!.id, target: { kind: 'note', noteId: second!.id } }),
    ])
    const linkId = linked.mindmap.links.find(link => link.target.kind === 'note')!.id
    await call({ event: 'note_unlinked', linkId })
    await call({ event: 'note_deleted', noteId: note!.id })
    const after = await call({ event: 'open' })
    expect(after.mindmap.notes.map(item => item.id)).toEqual([second!.id])
    expect(after.mindmap.links).toEqual([
      expect.objectContaining({ fromNoteId: second!.id, target: { kind: 'module', moduleId: 'strings' } }),
    ])
    expect(activity.events.map(event => event.type)).toEqual([
      'note_created',
      'note_created',
      'note_changed',
      'note_linked',
      'note_unlinked',
      'note_deleted',
    ])
    expect(JSON.stringify(activity.events)).not.toContain('A loop keeps')
  })

  it('creates a note and its first link in one event', async () => {
    const { activity, call } = setup()
    const created = await call({ event: 'note_created', text: 'A loop', colour: 'brand', x: 1, y: 1, target: { kind: 'module', moduleId: 'loops' } })
    const note = created.mindmap.notes[0]!
    expect(created.mindmap.links).toEqual([
      expect.objectContaining({ fromNoteId: note.id, target: { kind: 'module', moduleId: 'loops' } }),
    ])
    expect(activity.events.map(event => event.type)).toEqual(['note_created'])
    expect(activity.events[0]!.payload).toMatchObject({ noteId: note.id })
  })

  it('creates a note linked to another note', async () => {
    const { call } = setup()
    const first = await call({ event: 'note_created', text: 'One', colour: 'ink', x: 1, y: 1, target: { kind: 'module', moduleId: 'loops' } })
    const firstId = first.mindmap.notes[0]!.id
    const second = await call({ event: 'note_created', text: 'Two', colour: 'ink', x: 2, y: 2, target: { kind: 'note', noteId: firstId } })
    expect(second.mindmap.links).toContainEqual(expect.objectContaining({ target: { kind: 'note', noteId: firstId } }))
  })

  it.each([
    { name: 'no target', extra: {} },
    { name: 'an unknown module', extra: { target: { kind: 'module', moduleId: 'nope' } } },
    { name: 'an unknown note', extra: { target: { kind: 'note', noteId: '6f1b0c1e-9999-4999-8999-999999999999' } } },
  ])('refuses a new note with $name and stores nothing', async ({ extra }) => {
    const { activity, call } = setup()
    await expect(call({ event: 'note_created', text: 'Orphan', colour: 'ink', x: 1, y: 1, ...extra })).rejects.toMatchObject({ statusCode: 400 })
    expect((await call({ event: 'open' })).mindmap.notes).toEqual([])
    expect(activity.events).toEqual([])
  })

  it('refuses removing the last link of a note', async () => {
    const { activity, call } = setup()
    const created = await call({ event: 'note_created', text: 'A loop', colour: 'brand', x: 1, y: 1, target: { kind: 'module', moduleId: 'loops' } })
    const linkId = created.mindmap.links[0]!.id
    await expect(call({ event: 'note_unlinked', linkId })).rejects.toMatchObject({ statusCode: 400, message: /at least one link/ })
    expect((await call({ event: 'open' })).mindmap.links).toHaveLength(1)
    expect(activity.events.map(event => event.type)).toEqual(['note_created'])
  })

  it('removes a link when the note keeps another', async () => {
    const { call } = setup()
    const created = await call({ event: 'note_created', text: 'A loop', colour: 'brand', x: 1, y: 1, target: { kind: 'module', moduleId: 'loops' } })
    const noteId = created.mindmap.notes[0]!.id
    const linked = await call({ event: 'note_linked', noteId, target: { kind: 'module', moduleId: 'strings' } })
    const first = linked.mindmap.links.find(link => link.target.kind === 'module' && link.target.moduleId === 'loops')!
    const after = await call({ event: 'note_unlinked', linkId: first.id })
    expect(after.mindmap.links).toHaveLength(1)
  })

  it('does not sign the profile picture on a mindmap event', async () => {
    const { profile, call } = setup()
    await call({ event: 'profile_changed', picture: { contentType: 'image/png', base64: tinyPng } })
    expect((await profile.read(studentId)).picturePath).not.toBeNull()
    const open = await call({ event: 'open' })
    expect(open.profile.pictureUrl).not.toBeNull()
    const created = await call({ event: 'note_created', text: 'A loop', colour: 'brand', x: 1, y: 1, target: { kind: 'module', moduleId: 'loops' } })
    expect(created.profile.pictureUrl).toBeUndefined()
  })

  it('links a note to a module once', async () => {
    const { activity, call } = setup()
    const created = await call({ event: 'note_created', text: 'A loop keeps going', colour: 'brand', x: 1, y: 1, target: { kind: 'module', moduleId: 'loops' } })
    const noteId = created.mindmap.notes[0]!.id
    await call({ event: 'note_linked', noteId, target: { kind: 'module', moduleId: 'strings' } })
    await call({ event: 'note_linked', noteId, target: { kind: 'module', moduleId: 'strings' } })
    const linked = await call({ event: 'open' })
    expect(linked.mindmap.links).toHaveLength(2)
    expect(activity.events.map(event => event.type)).toEqual(['note_created', 'note_linked'])
  })

  it('rejects a note colour outside the palette', async () => {
    const { call } = setup()
    await expect(call({ event: 'note_created', text: 'Hmm', colour: 'neon', x: 0, y: 0, target: { kind: 'module', moduleId: 'loops' } })).rejects.toMatchObject({
      statusCode: 400,
      message: /colour/,
    })
  })

  it('keeps another student from seeing these notes through this handler', async () => {
    const { call } = setup()
    await call({ event: 'note_created', text: 'Only An', colour: 'rose', x: 1, y: 1, target: { kind: 'module', moduleId: 'loops' } })
    const other = await call({ event: 'open' }, { sessionStudentId: otherStudentId, email: 'binh@example.com' })
    expect(other.mindmap.notes).toEqual([])
    expect(other.profile).toMatchObject({ displayName: 'Bình', studentNumber: 'SWB0001', email: 'binh@example.com' })
  })
  describe('campus', () => {
    it('shows the campus on the profile, and null when none is chosen', async () => {
      const { call } = setup()
      expect((await call({ event: 'open' })).profile.campus).toBe('Hanoi')
      expect((await call({ event: 'open' }, { sessionStudentId: otherStudentId, email: 'binh@example.com' })).profile.campus).toBeNull()
    })

    it('lets a student with no campus choose one, once', async () => {
      const { profile, call } = setup()
      const asBinh = { sessionStudentId: otherStudentId, email: 'binh@example.com' }
      const chosen = await call({ event: 'campus_chosen', campus: 'Can Tho' }, asBinh)
      expect(chosen.profile.campus).toBe('Can Tho')
      expect((await profile.read(otherStudentId)).campus).toBe('Can Tho')
      await expect(call({ event: 'campus_chosen', campus: 'Hanoi' }, asBinh)).rejects.toMatchObject({
        name: 'StudentRequestError',
        statusCode: 400,
        message: 'Your campus is already chosen. Ask the product owner to change it.',
      })
      expect((await profile.read(otherStudentId)).campus).toBe('Can Tho')
    })

    it('refuses a campus that is not one of the four', async () => {
      const { call } = setup()
      await expect(call({ event: 'campus_chosen', campus: 'Mars' }, { sessionStudentId: otherStudentId }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Choose Hanoi, Da Nang, Ho Chi Minh City or Can Tho.' })
    })

    it('refuses a student changing a campus through the profile', async () => {
      const { profile, call } = setup()
      await expect(call({ event: 'profile_changed', campus: 'Can Tho' })).rejects.toMatchObject({
        statusCode: 400,
        message: 'The campus cannot be changed here. Ask the product owner.',
      })
      await expect(call({ event: 'profile_changed', displayName: 'An', campus: 'Can Tho' })).rejects.toMatchObject({ statusCode: 400 })
      expect((await profile.read(studentId)).campus).toBe('Hanoi')
    })

    it('holds a student with no campus out of the workspace events until they choose', async () => {
      const { activity, call } = setup()
      const asBinh = { sessionStudentId: otherStudentId, email: 'binh@example.com' }
      await expect(call({ event: 'module_opened', moduleId: 'loops' }, asBinh)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Choose your campus before studying.',
      })
      expect(activity.events).toEqual([])
      // Opening, signing in and the profile stay reachable so the step can show.
      await call({ event: 'open' }, asBinh)
      await call({ event: 'signed_in' }, asBinh)
    })
  })
})
