import { describe, expect, it, vi } from 'vitest'
import { handleSignInCode } from '../server/auth/handle-sign-in-code'

describe('sign-in code handler', () => {
  it('sends a code to a student email, trimmed and lower-cased', async () => {
    const sendCode = vi.fn(async () => {})
    await handleSignInCode({ body: { email: '  104123456@Student.Swin.edu.au ' }, sendCode })
    expect(sendCode).toHaveBeenCalledExactlyOnceWith('104123456@student.swin.edu.au')
  })

  it.each([
    'an@example.com',
    'owner@example.com',
    '104123456@swin.edu.au',
    '104123456@student.swin.edu.au.evil.com',
    'x@evil.com@student.swin.edu.au',
    '@student.swin.edu.au',
    '',
  ])('refuses %j with a clear message and sends no code', async (email) => {
    const sendCode = vi.fn(async () => {})
    await expect(handleSignInCode({ body: { email }, sendCode })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Use your Swinburne student email, which ends in @student.swin.edu.au.',
    })
    expect(sendCode).not.toHaveBeenCalled()
  })

  it.each([null, undefined, 'text', {}, { email: 7 }])('refuses a body without an email: %j', async (body) => {
    const sendCode = vi.fn(async () => {})
    await expect(handleSignInCode({ body, sendCode })).rejects.toMatchObject({ statusCode: 400 })
    expect(sendCode).not.toHaveBeenCalled()
  })
})
