import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cookieFile, ensureCookieDir } from './cookie.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = process.env.COLEARNER_WEB ?? path.resolve(here, '../../../web')
const requireFromWeb = createRequire(path.join(webRoot, 'package.json'))
const { createServerClient } = requireFromWeb('@supabase/ssr')

function parseEnv(text) {
  const entries = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const at = trimmed.indexOf('=')
    if (at < 1) continue
    const name = trimmed.slice(0, at).trim()
    let value = trimmed.slice(at + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    entries[name] = value
  }
  return entries
}

const env = parseEnv(await readFile(path.join(webRoot, '.env'), 'utf8'))
const url = env.NUXT_PUBLIC_SUPABASE_URL
const publishableKey = env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!url || !publishableKey) {
  console.error('NUXT_PUBLIC_SUPABASE_URL or NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing from web/.env.')
  process.exit(1)
}

const email = process.env.COLEARNER_EMAIL ?? 'an@example.com'
const password = process.env.COLEARNER_PASSWORD ?? 'an-demo-password'

const jar = new Map()
const supabase = createServerClient(url, publishableKey, {
  cookies: {
    getAll: () => [...jar.entries()].map(([name, { value }]) => ({ name, value })),
    setAll: (items) => {
      for (const item of items) {
        if (!item.value) jar.delete(item.name)
        else jar.set(item.name, { value: item.value })
      }
    },
  },
})

const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error) {
  console.error(`Sign-in failed for ${email}: ${error.message}`)
  process.exit(1)
}

const cookie = [...jar.entries()].map(([name, { value }]) => `${name}=${value}`).join('; ')
if (!cookie) {
  console.error('Sign-in returned no session cookies.')
  process.exit(1)
}

await ensureCookieDir()
await writeFile(cookieFile, cookie, 'utf8')

console.log(`Signed in as ${data.user?.email ?? email}.`)
console.log(`Cookie written to ${cookieFile}.`)
if (data.session?.expires_at) {
  const expires = new Date(data.session.expires_at * 1000)
  console.log(`Access token expires at ${expires.toISOString()}. Rerun this script after that.`)
}
