export interface PythonError {
  message: string
  line: number
}

export interface RunResult {
  stdout: string
  stderr: string
  error: PythonError | null
}

export interface ToWorker {
  type: 'run'
  id: number
  code: string
}

export type FromWorker =
  | { type: 'ready' }
  | { type: 'started', id: number }
  | { type: 'failed', message: string }
  | { type: 'result', id: number, result: RunResult }

export function isRunResult(value: unknown): value is RunResult {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.stdout !== 'string' || typeof record.stderr !== 'string') return false
  if (record.error === null) return true
  if (typeof record.error !== 'object' || record.error === null) return false
  const error = record.error as Record<string, unknown>
  return typeof error.message === 'string'
    && typeof error.line === 'number'
    && Number.isInteger(error.line)
    && error.line >= 1
}
