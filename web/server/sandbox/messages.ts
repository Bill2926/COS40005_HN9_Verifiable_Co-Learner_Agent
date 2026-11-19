export const approvedLibraries = [
  'math',
  'random',
  'string',
  'itertools',
  'collections',
  'datetime',
  're',
  'statistics',
  'functools',
] as const

export function libraryRefusal(library: string): string {
  return `The library ${library} is not allowed.`
}

export const tookTooLong = 'This took longer than 10 seconds, so it was stopped.'
export const usedTooMuchMemory = 'This used more than 512 MB of memory, so it was stopped.'
export const printedTooMuch = 'This printed more than 64 KB, so it was stopped.'
export const couldNotCheck = 'This submission could not be checked.'

export const sandboxSeconds = 10
export const sandboxMemoryMb = 512
export const sandboxOutputBytes = 64 * 1024
