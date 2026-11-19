import { execFileSync } from 'node:child_process'

let commitFromGit: string | undefined

// The commit this server is running. Vercel publishes it as VERCEL_GIT_COMMIT_SHA.
// CODE_VERSION overrides that. A local server asks git, once.
export function currentCodeVersion(): string {
  const fromEnvironment = process.env.CODE_VERSION?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  if (fromEnvironment) return fromEnvironment
  if (commitFromGit === undefined) {
    try {
      const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      commitFromGit = commit || 'unknown'
    }
    catch {
      commitFromGit = 'unknown'
    }
  }
  return commitFromGit
}
