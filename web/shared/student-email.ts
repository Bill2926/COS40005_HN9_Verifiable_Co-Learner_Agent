export const studentEmailDomain = '@student.swin.edu.au'
export const studentEmailRule = `Use your Swinburne student email, which ends in ${studentEmailDomain}.`

export function isStudentEmail(value: string): boolean {
  const email = value.trim().toLowerCase()
  return email.length > studentEmailDomain.length
    && email.endsWith(studentEmailDomain)
    && !/\s/.test(email)
    && email.indexOf('@') === email.length - studentEmailDomain.length
}
