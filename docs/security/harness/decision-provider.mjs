import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultWebRoot = path.resolve(here, '../../../web')

export default class ColearnerDecisionProvider {
  constructor(options = {}) {
    this.config = options.config ?? {}
  }

  id() {
    return 'colearner-decision'
  }

  async callApi(prompt, context) {
    const webRoot = this.config.webRoot ?? process.env.COLEARNER_WEB ?? defaultWebRoot
    const { decide } = await import(pathToFileURL(path.join(webRoot, 'server/verify-shield/decide.ts')).href)
    const { roleTable } = await import(pathToFileURL(path.join(webRoot, 'server/agents/role-table.ts')).href)

    const agent = context?.vars?.agent ?? 'teacher'
    const moveType = context?.vars?.moveType ?? 'reveal_answer'
    const move = buildMove(moveType)

    const snapshot = {
      moduleId: 'getting_started',
      exerciseId: 'say_hello',
      masteries: [{ moduleId: 'getting_started', mastery: 0.1 }],
      unlockedModuleIds: ['getting_started'],
      studentMessage: prompt,
      verifyShieldOn: true,
    }

    // decide() needs a course scope. Node cannot load the real one (course.ts has
    // extensionless runtime imports), so this names the one module the cases use.
    const courseScope = {
      modules: [{ id: 'getting_started', keywords: ['getting started with programming and python'] }],
      outOfCourseKeywords: [],
    }

    const verdict = decide([{ agent, move }], snapshot, roleTable, courseScope)[0]
    return {
      output: JSON.stringify({
        agent,
        proposed: move.type,
        decision: verdict.decision,
        ruleId: verdict.ruleId,
        reasonCode: verdict.reasonCode,
        ruledMove: verdict.move ? verdict.move.type : null,
      }),
    }
  }
}

function buildMove(type) {
  if (type === 'hint_level_N') {
    return { type, level: 1, scope: 'getting_started' }
  }
  if (type === 'explain_concept' || type === 'answer_question' || type === 'address_misconception') {
    return type === 'address_misconception'
      ? { type, misconceptionId: 'missing_quotes', scope: 'getting_started' }
      : { type, scope: 'getting_started' }
  }
  if (type === 'advance_to_module') return { type, moduleId: 'variables' }
  return { type }
}
