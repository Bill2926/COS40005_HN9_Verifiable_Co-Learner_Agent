import { z } from 'zod'
import type { MaterialBlock } from '../../shared/turn'
import type { CourseSpec, ModuleSpec } from './course-spec'

// A field a block cannot do without: text that is more than whitespace.
const filled = z.string().refine(value => value.trim() !== '')

// The one place the materials blocks are defined. Adding or retiring a type here changes what
// a spec may hold on import and what a stored spec may hold when the course loads; the type
// MaterialBlock in shared/turn.ts is checked against it (tests/material-block.test-d.ts).
const blockFields = {
  text: { markdown: filled },
  code: { code: filled },
  image: { url: filled, alt: filled },
  video: { url: filled, title: filled },
} satisfies Record<MaterialBlock['type'], z.ZodRawShape>

type BlockType = keyof typeof blockFields

function isBlockType(type: string): type is BlockType {
  return Object.hasOwn(blockFields, type)
}

// What a lecturer may import: every block exactly as defined, with no field beyond its own.
export const materialBlockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text'), ...blockFields.text }),
  z.strictObject({ type: z.literal('code'), ...blockFields.code }),
  z.strictObject({ type: z.literal('image'), ...blockFields.image }),
  z.strictObject({ type: z.literal('video'), ...blockFields.video }),
])

export interface LegacyMaterials {
  heading: string
  body: string
  example: string
  keyPoint: string
  scopeNote: string
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
    if (!isBlockType(block.type)) throw new Error(`${where}: type is not a materials block.`)
    // A stored block is read leniently: a field beyond its own does not stop the course loading.
    const checked = z.object(blockFields[block.type]).safeParse(block)
    if (!checked.success) throw new Error(`${where}: ${String(checked.error.issues[0]!.path[0])} is missing.`)
  })
}
