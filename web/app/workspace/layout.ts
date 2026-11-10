export const workspaceLayouts = [
  { id: 'ide', name: 'IDE' },
  { id: 'map', name: 'Map canvas' },
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
  return workspaceLayouts.find(layout => layout.id === raw)?.id ?? null
}

export function resolveWorkspaceLayout(requested: unknown, remembered: unknown): WorkspaceLayoutId {
  return workspaceLayoutFrom(requested) ?? workspaceLayoutFrom(remembered) ?? 'ide'
}
