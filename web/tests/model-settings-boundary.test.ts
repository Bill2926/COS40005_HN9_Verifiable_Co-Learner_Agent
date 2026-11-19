import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'
import { createSupabaseModelSettingsStore } from '../server/storage/supabase-model-settings-store'

const boundaryKey = 'sk-boundary-secret-a1b2'

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

describe('model settings boundary', () => {
  it('lets a signed-in student neither read nor write the model settings', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(secretKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)
    expect(publishableKey).not.toBe(secretKey)

    const supabase = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const an = demoAccounts[0]
    const signedIn = await supabase.auth.signInWithPassword({
      email: an.email,
      password: an.password,
    })
    expect(signedIn.error).toBeNull()

    const store = createSupabaseModelSettingsStore({ url, secretKey })
    const previous = await store.read()
    try {
      await store.save({
        provider: 'fake',
        apiKey: boundaryKey,
        baseUrl: 'https://example.test',
        modelName: 'boundary-model',
      })

      const selected = await supabase.from('model_settings').select('*')
      if (selected.error) expect(selected.error.code).toBe('42501')
      else expect(selected.data).toEqual([])
      expect(JSON.stringify(selected)).not.toContain(boundaryKey)

      const inserted = await supabase.from('model_settings').insert({
        id: 1,
        provider: 'real',
        api_key: 'stolen-key-value',
        base_url: 'https://example.test',
        model_name: 'stolen',
      })
      expect(inserted.error?.code).toBe('42501')
      expect(inserted.data).toBeNull()

      const updated = await supabase.from('model_settings').update({
        api_key: 'stolen-key-value',
      }).eq('id', 1)
      expect(updated.data ?? []).toEqual([])

      expect(await store.read()).toEqual({
        provider: 'fake',
        apiKey: boundaryKey,
        baseUrl: 'https://example.test',
        modelName: 'boundary-model',
      })
    }
    finally {
      if (previous) await store.save(previous)
      else {
        const admin = createClient(url, secretKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        await admin.from('model_settings').delete().eq('id', 1)
      }
    }
  }, 20_000)
})
