import type { MaterialBlock } from '../../shared/turn'
import type { CourseSpec, ModuleSpec } from './course-spec'

export interface LegacyMaterials {
  heading: string
  body: string
  example: string
  keyPoint: string
  scopeNote: string
}

const blockFields: Record<MaterialBlock['type'], readonly string[]> = {
  text: ['markdown'],
  code: ['code'],
  diagram: ['mermaid'],
  image: ['url', 'alt'],
  video: ['url', 'title'],
}

export function legacyMaterials(legacy: LegacyMaterials): MaterialBlock[] {
  return [
    { type: 'text', markdown: `## ${legacy.heading}\n\n${legacy.body}` },
    { type: 'code', code: legacy.example },
    { type: 'text', markdown: `**Key point.** ${legacy.keyPoint}\n\n${legacy.scopeNote}` },
  ]
}

// Accepts a stored spec from before materials were blocks, and a spec that
// already uses blocks. The result always has spec version 2 and block materials.
export function normaliseCourseSpec(input: unknown): CourseSpec {
  if (typeof input !== 'object' || input === null) throw new Error('The course spec is missing.')
  const version = 'specVersion' in input ? input.specVersion : undefined
  if (version !== 1 && version !== 2) throw new Error('The course spec version is not supported.')
  const spec = structuredClone(input) as CourseSpec
  spec.specVersion = 2
  if (!Array.isArray(spec.modules)) throw new Error('The course spec lists no modules.')
  for (const module of spec.modules) {
    if (!module.content) continue
    module.content.materials = normaliseMaterials(module.content.materials, module.id)
  }
  assertMaterialBlocks(spec)
  return spec
}

function normaliseMaterials(materials: unknown, moduleId: string): MaterialBlock[] {
  if (Array.isArray(materials)) return materials as MaterialBlock[]
  if (isLegacy(materials)) return legacyMaterials(materials)
  throw new Error(`Module ${moduleId}: materials are missing.`)
}

function isLegacy(value: unknown): value is LegacyMaterials {
  if (typeof value !== 'object' || value === null) return false
  return ['heading', 'body', 'example', 'keyPoint', 'scopeNote'].every(key =>
    key in value && typeof value[key as keyof typeof value] === 'string')
}

export function assertMaterialBlocks(spec: Pick<CourseSpec, 'modules'>): void {
  for (const module of spec.modules) assertModuleBlocks(module)
}

function assertModuleBlocks(module: ModuleSpec): void {
  const blocks = module.content?.materials
  if (!module.content) return
  if (!Array.isArray(blocks)) throw new Error(`Module ${module.id}: materials are missing.`)
  blocks.forEach((block, index) => {
    const where = `Module ${module.id}, block ${index + 1}`
    if (typeof block !== 'object' || block === null || !('type' in block) || typeof block.type !== 'string') {
      throw new Error(`${where}: type is missing.`)
    }
    const fields = blockFields[block.type as MaterialBlock['type']]
    if (!fields) throw new Error(`${where}: type is not a materials block.`)
    for (const field of fields) {
      const value = (block as unknown as Record<string, unknown>)[field]
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${where}: ${field} is missing.`)
      }
    }
  })
}
