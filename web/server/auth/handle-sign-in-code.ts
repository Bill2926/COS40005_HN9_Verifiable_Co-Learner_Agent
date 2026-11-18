import { isStudentEmail, studentEmailRule } from '../../shared/student-email'

export class SignInCodeError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'SignInCodeError'
  }
}

export interface SignInCodeRequest {
  body: unknown
  // Asks the auth service to email a 6-digit code; it creates the account on first use.
  sendCode: (email: string) => Promise<void>
}

// An address outside the student domain is refused before any code is sent, so
// no one waits for an email that will never arrive.
export async function handleSignInCode(request: SignInCodeRequest): Promise<void> {
  const email = typeof request.body === 'object' && request.body !== null && 'email' in request.body && typeof request.body.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : null
  if (email === null) throw new SignInCodeError('The email is missing.')
  if (!isStudentEmail(email)) throw new SignInCodeError(studentEmailRule)
  await request.sendCode(email)
}
