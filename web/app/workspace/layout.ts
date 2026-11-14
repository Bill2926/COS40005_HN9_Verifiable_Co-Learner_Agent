export const workspaceLayouts = [
  { id: 'study', name: 'Study' },
  { id: 'roadmap', name: 'Roadmap' },
] as const

export type WorkspaceLayoutId = (typeof workspaceLayouts)[number]['id']

export const workspaceLayoutCookie = 'workspace-layout'

export const workspaceLayoutCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 400,
}

export function workspaceLayoutFrom(value: unknown): WorkspaceLayoutId | null {
  const raw = Array.isArray(value) ? value[0] : value
  // Cookies and links saved under the old names still open the right layout.
  const id = raw === 'map' ? 'roadmap' : raw === 'ide' ? 'study' : raw
  return workspaceLayouts.find(layout => layout.id === id)?.id ?? null
}

export function resolveWorkspaceLayout(requested: unknown, remembered: unknown): WorkspaceLayoutId {
  return workspaceLayoutFrom(requested) ?? workspaceLayoutFrom(remembered) ?? 'study'
}
