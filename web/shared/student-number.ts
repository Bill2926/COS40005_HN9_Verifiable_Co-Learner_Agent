export const studentNumberRule = 'A student number is SWB followed by at least four digits, like SWB0001.'

export function isStudentNumber(value: string): boolean {
  return /^SWB\d{4,}$/.test(value)
}
