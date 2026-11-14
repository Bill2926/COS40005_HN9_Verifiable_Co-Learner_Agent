# Component: storage

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

Persistence behind interfaces. Each store has an interface with an in-memory version, and a Supabase version
that talks to Postgres. Part of [server/00-overview.md](00-overview.md).

Legend: solid = runtime import, dashed = type-only import. Blue = this component, grey = other components, teal = database.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  classDef db fill:#0f766e,stroke:#0a4f4a,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  routes["<b>routes</b><br/>turn.post, admin.post"]:::near
  turn["<b>turn/handle-turn.ts</b>"]:::near
  admin["<b>admin/handle-admin.ts</b>"]:::near
  shieldIface["<b>verify-shield/index.ts</b><br/>VerifyShieldStore interface"]:::near
  evIface["<b>student-model/index.ts</b><br/>EvidenceStore interface"]:::near
  choice["<b>language-model/index.ts</b>"]:::near
  db[("<b>Postgres</b><br/>Supabase")]:::db

  subgraph storage["storage: interface plus Supabase version"]
    direction TB
    conv["<b>conversation-store.ts</b><br/>supabase-conversation-store.ts"]:::comp
    ev["<b>supabase-evidence-store.ts</b>"]:::comp
    quiz["<b>quiz-answer-store.ts</b><br/>supabase-quiz-answer-store.ts"]:::comp
    dec["<b>decision-log.ts</b><br/>supabase-decision-log.ts"]:::comp
    ms["<b>model-settings-store.ts</b><br/>supabase-model-settings-store.ts"]:::comp
    vs["<b>supabase-verify-shield-store.ts</b>"]:::comp
  end

  routes -->|"6 createSupabase...Store"| storage
  ev -.->|"type: EvidenceStore, EvidenceRow"| evIface
  turn -.->|"type: ConversationStore,<br/>DecisionLogStore"| storage
  vs -.->|"type: VerifyShieldStore"| shieldIface
  admin -.->|"type: DecisionLogStore,<br/>ModelSettingsStore"| storage
  ms -.->|"type: ModelSettings"| choice
  storage -->|"supabase-js, secret key"| db

  style storage fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

Each box is a pair of files: the interface file (with its in-memory version) and the `supabase-` file that
implements it with `import type` from the interface file. The verify shield and evidence boxes are the exceptions: their interface
files are in the `verify-shield` and `student-model` components, so only the `supabase-` file is here.

## Stores and the tables they use

| Store | Interface offers | Tables (from the Supabase version) |
|---|---|---|
| conversation | `displayName`, `resumePoint`, `saveResumePoint`, `messages`, `appendMessage` | `students`, `resume_points`, `conversations`, `messages` |
| evidence | `append`, `forStudent` (attempt number is assigned by a database trigger). Reads merge submissions with quiz answers by timestamp. Only the Supabase version is here; the interface and the in-memory version live in [`student-model`](05-student-model.md). | `evidence` |
| quiz answers | `record` (keeps the first answer per student, module and question; a second returns the first unchanged), `forStudentModule`, and `observationsForStudent` for the evidence store. Interface and in-memory version in `quiz-answer-store.ts`. | `quiz_answers` |
| decision log | `append`, `list` (newest 100, filter by verdict and student) | `decisions` |
| model settings | `read`, `save` (single row, id 1) | `model_settings` |
| verify shield | `read`, `save`. Only the Supabase version is here; the interface, the in-memory version and the `verifyShieldEnabled` / `verifyShieldForTurn` rules live in [`verify-shield`](03-verify-shield.md). | `verify_shield_settings` |

## Verified imports

- The Supabase stores use `@supabase/supabase-js` and import their store interfaces. The evidence adapter also calls the quiz-answer adapter and merges the observations using `student-model/index.ts`.
- Runtime importers from outside: `routes/turn.post.ts` (all six Supabase files), `api/admin.post.ts` (three Supabase files). `turn/handle-turn.ts` also imports `quiz-answer-store.ts` at runtime for its in-memory default.
- Type-only importers: `turn/handle-turn.ts` (`conversation-store`, `decision-log`, and the `QuizAnswerStore`/`QuizAnswerRow` types), `admin/handle-admin.ts` (`decision-log`, `model-settings-store`), `agents/configured-agents.ts` (`model-settings-store`).
- Tests: `conversation-storage.test.ts`, `decisions-boundary.test.ts`, `model-settings-boundary.test.ts`, `quiz-answers-boundary.test.ts` (Supabase versions, against the live project); `turn-endpoint.test.ts`, `admin-handler.test.ts`, `quiz-answer.test.ts`, `wrong-quiz-brings-agents.test.ts`, `move-contract.test.ts`, `prompt-hardening.test.ts`, `real-language-model.test.ts` (the interfaces and their in-memory versions).

## Notes

- All six Supabase files create their own client with the same options (secret key, no session). They share no helper, so the setup is repeated six times, and `routes/turn.post.ts` creates them again on every request (each `createSupabase...Store` call makes a new client).
- The decision log, evidence and quiz-answers tables have no RLS policy, so only the server's secret key can read or write them. On the two ledgers (`evidence` and `quiz_answers`) update and delete are revoked from the anon and authenticated roles as well, so append-only is enforced there even if a policy were added later; `quiz_answers` keeps only the first answer through a `unique (student_id, module_id, question_id)` constraint.
