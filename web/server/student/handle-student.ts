import { canonicalModuleId } from '../course'
import type { ActivityEventType, ActivityRecorder } from '../activity-recorder'
import type { MindmapRecord, MindmapStore } from '../storage/mindmap-store'
import type { ProfileStore } from '../storage/profile-store'
import type { StudentFileStore } from '../storage/student-file-store'
import { isNoteColour, type NoteColour } from '../../shared/mindmap'

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 2 * 1024 * 1024

export class SignInRequiredError extends Error {
  readonly statusCode = 401

  constructor() {
    super('Sign in required')
    this.name = 'SignInRequiredError'
  }
}

export class StudentRequestError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'StudentRequestError'
  }
}

export interface StudentProfileView {
  displayName: string
  email: string
  studentNumber: string
  pictureUrl: string | null
}

export interface StudentNoteView {
  id: string
  text: string
  colour: string
  x: number
  y: number
  imageUrl: string | null
}

export interface StudentResponse {
  profile: StudentProfileView
  mindmap: {
    positions: MindmapRecord['positions']
    notes: StudentNoteView[]
    links: MindmapRecord['links']
  }
}

export interface StudentHandlerRequest {
  sessionStudentId: string | null
  email: string | null
  courseId: string
  moduleIds: readonly string[]
  body: unknown
  activity: ActivityRecorder
  profile: ProfileStore
  mindmap: MindmapStore
  files: StudentFileStore
  // A course preview reads the same shapes and writes nothing.
  preview?: boolean
}

export async function handleStudent(request: StudentHandlerRequest): Promise<StudentResponse> {
  const studentId = requireStudent(request)
  if (request.preview) return present(request, studentId)

  const body = objectBody(request.body)
  const event = eventName(body)
  if (event === 'open') return present(request, studentId)
  if (event === 'signed_in') {
    await recordActivity(request, studentId, 'signed_in', {}, null)
    return present(request, studentId)
  }
  if (event === 'module_opened') {
    const moduleId = requiredModule(body, request.moduleIds)
    await recordActivity(request, studentId, 'module_opened', { moduleId }, request.courseId)
    return present(request, studentId)
  }
  if (event === 'mode_switched') {
    const mode = field(body, 'mode')
    if (mode !== 'learn' && mode !== 'practice') throw new StudentRequestError('Choose Learn or Practice.')
    await recordActivity(request, studentId, 'mode_switched', { mode }, request.courseId)
    return present(request, studentId)
  }
  if (event === 'layout_switched') {
    const layout = field(body, 'layout')
    if (layout !== 'study' && layout !== 'mindmap') throw new StudentRequestError('Choose the Study layout or the Mindmap layout.')
    await recordActivity(request, studentId, 'layout_switched', { layout }, request.courseId)
    return present(request, studentId)
  }
  if (event === 'code_run') {
    const exerciseId = field(body, 'exerciseId')
    if (!exerciseId) throw new StudentRequestError('The exercise is missing.')
    await recordActivity(request, studentId, 'code_run', { exerciseId }, request.courseId)
    return present(request, studentId)
  }
  if (event === 'profile_changed') {
    await changeProfile(request, studentId, body)
    return present(request, studentId)
  }
  if (event === 'mindmap_moved') {
    await moveMindmap(request, studentId, body)
    return present(request, studentId)
  }
  if (event === 'import_arrangement') {
    await importArrangement(request, studentId, body)
    return present(request, studentId)
  }
  if (event === 'reset_arrangement') {
    const changed = await request.mindmap.resetPositions(studentId, request.courseId)
    if (changed) await recordActivity(request, studentId, 'mindmap_moved', { reset: true }, request.courseId)
    return present(request, studentId)
  }
  if (event === 'note_created') {
    await createNote(request, studentId, body)
    return present(request, studentId)
  }
  if (event === 'note_changed') {
    await changeNote(request, studentId, body)
    return present(request, studentId)
  }
  if (event === 'note_linked') {
    await linkNote(request, studentId, body)
    return present(request, studentId)
  }
  if (event === 'note_unlinked') {
    await unlinkNote(request, studentId, body)
    return present(request, studentId)
  }
  if (event === 'note_deleted') {
    await deleteNote(request, studentId, body)
    return present(request, studentId)
  }

  throw new StudentRequestError('The student endpoint does not accept that event.')
}

function requireStudent(request: StudentHandlerRequest): string {
  if (typeof request.sessionStudentId !== 'string' || request.sessionStudentId.length === 0) {
    throw new SignInRequiredError()
  }
  return request.sessionStudentId
}

