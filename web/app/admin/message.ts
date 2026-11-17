export function messageFrom(caught: unknown, fallback: string): string {
  if (typeof caught === 'object' && caught !== null) {
    if ('statusMessage' in caught && typeof caught.statusMessage === 'string' && caught.statusMessage) {
      return caught.statusMessage
    }
    if ('data' in caught && typeof caught.data === 'object' && caught.data !== null && 'statusMessage' in caught.data && typeof caught.data.statusMessage === 'string') {
      return caught.data.statusMessage
    }
  }
  return fallback
}
