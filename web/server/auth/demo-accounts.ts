import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// seededEvidence marks the account whose evidence ledger the seed fills, so a
// rehearsal that clears what the demo students did leaves it alone.
export const demoAccounts = [
  {
    email: 'an@example.com',
    password: 'an-demo-password',
    displayName: 'An',
    seededEvidence: false,
  },
  {
    email: 'binh@example.com',
    password: 'binh-demo-password',
    displayName: 'Bình',
    seededEvidence: true,
  },
] as const

function envValue(name: string): string {
  const fromProcess = process.env[name]?.trim()
  if (fromProcess) return fromProcess

  const envFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  if (!existsSync(envFile)) return ''
  const line = readFileSync(envFile, 'utf8')
    .split('\n')
    .find(entry => entry.startsWith(`${name}=`))
  if (!line) return ''
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

// Staff passwords are not in the repository. The account owner keeps them in
// the team password manager and in the GitHub Actions secrets of these names.
function staffPassword(name: 'DEMO_OWNER_PASSWORD' | 'DEMO_LECTURER_PASSWORD'): string {
  const value = envValue(name)
  if (value === '') {
    throw new Error(`${name} is not set. Staff demo passwords are not stored in the repository.`)
  }
  return value
}

export const productOwnerAccount = {
  email: 'owner@example.com',
  displayName: 'Owner',
  get password() {
    return staffPassword('DEMO_OWNER_PASSWORD')
  },
}

export const lecturerAccount = {
  email: 'lecturer@example.com',
  displayName: 'Lecturer',
  get password() {
    return staffPassword('DEMO_LECTURER_PASSWORD')
  },
}
