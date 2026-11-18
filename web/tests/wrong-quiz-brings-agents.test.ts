import { describe, expect, it } from 'vitest'
import { createAgents, createFakeAgents } from '../server/agents'
import type { LanguageModel } from '../server/language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryQuizAnswerStore } from '../server/storage/quiz-answer-store'
import { handleTurn } from '../server/turn/handle-turn'

const signedInStudent = '6f1b0c1e-1111-4111-8111-111111111111'

// Module 1's quiz. print-text has a wrong choice (0) that shows a misconception;
// comment-line and program-steps are left unanswered throughout.
const answeredPrompt = 'Which line displays the literal word Hello?'
const unansweredPrompts = ['Which line is a comment Python skips?', 'What is a program?']

function memoryStore() {
  return createMemoryConversationStore({ [signedInStudent]: 'An' })
}

function quizAnswer(questionId: string, choice: number) {
  return {
    sessionStudentId: signedInStudent,
    body: { event: 'quiz_answer' as const, moduleId: 'getting_started', questionId, choice },
  }
}

describe('a wrong quiz answer brings the agents in', () => {
  it('brings the teacher in on a wrong answer and stays quiet on a right one', async () => {
    const wrong = createFakeAgents({
      proposal: { type: 'explain_concept', scope: 'getting_started' },
      text: 'Look again at the quotes.',
    })
    await handleTurn(quizAnswer('print-text', 0), memoryStore(), wrong, { quizAnswers: createMemoryQuizAnswerStore() })
    expect(wrong.exchanges.filter(exchange => exchange.agent === 'teacher').map(exchange => exchange.phase))
      .toEqual(['propose', 'render'])

    const right = createFakeAgents({
      proposal: { type: 'explain_concept', scope: 'getting_started' },
      text: 'This should never be spoken.',
    })
    await handleTurn(quizAnswer('print-text', 1), memoryStore(), right, { quizAnswers: createMemoryQuizAnswerStore() })
    expect(right.exchanges).toHaveLength(0)
  })

  it('gives the teacher only answered questions, with explanations and misconception ids', async () => {
    const agents = createFakeAgents({ proposal: null })
    await handleTurn(quizAnswer('print-text', 0), memoryStore(), agents, { quizAnswers: createMemoryQuizAnswerStore() })

    const propose = agents.exchanges.find(exchange => exchange.agent === 'teacher' && exchange.phase === 'propose')
    expect(propose?.context.answeredQuiz).toEqual([
      {
        prompt: answeredPrompt,
        choice: 0,
        correctIndex: 1,
        correct: false,
        explanation: 'Quotes make Hello literal text. print() displays that text.',
        misconceptionId: 'missing_quotes',
      },
    ])
  })

  it('gives the deskmate answered questions without explanations', async () => {
    const agents = createFakeAgents({ proposal: null }, { proposal: null })
    await handleTurn(quizAnswer('print-text', 0), memoryStore(), agents, { quizAnswers: createMemoryQuizAnswerStore() })

    const propose = agents.exchanges.find(exchange => exchange.agent === 'deskmate' && exchange.phase === 'propose')
    expect(propose?.context.answeredQuiz).toEqual([
      {
        prompt: answeredPrompt,
        choice: 0,
        correctIndex: 1,
        correct: false,
        misconceptionId: 'missing_quotes',
      },
    ])
    expect(JSON.stringify(propose?.context)).not.toContain('Quotes make Hello literal text')
  })

  it('never puts an unanswered question in either agent prompt', async () => {
    const prompts: string[] = []
    const languageModel: LanguageModel = {
      async proposeMove(_instructions, prompt) {
        prompts.push(prompt)
        return null
      },
      proposeWithTools(instructions, prompt, schema) {
        return this.proposeMove(instructions, prompt, schema)
      },
      async* streamReply(_instructions, prompt) {
        prompts.push(prompt)
      },
    }
    await handleTurn(quizAnswer('print-text', 0), memoryStore(), createAgents(languageModel), { quizAnswers: createMemoryQuizAnswerStore() })

    expect(prompts.length).toBeGreaterThan(0)
    for (const prompt of prompts) {
      expect(prompt).toContain(answeredPrompt)
      for (const unanswered of unansweredPrompts) {
        expect(prompt).not.toContain(unanswered)
      }
    }
  })
})
