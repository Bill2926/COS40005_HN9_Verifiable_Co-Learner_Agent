import type { ModuleContent } from './course-spec'

// A module the student can study: one whose course spec gives it content.
export interface StudyModule extends ModuleContent {
  id: string
}

export function canonicalModuleId(id: string): string {
  return id === 'for_loop' ? 'loops' : id
}
