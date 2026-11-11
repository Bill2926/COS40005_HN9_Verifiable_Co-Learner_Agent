import { describe, expect, it } from 'vitest'
import {
  createMemoryVerifyShieldStore,
  verifyShieldEnabled,
  verifyShieldForTurn,
} from '../server/storage/verify-shield-store'

describe('VerifyShield switch', () => {
  it('stays on when the environment does not switch it off', () => {
    expect(verifyShieldEnabled(undefined, null)).toBe(true)
    expect(verifyShieldEnabled('on', null)).toBe(true)
    expect(verifyShieldEnabled('  ', null)).toBe(true)
  })

  it('switches off for the environment values off, false, and 0', () => {
    expect(verifyShieldEnabled('off', null)).toBe(false)
    expect(verifyShieldEnabled('FALSE', null)).toBe(false)
    expect(verifyShieldEnabled('0', null)).toBe(false)
  })

  it('lets a saved setting replace the environment', async () => {
    const store = createMemoryVerifyShieldStore(null)
    expect(await verifyShieldForTurn(store, 'on')).toBe(true)

    await store.save(false)
    expect(await verifyShieldForTurn(store, 'on')).toBe(false)

    await store.save(true)
    expect(await verifyShieldForTurn(store, 'off')).toBe(true)
  })

  it('stays on from the environment when the saved setting cannot be read', async () => {
    const store = {
      async read() {
        throw new Error('verify_shield_settings is missing')
      },
      async save() {},
    }

    expect(await verifyShieldForTurn(store, 'on')).toBe(true)
    expect(await verifyShieldForTurn(store, 'off')).toBe(false)
  })
})