async function present(request: StudentHandlerRequest, studentId: string): Promise<StudentResponse> {
  const [profile, record] = await Promise.all([
    request.profile.read(studentId),
    request.mindmap.read(studentId, request.courseId),
  ])
  const pictureUrl = profile.picturePath ? await request.files.url(studentId, profile.picturePath) : null
  const notes = await Promise.all(record.notes.map(async (note) => ({
    id: note.id,
    text: note.text,
    colour: note.colour,
    x: note.x,
    y: note.y,
    imageUrl: note.imagePath ? await request.files.url(studentId, note.imagePath) : null,
  })))
  return {
    profile: {
      displayName: profile.displayName,
      email: request.email ?? '',
      studentNumber: profile.studentNumber,
      pictureUrl,
    },
    mindmap: { positions: record.positions, notes, links: record.links },
  }
}

async function recordActivity(
  request: StudentHandlerRequest,
  studentId: string,
  type: ActivityEventType,
  payload: Record<string, unknown>,
  courseId: string | null,
): Promise<void> {
  await request.activity.record({ studentId, courseId, type, payload })
}

async function changeProfile(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  const hasName = 'displayName' in body && body.displayName !== undefined
  const hasPicture = 'picture' in body && body.picture !== undefined
  if (!hasName && !hasPicture) {
    throw new StudentRequestError(
      'studentNumber' in body
        ? 'The student number cannot be changed.'
        : 'There is nothing to change on the profile.',
    )
  }
  const change: { displayName?: string, picturePath?: string | null } = {}
  if (hasName) {
    if (typeof body.displayName !== 'string' || body.displayName.trim() === '') {
      throw new StudentRequestError('The display name is missing.')
    }
    change.displayName = body.displayName.trim()
  }
  if (hasPicture) {
    const image = readImage(body.picture, 'picture')
    await request.files.put(studentId, 'portrait', image)
    change.picturePath = 'portrait'
  }
  await request.profile.save(studentId, change)
  await recordActivity(request, studentId, 'profile_changed', {
    displayName: hasName,
    picture: hasPicture,
  }, request.courseId)
}

async function moveMindmap(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  const kind = field(body, 'kind')
  const id = field(body, 'id')
  const point = coordinates(body)
  if ((kind !== 'module' && kind !== 'note') || !id) throw new StudentRequestError('The mindmap move is missing its item.')
  if (kind === 'module') {
    if (!request.moduleIds.includes(id)) throw new StudentRequestError('That module is not on this course.')
    await request.mindmap.upsertPosition(studentId, request.courseId, { moduleId: id, ...point })
  }
  else {
    const record = await request.mindmap.read(studentId, request.courseId)
    const note = record.notes.find(item => item.id === id)
    if (!note) throw new StudentRequestError('That note was not found.')
    note.x = point.x
    note.y = point.y
    await request.mindmap.updateNote(studentId, request.courseId, note)
  }
  await recordActivity(request, studentId, 'mindmap_moved', { kind, id }, request.courseId)
}

async function importArrangement(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  if (!('positions' in body) || !Array.isArray(body.positions)) {
    throw new StudentRequestError('The arrangement is missing.')
  }
  const positions = new Map<string, ReturnType<typeof coordinates>>()
  for (const position of body.positions) {
    if (typeof position !== 'object' || position === null) throw new StudentRequestError('The arrangement is missing a module.')
    const rawId = field(position, 'moduleId')
    if (!rawId) throw new StudentRequestError('The arrangement is missing a module.')
    const moduleId = canonicalModuleId(rawId)
    if (request.moduleIds.includes(moduleId) && (rawId === moduleId || !positions.has(moduleId))) {
      positions.set(moduleId, coordinates(position))
    }
  }
  const imported = await request.mindmap.importPositions(studentId, request.courseId,
    [...positions].map(([moduleId, point]) => ({ moduleId, ...point })),
  )
  if (imported) await recordActivity(request, studentId, 'mindmap_moved', { imported: true }, request.courseId)
}

async function createNote(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  const text = noteText(body)
  const colour = noteColour(body)
  const point = coordinates(body)
  const image = 'image' in body && body.image !== undefined ? readImage(body.image, 'image') : null
  const id = crypto.randomUUID()
  const imagePath = image ? `notes/${id}` : null
  if (image && imagePath) await request.files.put(studentId, imagePath, image)
  await request.mindmap.insertNote(studentId, request.courseId, { id, text, colour, imagePath, ...point })
  await recordActivity(request, studentId, 'note_created', { noteId: id }, request.courseId)
}

async function changeNote(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  const noteId = field(body, 'noteId')
  if (!noteId) throw new StudentRequestError('The note is missing.')
  const record = await request.mindmap.read(studentId, request.courseId)
  const note = record.notes.find(item => item.id === noteId)
  if (!note) throw new StudentRequestError('That note was not found.')
  if ('text' in body && body.text !== undefined) note.text = noteText(body)
  if ('colour' in body && body.colour !== undefined) note.colour = noteColour(body)
  if ('x' in body || 'y' in body) {
    const point = coordinates(body)
    note.x = point.x
    note.y = point.y
  }
  if ('image' in body && body.image !== undefined) {
    const image = readImage(body.image, 'image')
    const imagePath = `notes/${note.id}`
    await request.files.put(studentId, imagePath, image)
    note.imagePath = imagePath
  }
  await request.mindmap.updateNote(studentId, request.courseId, note)
  await recordActivity(request, studentId, 'note_changed', { noteId }, request.courseId)
}

