import { mkdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// The session cookie is a live credential. Keep it in a temp folder outside the
// repository so it can never be committed by accident.
export const cookieFile = process.env.COLEARNER_COOKIE_FILE
  ?? path.join(os.tmpdir(), 'colearner-tests', '.session-cookie')

export function cookieDir() {
  return path.dirname(cookieFile)
}

export async function ensureCookieDir() {
  await mkdir(cookieDir(), { recursive: true })
}

export async function readCookie() {
  try {
    const cookie = (await readFile(cookieFile, 'utf8')).trim()
    if (cookie) return cookie
  }
  catch {
    // fall through to the shared error below
  }
  throw new Error(`No session cookie at ${cookieFile}. Run: node capture-session.mjs`)
}
