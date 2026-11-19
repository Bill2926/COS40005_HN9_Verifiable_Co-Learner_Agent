import { isDeepStrictEqual } from 'node:util'
import { createFakeAgents, moveKey, proposalSchema } from '../server/agents'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore, type DecisionRecord } from '../server/storage/decision-log'
import { createMemoryQuizAnswerStore } from '../server/storage/quiz-answer-store'
import { createMemoryEvidenceStore, createMemoryUnlockStore } from '../server/student-model'
import { handleTurn } from '../server/turn/handle-turn'
import { benchmarkCases, type BenchmarkCase } from './cases'

type Ruling = Pick<DecisionRecord,
  'agent' | 'proposedMove' | 'proposedScope' | 'outcome' | 'verdict' | 'ruledMove'
  | 'ruledScope' | 'ruleId' | 'reasonCode' | 'ruleChecks' | 'verifyShieldOn'
  | 'masteries' | 'unlockedModuleIds' | 'masteryThreshold'>

export interface BenchmarkResult {
  id: string
  prompt: string
  proposal: BenchmarkCase['proposal']
  priorHintLevel: number
  note?: string
  shieldOn: Ruling
  shieldOff: Ruling
}

export interface BenchmarkReport {
  fixtureCount: number
  turnCount: number
  changedVerdicts: number
  failures: string[]
  results: BenchmarkResult[]
}

const studentId = 'benchmark-student'
const moduleId = 'getting_started'
const exerciseId = 'say_hello'

async function runCase(fixture: BenchmarkCase, verifyShieldOn: boolean): Promise<Ruling> {
  // Every side of every pair gets independent stores, including the hint history.
  const store = createMemoryConversationStore({ [studentId]: 'Benchmark student' })
  const decisions = createMemoryDecisionLogStore()
  const unlocks = createMemoryUnlockStore()
  await unlocks.record(studentId, fixture.unlockedModuleIds ?? [moduleId])
  await store.saveResumePoint(studentId, { moduleId, exerciseId })
  if (fixture.priorHintLevel) {
    await store.appendMessage(studentId, moduleId, {
      author: 'teacher', approvedMove: `hint_level_${fixture.priorHintLevel}`,
      text: 'A hint from an earlier turn.', exerciseId,
    })
  }
  const agents = createFakeAgents(
    { proposal: fixture.agent === 'teacher' ? fixture.proposal : null, text: 'Scripted teacher reply.' },
    { proposal: fixture.agent === 'deskmate' ? fixture.proposal : null, text: 'Scripted Mai reply.' },
  )
  const quizAnswers = createMemoryQuizAnswerStore()
  if (fixture.priorQuizAnswer) {
    await quizAnswers.record({ studentId, moduleId, ...fixture.priorQuizAnswer })
  }
  const state = await handleTurn({
    sessionStudentId: studentId,
    body: { event: 'message', text: fixture.prompt, addressedAgent: fixture.agent },
  }, store, agents, { verifyShieldOn, decisions, unlocks, evidence: createMemoryEvidenceStore(), quizAnswers })

  const rows = await decisions.list()
  const record = rows[0]
  if (rows.length !== 1 || !record) throw new Error(`${fixture.id}: expected one logged verdict.`)
  if (state.workingArea.moduleId !== moduleId || state.workingArea.exercise.id !== exerciseId) {
    throw new Error(`${fixture.id}: a message or suggestion changed the student's placement.`)
  }
  const { agent, proposedMove, proposedScope, outcome, verdict, ruledMove, ruledScope,
    ruleId, reasonCode, ruleChecks, masteries, unlockedModuleIds, masteryThreshold } = record
  return { agent, proposedMove, proposedScope, outcome, verdict, ruledMove, ruledScope,
    ruleId, reasonCode, ruleChecks, verifyShieldOn: record.verifyShieldOn,
    masteries, unlockedModuleIds, masteryThreshold }
}

export async function runBenchmark(): Promise<BenchmarkReport> {
  if (benchmarkCases.length !== 25 || new Set(benchmarkCases.map(item => item.id)).size !== 25) {
    throw new Error('The benchmark requires exactly 25 uniquely named committed prompts.')
  }
  const failures: string[] = []
  const results: BenchmarkResult[] = []
  for (const fixture of benchmarkCases) {
    proposalSchema.parse({ proposal: fixture.proposal })
    const shieldOn = await runCase(fixture, true)
    const shieldOff = await runCase(fixture, false)
    const scopedProposal = 'scope' in fixture.proposal ? fixture.proposal.scope : null
    const expectedOff = {
      agent: fixture.agent, proposedMove: moveKey(fixture.proposal), proposedScope: scopedProposal,
      outcome: 'ruled', verdict: 'allow', ruledMove: moveKey(fixture.proposal), ruledScope: scopedProposal,
      ruleId: 'verify_shield', reasonCode: 'VERIFYSHIELD_OFF', ruleChecks: [], verifyShieldOn: false,
      masteries: shieldOn.masteries, unlockedModuleIds: shieldOn.unlockedModuleIds,
      masteryThreshold: shieldOn.masteryThreshold,
    }
    if (!isDeepStrictEqual(shieldOff, expectedOff)) failures.push(`${fixture.id}: shield-off result changed.`)
    const expectedOn = { ...fixture.expected }
    const actualOn = {
      verdict: shieldOn.verdict, reasonCode: shieldOn.reasonCode,
      ruledMove: shieldOn.ruledMove, ruledScope: shieldOn.ruledScope,
    }
    if (!isDeepStrictEqual(actualOn, expectedOn)) {
      failures.push(`${fixture.id}: expected ${JSON.stringify(expectedOn)}, got ${JSON.stringify(actualOn)}.`)
    }
    results.push({ id: fixture.id, prompt: fixture.prompt, proposal: fixture.proposal,
      priorHintLevel: fixture.priorHintLevel ?? 0, ...(fixture.note ? { note: fixture.note } : {}),
      shieldOn, shieldOff })
  }
  return {
    fixtureCount: results.length, turnCount: results.length * 2,
    changedVerdicts: results.filter(result => result.shieldOn.verdict !== result.shieldOff.verdict).length,
    failures, results,
  }
}

export function markdownReport(report: BenchmarkReport): string {
  const lines = [
    '# VerifyShield paired benchmark', '',
    `${report.fixtureCount} committed prompts, ${report.turnCount} independent turns, ${report.changedVerdicts} changed verdicts, ${report.failures.length} expectation failures.`, '',
    'Scripted proposals pass through the turn handler and its decision log. Each pair uses the same prompt, proposal and starting state. This measures deterministic rulings on fixed proposals. Reply text is scripted.', '',
    '| Prompt | Proposed move | VerifyShield on | VerifyShield off |',
    '| --- | --- | --- | --- |',
  ]
  for (const result of report.results) {
    lines.push(`| ${escapeCell(result.prompt)} | ${escapeCell(JSON.stringify(result.proposal))} | ${rulingCell(result.shieldOn)} | ${rulingCell(result.shieldOff)} |`)
  }
  for (const result of report.results.filter(item => item.note)) {
    lines.push('', `**${result.id}** — ${result.note}`)
  }
  if (report.failures.length) lines.push('', '## Expectation failures', '', ...report.failures.map(text => `- ${text}`))
  return `${lines.join('\n')}\n`
}

function rulingCell(ruling: Ruling): string {
  return escapeCell(`${ruling.verdict} · ${ruling.ruledMove ?? 'silent'}${ruling.ruledScope ? ` (${ruling.ruledScope})` : ''} · ${ruling.reasonCode}`)
}

function escapeCell(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;').replaceAll('\n', '<br>')
}
