import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoAccounts } from '../server/auth/demo-accounts'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function envValue(name: string): string {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess

  const envFile = resolve(webRoot, '.env')
  if (!existsSync(envFile)) return ''

  const line = readFileSync(envFile, 'utf8')
    .split('\n')
    .find(entry => entry.startsWith(`${name}=`))
  if (!line) return ''

  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

function requiredEnv(name: string): string {
  const value = envValue(name)
  if (!value) throw new Error(`Missing ${name}. The rehearsal reads web/.env.`)
  return value
}

function adminClient(): SupabaseClient {
  return createClient(requiredEnv('NUXT_PUBLIC_SUPABASE_URL'), requiredEnv('NUXT_SUPABASE_SECRET_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function demoStudentIds(admin: SupabaseClient): Promise<string[]> {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listed.error) throw new Error(listed.error.message)

  return demoAccounts.map((account) => {
    const user = listed.data.users.find(candidate => candidate.email === account.email)
    if (!user) throw new Error(`Demo account ${account.email} is not seeded.`)
    return user.id
  })
}

export async function resetDemoAccounts() {
  const admin = adminClient()
  const ids = await demoStudentIds(admin)
  const conversations = await admin.from('conversations').delete().in('student_id', ids)
  if (conversations.error) throw new Error(conversations.error.message)
  const resumePoints = await admin.from('resume_points').delete().in('student_id', ids)
  if (resumePoints.error) throw new Error(resumePoints.error.message)
}

export async function demoAccountsAreClear(): Promise<boolean> {
  const admin = adminClient()
  const ids = await demoStudentIds(admin)
  const conversations = await admin.from('conversations').select('id').in('student_id', ids)
  if (conversations.error) throw new Error(conversations.error.message)
  const resumePoints = await admin.from('resume_points').select('student_id').in('student_id', ids)
  if (resumePoints.error) throw new Error(resumePoints.error.message)
  return (conversations.data ?? []).length === 0 && (resumePoints.data ?? []).length === 0
}
