import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'

function envValue(name: string): string {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  if (!existsSync('.env')) return ''

  const line = readFileSync('.env', 'utf8')
    .split('\n')
    .find(entry => entry.startsWith(`${name}=`))
  if (!line) return ''

  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

describe('students table boundary', () => {
  it('returns nothing and refuses an insert when a demo student is signed in with the publishable key', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)

    const supabase = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const an = demoAccounts[0]
    const signedIn = await supabase.auth.signInWithPassword({
      email: an.email,
      password: an.password,
    })
    expect(signedIn.error).toBeNull()
    expect(signedIn.data.user?.id).toBeTruthy()

    const selected = await supabase.from('students').select('*')
    if (selected.error) expect(selected.error.code).toBe('42501')
    else expect(selected.data).toEqual([])

    const inserted = await supabase.from('students').insert({
      id: signedIn.data.user!.id,
      display_name: 'Forged',
    })
    expect(inserted.error).not.toBeNull()
    expect(inserted.data).toBeNull()
  }, 20_000)
})
