import type { LanguageModel } from '../language-model'
import type { Agents } from './agents'
import { proposalSchema } from './moves'
import {
  deskmatePrompt,
  deskmateProposeInstructions,
  deskmateRenderInstructions,
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
      propose(context) {
        return languageModel.proposeMove(teacherProposeInstructions, teacherPrompt(context), proposalSchema)
      },
      render(context, move) {
        return languageModel.streamReply(teacherRenderInstructions, teacherPrompt(context, move))
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
