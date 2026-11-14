# Component: turn

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

`web/server/turn/handle-turn.ts`, one file. It runs one turn: it reads the student's standing, asks the agents
for moves, has the VerifyShield rule on them, renders text for approved moves, stores the conversation and
returns the screen state. Part of [server/00-overview.md](00-overview.md).

Legend: solid = runtime import, dashed = type-only import. Blue = this component, grey = other components.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  turnRoute["<b>routes/turn.post.ts</b>"]:::near
  handleTurn["<b>turn/handle-turn.ts</b><br/>handleTurn, streamTurn,<br/>studentIdForTurn"]:::comp

  shield["<b>verify-shield/index.ts</b>"]:::near
  course["<b>course/index.ts</b>"]:::near
  agents["<b>agents/index.ts</b>"]:::near
  studentModel["<b>student-model/index.ts</b>"]:::near
  conversation["<b>storage/conversation-store.ts</b>"]:::near
  decisionLog["<b>storage/decision-log.ts</b>"]:::near
  quizStore["<b>storage/quiz-answer-store.ts</b>"]:::near
  turnTypes["<b>shared/turn.ts</b>"]:::near

  turnRoute -->|"handleTurn, streamTurn,<br/>UnknownExerciseError"| handleTurn
  handleTurn -->|"decide"| shield
  handleTurn -->|"defaultCourseId, studyModule,<br/>canonicalModuleId, presentedRoadmap,<br/>redirectText, ..."| course
  handleTurn -->|"moveKey, roleTable"| agents
  handleTurn -->|"estimateCourse, standingFor,<br/>furthestUnlockedModuleId,<br/>createMemoryEvidenceStore"| studentModel
  handleTurn -.->|"type: CourseEstimate, CourseStanding,<br/>EvidenceStore"| studentModel
  handleTurn -.->|"type: Agents, Move, TeacherContext,<br/>DeskmateContext, SubmissionCheck"| agents
  handleTurn -->|"createMemoryQuizAnswerStore"| quizStore
  handleTurn -.->|"type: ConversationStore"| conversation
  handleTurn -.->|"type: DecisionLogStore"| decisionLog
  handleTurn -.->|"type: RedrawState, TurnEvent, ..."| turnTypes
```

## What the file does, by event

| Event in the request body | Behaviour (from the code) |
|---|---|
| `open` | Settles the placement from the resume point and evidence. First visit to a module: Teacher proposes a move; if it is not a teaching move, an `explain_concept` introduction is ruled instead. Redirect, or rendered text, or nothing is stored. |
| `select_module`, `preview_module` | A closed or unknown module changes nothing. Otherwise returns that module's state. Only `select_module` saves the resume point. |
| `select_exercise` | Saves the resume point and appends an `event` message with the exercise title. |
| `quiz_answer` | Marks the chosen option against the module's quiz on the server. The first answer to a question is written to the `quiz_answers` ledger and an `event` message (`Quiz N: chose B, wrong`) is appended; a later answer to the same question changes neither. The turn recomputes mastery from the merged ledger and returns the updated roadmap. A wrong first answer then starts an agent turn, as a failed submission does; a right answer, and a repeat of an answered question, calls no model. The working area carries each question's result (the correct choice and explanation) only once answered. |
| `submission` | Appends one evidence row, recomputes mastery, appends an `event` message (`N/M tests passed`), then answers like a message. |
| `message` | Appends the student message, then Teacher and Deskmate each propose a move in parallel; each proposal goes through `decide`; approved moves are rendered by the model and streamed; every proposal and verdict is written to the decision log. |

## Verified imports

- Runtime: `course` (`defaultCourseId`, `studyModule`, `canonicalModuleId`, roadmap helpers), `storage` (`createMemoryCourseStore`, the default when `options.courses` is not passed). The course is read once a turn from `options.courses` (`options.courseId`, else `defaultCourseId`), in parallel with the ledger and the resume point, and travels on the `Placement` (course, module, exercise), so every helper, the student model and `decide` read the same course; `agents` (`moveKey`, `roleTable`), `student-model` (`estimateCourse`, `standingFor`, `furthestUnlockedModuleId`, and `createMemoryEvidenceStore`, used when no store is passed), `verify-shield` (`decide`).
- Type only: `shared/turn`, `agents` (`Agents`, `Move`, contexts), `verify-shield` (`Proposal`, `TurnSnapshot`, `Verdict`), `student-model` (`CourseEstimate`, `CourseStanding`, `EvidenceStore`), `storage/conversation-store`, `storage/decision-log`, `storage/quiz-answer-store` (`QuizAnswerStore`, `QuizAnswerRow`; its in-memory version is used at runtime when no store is passed).
- It imports no Supabase code. The model, the stores and the options are passed in as arguments (`handleTurn(request, store, agents, options)`), which is why `turn-endpoint.test.ts` can run it with in-memory stores.

## Importers and tests

- Imported by `routes/turn.post.ts`.
- Tests: `turn-endpoint.test.ts`, `quiz-answer.test.ts`, `wrong-quiz-brings-agents.test.ts`, `move-contract.test.ts`, `prompt-hardening.test.ts`, `real-language-model.test.ts`, `admin-handler.test.ts` — all call `handleTurn` with in-memory stores.

## Notes

- Render text is streamed straight from the model to the student. In this file there is no check of the rendered text, only of the proposed move. See the note in [server/03-verify-shield.md](03-verify-shield.md).
- If a model call fails, the student sees a fixed fallback message and the server logs the cause with `console.error`.