async function linkNote(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  const noteId = field(body, 'noteId')
  if (!noteId) throw new StudentRequestError('The note is missing.')
  const target = linkTarget(body, request.moduleIds, noteId)
  const record = await request.mindmap.read(studentId, request.courseId)
  if (!record.notes.some(note => note.id === noteId)) throw new StudentRequestError('That note was not found.')
  if (target.kind === 'note' && !record.notes.some(note => note.id === target.noteId)) {
    throw new StudentRequestError('That note was not found.')
  }
  const id = crypto.randomUUID()
  const created = await request.mindmap.insertLink(studentId, request.courseId, { id, fromNoteId: noteId, target })
  if (!created) return
  await recordActivity(request, studentId, 'note_linked', { noteId, linkId: id }, request.courseId)
}

async function unlinkNote(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  const linkId = field(body, 'linkId')
  if (!linkId) throw new StudentRequestError('The link is missing.')
  const removed = await request.mindmap.deleteLink(studentId, request.courseId, linkId)
  if (!removed) throw new StudentRequestError('That link was not found.')
  await recordActivity(request, studentId, 'note_unlinked', { linkId }, request.courseId)
}

async function deleteNote(request: StudentHandlerRequest, studentId: string, body: Record<string, unknown>): Promise<void> {
  const noteId = field(body, 'noteId')
  if (!noteId) throw new StudentRequestError('The note is missing.')
  const removed = await request.mindmap.deleteNote(studentId, request.courseId, noteId)
  if (!removed) throw new StudentRequestError('That note was not found.')
  await recordActivity(request, studentId, 'note_deleted', { noteId }, request.courseId)
}

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new StudentRequestError('The student endpoint does not accept that event.')
  }
  return value as Record<string, unknown>
}

function eventName(body: Record<string, unknown>): string {
  if (typeof body.event !== 'string') {
    throw new StudentRequestError('The student endpoint does not accept that event.')
  }
  return body.event
}

function field(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

function requiredModule(body: Record<string, unknown>, moduleIds: readonly string[]): string {
  const moduleId = field(body, 'moduleId')
  if (!moduleId || !moduleIds.includes(moduleId)) throw new StudentRequestError('That module is not on this course.')
  return moduleId
}

function coordinates(body: Record<string, unknown>): { x: number, y: number } {
  const x = 'x' in body ? body.x : undefined
  const y = 'y' in body ? body.y : undefined
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new StudentRequestError('The position is missing.')
  }
  return { x, y }
}

function noteText(body: Record<string, unknown>): string {
  if (!('text' in body) || typeof body.text !== 'string') throw new StudentRequestError('The note text is missing.')
  return body.text
}

function noteColour(body: Record<string, unknown>): NoteColour {
  if (!('colour' in body) || !isNoteColour(body.colour)) {
    throw new StudentRequestError('Choose a note colour from the palette.')
  }
  return body.colour
}

function linkTarget(body: Record<string, unknown>, moduleIds: readonly string[], fromNoteId: string): MindmapRecord['links'][number]['target'] {
  if (!('target' in body) || typeof body.target !== 'object' || body.target === null) {
    throw new StudentRequestError('The link is missing its target.')
  }
  const target = body.target
  if ('kind' in target && target.kind === 'module' && 'moduleId' in target && typeof target.moduleId === 'string') {
    if (!moduleIds.includes(target.moduleId)) throw new StudentRequestError('That module is not on this course.')
    return { kind: 'module', moduleId: target.moduleId }
  }
  if ('kind' in target && target.kind === 'note' && 'noteId' in target && typeof target.noteId === 'string') {
    if (target.noteId === fromNoteId) throw new StudentRequestError('A note cannot link to itself.')
    return { kind: 'note', noteId: target.noteId }
  }
  throw new StudentRequestError('The link is missing its target.')
}

function readImage(value: unknown, label: 'picture' | 'image'): { bytes: Uint8Array, contentType: string } {
  const name = label === 'picture' ? 'picture' : 'image'
  if (typeof value !== 'object' || value === null) throw new StudentRequestError(`The ${name} is missing.`)
  const contentType = 'contentType' in value && typeof value.contentType === 'string' ? value.contentType : ''
  const base64 = 'base64' in value && typeof value.base64 === 'string' ? value.base64 : ''
  if (!imageTypes.has(contentType)) throw new StudentRequestError('Use a JPEG, PNG or WebP picture.')
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.byteLength === 0 || bytes.byteLength > maxImageBytes) {
    throw new StudentRequestError('The picture must be 2 MB or smaller.')
  }
  return { bytes, contentType }
}
