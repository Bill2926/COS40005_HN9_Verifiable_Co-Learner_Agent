export interface VerifyShieldStore {
  read(): Promise<boolean | null>
  save(enabled: boolean): Promise<void>
}

export function createMemoryVerifyShieldStore(initial: boolean | null = null): VerifyShieldStore {
  let current = initial
  return {
    async read() {
      return current
    },
    async save(enabled) {
      current = enabled
    },
  }
}

// A saved row wins. Otherwise the environment is on unless it says off.
export function verifyShieldEnabled(envValue: string | null | undefined, saved: boolean | null): boolean {
  if (typeof saved === 'boolean') return saved
  const value = (envValue ?? '').trim().toLowerCase()
  return value !== 'off' && value !== 'false' && value !== '0'
}

export async function verifyShieldForTurn(
  store: VerifyShieldStore,
  envValue: string | null | undefined,
): Promise<boolean> {
  let saved: boolean | null = null
  try {
    saved = await store.read()
  }
  catch {
    saved = null
  }
  return verifyShieldEnabled(envValue, saved)
}
