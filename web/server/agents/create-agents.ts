import type { LanguageModel } from '../language-model'
import type { Agents } from './agents'
import { proposalSchema } from './moves'
import {
  deskmatePrompt,
  deskmateProposeInstructions,
  deskmateRenderInstructions,
  teacherPlanInstructions,
  teacherPlanPrompt,
  teacherPrompt,
  teacherProposeInstructions,
  teacherRenderInstructions,
} from './prompts'

// The Teacher and the Deskmate on top of any language model: each agent is its own instructions and
// its own view of the lesson, sent through the same two calls. Both are held to the one proposal
// schema; which moves each may make is ruled on by the VerifyShield (ADR 0003).
export function createAgents(languageModel: LanguageModel): Agents {
  return {
    teacher: {
      // The Teacher looks mastery up with its tools rather than reading it in the prompt. The loop
      // ends as the language model reports, which the tools keep for the decision log.
      async propose(context, tools) {
        const { proposal, ended } = await languageModel.proposeWithTools(teacherProposeInstructions, teacherPrompt(context), proposalSchema, tools)
        tools.loopEnded(ended)
        return proposal
      },
      render(context, move) {
        return languageModel.streamReply(teacherRenderInstructions, teacherPrompt(context, move))
      },
      // The plan is asked for on its own when a module opens, so it costs no
      // tool loop and its prompt holds only what a plan may point at.
      plan(context) {
        return languageModel.proposeMove(teacherPlanInstructions, teacherPlanPrompt(context), proposalSchema)
      },
    },
    deskmate: {
      propose(context) {
        return languageModel.proposeMove(deskmateProposeInstructions, deskmatePrompt(context), proposalSchema)
      },
      render(context, move) {
        return languageModel.streamReply(deskmateRenderInstructions, deskmatePrompt(context, move))
      },
    },
  }
}
