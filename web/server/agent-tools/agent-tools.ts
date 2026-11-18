import { z } from 'zod'
import type { ModelTool, ToolLoop, ToolLoopEnd } from '../language-model'
import { maxToolSteps, studentMasteryTool, type ModuleState, type ToolCallRecord } from '../../shared/turn'

// One module as the get_student_mastery tool reports it.
export interface ToolModuleMastery {
  id: string
  name: string
  state: ModuleState
  mastery: number
}

// What the server binds a turn's tools to. The student and the course are already chosen here, so
// no tool takes a student id from the model.
export interface AgentToolsBinding {
  // The turn's student's stored mastery for each module of the turn's course.
  readMastery: () => Promise<readonly ToolModuleMastery[]>
  masteryThreshold: number
}

// The tool loop of one turn, and what came of it: the loop the agent hands to the language model,
// each call made, in order, as the decision log records it, and why the loop ended.
export interface TurnTools extends ToolLoop {
  readonly trace: readonly ToolCallRecord[]
  // Null until the loop has run (the agent did not take part, or its call failed).
  readonly ended: ToolLoopEnd | null
  // The agent hands back the language model's own report of why the loop ended.
  loopEnded: (ended: ToolLoopEnd) => void
}

export function createAgentTools(binding: AgentToolsBinding): TurnTools {
  const trace: ToolCallRecord[] = []
  let ended: ToolLoopEnd | null = null

  const getStudentMastery: ModelTool = {
    name: studentMasteryTool,
    description: 'The student\'s mastery of each module of the course, from 0 up to the maximum of 1.0, with the mastery threshold a module must reach to count as mastered. Takes no input.',
    inputSchema: z.object({}),
    async run(input) {
      const modules = (await binding.readMastery()).map(module => ({ ...module }))
      trace.push({ name: studentMasteryTool, input, summary: masterySummary(modules, binding.masteryThreshold) })
      return { modules, masteryThreshold: binding.masteryThreshold, maximum: 1 }
    },
  }

  return {
    tools: [getStudentMastery],
    maxSteps: maxToolSteps,
    get trace() {
      return trace
    },
    get ended() {
      return ended
    },
    loopEnded(end) {
      ended = end
    },
  }
}

// Each module's mastery as the decision review shows it, e.g. "threshold 0.95; getting_started 0.42".
function masterySummary(modules: readonly ToolModuleMastery[], threshold: number): string {
  return [`threshold ${threshold}`, ...modules.map(module => `${module.id} ${module.mastery}`)].join('; ')
}
