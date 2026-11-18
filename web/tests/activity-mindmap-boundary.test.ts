import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'
import { createSupabaseActivityLog } from '../server/storage/supabase-activity-log'
import { createSupabaseMindmapStore } from '../server/storage/supabase-mindmap-store'

const permissionDenied = '42501'
const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

function envValue(name: string): string {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  if (!existsSync('.env')) return ''
  const line = readFileSync('.env', 'utf8').split('\n').find(entry => entry.startsWith(`${name}=`))
  if (!line) return ''
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

describe('activity log and mindmap boundary', () => {
  it('lets a signed-in student neither read the activity log nor another student\'s positions, notes or files', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(secretKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)

    const admin = createClient(url, secretKey, noSession)
    const anClient = createClient(url, publishableKey, noSession)
    const an = demoAccounts[0]!
    const binh = demoAccounts[1]!
    const signedIn = await anClient.auth.signInWithPassword({ email: an.email, password: an.password })
    expect(signedIn.error).toBeNull()
    const anId = signedIn.data.user!.id
    const binhUser = await admin.auth.admin.listUsers()
    const binhId = binhUser.data.users.find(user => user.email === binh.email)?.id
    expect(binhId).toBeTruthy()

    const noteId = crypto.randomUUID()
    const mindmap = createSupabaseMindmapStore({ url, secretKey })
    await mindmap.save(binhId!, 'intro_python', {
      positions: [{ moduleId: 'getting_started', x: 1, y: 2 }],
      notes: [{ id: noteId, text: 'ONLY_BINH_NOTE', colour: 'ink', x: 3, y: 4 }],
      links: [],
    })
    const activity = createSupabaseActivityLog({ url, secretKey })
    await activity.record({ studentId: binhId!, courseId: 'intro_python', type: 'note_created', payload: { noteId } })

    const image = await admin.storage.from('student-files').upload(`${binhId}/portrait-secret`, new Uint8Array([1, 2, 3]), {
      contentType: 'image/png',
      upsert: true,
    })
    expect(image.error).toBeNull()

    const anonClient = createClient(url, publishableKey, noSession)
    for (const client of [anonClient, anClient]) {
      const log = await client.from('activity_log').select('*')
      expect(log.error?.code).toBe(permissionDenied)
      const updated = await client.from('activity_log').update({ payload: {} }).eq('student_id', binhId!)
      expect(updated.error?.code).toBe(permissionDenied)
      const deleted = await client.from('activity_log').delete().eq('student_id', binhId!)
      expect(deleted.error?.code).toBe(permissionDenied)
    }

    const notes = await anClient.from('mindmap_notes').select('text')
    expect(notes.error).toBeNull()
    expect(notes.data?.map(row => row.text)).not.toContain('ONLY_BINH_NOTE')
    const positions = await anClient.from('mindmap_positions').select('module_id').eq('student_id', binhId!)
    expect(positions.error).toBeNull()
    expect(positions.data).toEqual([])
    const ownPositions = await admin.from('mindmap_positions').select('module_id').eq('student_id', binhId!)
    expect(ownPositions.error).toBeNull()
    expect(ownPositions.data).toContainEqual({ module_id: 'getting_started' })
    const links = await anClient.from('mindmap_links').select('id').eq('student_id', binhId!)
    expect(links.data ?? []).toEqual([])

    const forged = await anClient.from('mindmap_notes').insert({
      id: crypto.randomUUID(),
      student_id: anId,
      course_id: 'intro_python',
      text: 'Forged',
      colour: 'ink',
      x: 0,
      y: 0,
    })
    expect(forged.error?.code).toBe(permissionDenied)

    const download = await anClient.storage.from('student-files').download(`${binhId}/portrait-secret`)
    expect(download.error).not.toBeNull()
    const uploaded = await anClient.storage.from('student-files').upload(`${binhId}/portrait-forged`, new Uint8Array([1]), {
      contentType: 'image/png',
      upsert: true,
    })
    expect(uploaded.error).not.toBeNull()

    await mindmap.save(binhId!, 'intro_python', { positions: [], notes: [], links: [] })
  }, 20_000)

  it('stores a new note and its first link together', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    const admin = createClient(url, secretKey, noSession)
    const binhId = (await admin.auth.admin.listUsers()).data.users.find(user => user.email === demoAccounts[1]!.email)?.id
    expect(binhId).toBeTruthy()
    const mindmap = createSupabaseMindmapStore({ url, secretKey })
    const noteId = crypto.randomUUID()
    const linkId = crypto.randomUUID()
    try {
      const written = await mindmap.insertNote(binhId!, 'intro_python', { id: noteId, text: 'Linked at birth', colour: 'ink', x: 1, y: 2 }, {
        id: linkId,
        fromNoteId: noteId,
        target: { kind: 'module', moduleId: 'getting_started' },
      })
      expect(written).toBe(true)
      const record = await mindmap.read(binhId!, 'intro_python')
      expect(record.notes.map(note => note.id)).toEqual([noteId])
      expect(record.links).toEqual([{ id: linkId, fromNoteId: noteId, target: { kind: 'module', moduleId: 'getting_started' } }])

      const orphanId = crypto.randomUUID()
      const missing = await mindmap.insertNote(binhId!, 'intro_python', { id: orphanId, text: 'Orphan', colour: 'ink', x: 0, y: 0 }, {
        id: crypto.randomUUID(),
        fromNoteId: orphanId,
        target: { kind: 'note', noteId: crypto.randomUUID() },
      })
      expect(missing).toBe(false)
      expect((await mindmap.read(binhId!, 'intro_python')).notes.map(note => note.id)).toEqual([noteId])
    }
    finally {
      await mindmap.save(binhId!, 'intro_python', { positions: [], notes: [], links: [] })
    }
  }, 20_000)
})
