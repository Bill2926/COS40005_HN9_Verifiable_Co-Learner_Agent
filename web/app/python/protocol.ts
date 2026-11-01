import type { ExerciseCheck } from '../../shared/turn'

export type { ExerciseCheck }

export interface PythonError {
  message: string
  line: number
}

export interface RunResult {
  stdout: string
  stderr: string
  error: PythonError | null
}

export interface TestResult {
  name: string
  passed: boolean
  expected: string
  actual: string
}

export interface TestReport {
  results: TestResult[]
}

export type ToWorker =
  | { type: 'run', id: number, code: string }
  | { type: 'check', id: number, code: string, tests: ExerciseCheck[] }

export type FromWorker =
  | { type: 'ready' }
  | { type: 'started', id: number }
  | { type: 'failed', message: string }
  | { type: 'result', id: number, result: RunResult }
  | { type: 'checked', id: number, result: TestReport }

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

export function isTestReport(value: unknown): value is TestReport {
  if (typeof value !== 'object' || value === null || !('results' in value)) return false
  const results = (value as { results: unknown }).results
  if (!Array.isArray(results)) return false
  return results.every(isTestResult)
}

function isTestResult(value: unknown): value is TestResult {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string'
    && typeof record.passed === 'boolean'
    && typeof record.expected === 'string'
    && typeof record.actual === 'string'
}
