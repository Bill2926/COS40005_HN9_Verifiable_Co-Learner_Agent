import { z } from 'zod'
import type { ModelTool } from '../language-model'
import type { ToolCallRecord } from '../../shared/turn'

// One module as the get_student_mastery tool reports it.
export interface ToolModuleMastery {
  id: string
  name: string
  state: 'mastered' | 'open' | 'closed'
  mastery: number
}

// What the server binds a turn's tools to. The student and the course are already chosen here, so
// no tool takes a student id from the model.
export interface AgentToolsBinding {
  // The turn's student's stored mastery for each module of the turn's course.
  readMastery: () => Promise<readonly ToolModuleMastery[]>
  masteryThreshold: number
}

// The tools of one turn, and what was done with them.
export interface TurnTools {
  tools: readonly ModelTool[]
  // Each call, in order, as the decision log records it.
  readonly trace: readonly ToolCallRecord[]
  // Whether the agent ran out of steps before it proposed.
  readonly stepCapReached: boolean
  noteStepCap: () => void
}

// The most steps an agent may take in one propose; reaching it means no move that turn.
export const maxToolSteps = 3

export function createAgentTools(binding: AgentToolsBinding): TurnTools {
  const trace: ToolCallRecord[] = []
  let stepCapReached = false

  const getStudentMastery: ModelTool = {
    name: 'get_student_mastery',
    description: 'The student\'s mastery of each module of the course, from 0 up to the maximum of 1.0, with the mastery threshold a module must reach to count as mastered. Takes no input.',
    inputSchema: z.object({}),
    async run(input) {
      const modules = (await binding.readMastery()).map(module => ({ ...module }))
      trace.push({
        name: 'get_student_mastery',
        input,
        summary: `${modules.length} modules, threshold ${binding.masteryThreshold}`,
      })
      return { modules, masteryThreshold: binding.masteryThreshold, maximum: 1 }
    },
  }

  return {
    tools: [getStudentMastery],
    get trace() {
      return trace
    },
    get stepCapReached() {
      return stepCapReached
    },
    noteStepCap() {
      stepCapReached = true
    },
  }
}
