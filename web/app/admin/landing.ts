// Product owner status is checked through the admin endpoint, the same way
// lecturer status is checked through the lecturer endpoint.
type Fetcher = (url: string, options: { method: 'POST', body: Record<string, string> }) => Promise<unknown>

export async function isProductOwner(fetcher: Fetcher): Promise<boolean> {
  try {
    await fetcher('/api/admin', { method: 'POST', body: { event: 'read' } })
    return true
  }
  catch {
    return false
  }
}

// "Back to the course" carries this query flag, so the product owner can still
// open the workspace instead of being sent to the decisions page.
export const workspaceOptOut = 'workspace'
