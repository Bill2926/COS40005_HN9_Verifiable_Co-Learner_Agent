export const workspaceLayouts = [
  { id: 'ide', name: 'IDE' },
  { id: 'roadmap', name: 'Roadmap canvas' },
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
  // Cookies and links saved before this layout was renamed still open the canvas.
  const id = raw === 'map' ? 'roadmap' : raw
  return workspaceLayouts.find(layout => layout.id === id)?.id ?? null
}

export function resolveWorkspaceLayout(requested: unknown, remembered: unknown): WorkspaceLayoutId {
  return workspaceLayoutFrom(requested) ?? workspaceLayoutFrom(remembered) ?? 'ide'
}
