import type { ExerciseCheck, ModuleMaterials } from '../../shared/turn'
import { conditionalsModule } from './modules/conditionals'
import { gettingStartedModule } from './modules/getting-started'
import { loopsModule } from './modules/loops'
import { stringsModule } from './modules/strings'
import { variablesModule } from './modules/variables'

export interface Exercise {
  id: string
  title: string
  statement: string
  starterCode: string
  tests: readonly [ExerciseCheck, ExerciseCheck, ExerciseCheck]
  referenceSolution: string
}

export interface MisconceptionResponse {
  id: string
  response: string
}

export interface StudyModule {
  id: string
  name: string
  materials: ModuleMaterials
  exercises: readonly [Exercise, Exercise, Exercise, ...Exercise[]]
  hintLadder: readonly string[]
  misconceptionResponses: readonly MisconceptionResponse[]
}

export const studyModules: readonly StudyModule[] = [
  gettingStartedModule,
  variablesModule,
  stringsModule,
  conditionalsModule,
  loopsModule,
]

export function studyModule(id: string): StudyModule | undefined {
  return studyModules.find(module => module.id === id)
}

export function canonicalModuleId(id: string): string {
  return id === 'for_loop' ? 'loops' : id
}
