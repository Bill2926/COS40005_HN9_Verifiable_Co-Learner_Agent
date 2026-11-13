# Sprint 1 status: CH9VSA-105 to CH9VSA-110

Checked 12 Nov 2026 against commit `5d54bd1`.
Basis: source, migrations, seed data, unit tests (13 files, 130 tests pass), Playwright specs read.
Supersedes the 11 Nov check.

## At a glance

| Key | Item | Status | Main gap |
|---|---|---|---|
| CH9VSA-105 | A1 Web app and editor | Done | none |
| CH9VSA-106 | A2 Sign-in and saved progress | Done | no separate progress screen |
| CH9VSA-107 | A3 Teacher and deskmate chat | Done | none |
| CH9VSA-108 | A4 Practice with tests and plain-language errors | Partial | errors are still raw Python |
| CH9VSA-109 | A5 Shield core: hints, no early answers, modules open on mastery | Partial | no attempt gate, no hint progression |
| CH9VSA-110 | A6 Course spec and decision log | Partial | no tamper evidence, no validated spec |

## What changed in this pull

- Mastery is now estimated with Bayesian Knowledge Tracing from an append-only evidence ledger, not fixed at zero.
- Modules unlock on mastery: Module 1 at the start, each later module when the one before is mastered, and never re-lock.
- The static `course-roadmap.ts` is gone. The roadmap, unlocking and admin view all read the same course model.
- Every submission is written to `evidence` with an attempt number and test counts.
- Five study modules now have content (Modules 1-5). Modules 6-11 stay closed as not available.
- The roadmap UI shows per-module mastery bars, a threshold marker, closed reasons, and part headings.

## Item detail

### CH9VSA-105 A1: Done
- Nuxt 4 app with sign-in, workspace, and responsive IDE and Roadmap canvas layouts.
- CodeMirror Python editor with Run and Submit; Python runs in the browser through Pyodide in a Web Worker.
- Evidence: `web/app/components/workspace/`, `web/app/python/browser-runner.ts`, `web/e2e/`.

### CH9VSA-106 A2: Done
- Supabase sign-in, demo accounts, and signed-in middleware.
- Resume point saved per student; one conversation per module; switching exercise stays in the same conversation.
- Drafts stay in `localStorage`, per student and exercise. Layout is saved per device.
- Attempts are now persisted in the `evidence` ledger (attempt number, tests passed, tests total), so the previous caveat is resolved.
- Note: there is no separate student-facing progress screen; the roadmap is the visible progress.

### CH9VSA-107 A3: Done
- Both agents propose a move in the same turn; the VerifyShield rules on both before any text is rendered.
- Teacher gets materials, hint ladder, misconceptions, draft, run output, and submission.
- Deskmate gets no materials, hint ladder, or solution; it may only ask a peer question or share confusion.
- Evidence: `web/server/turn/handle-turn.ts`, `web/server/agents/role-table.ts`, `web/app/components/workspace/ConversationPanel.vue`.

### CH9VSA-108 A4: Partial
- Done: 5 modules x 3 exercises x 3 tests = 45 checks. Pass/fail with expected and actual values.
- Done: every submission is recorded as evidence server-side (one row per attempt).
- Missing: plain-language errors. The UI still prints raw Python, for example `Line 1: ZeroDivisionError: division by zero`.
- Bug: the Practice panel says "This is not recorded as evidence" (`PracticePanel.vue:307`), which now contradicts the server.

### CH9VSA-109 A5: Partial
- Done: scope gating, closed and out-of-course redirects, keyword backstop, fail-closed fallback, VerifyShield trace.
- Done: modules open on mastery. Mastery is BKT over evidence; unlocking is a permanent chain; Module 1 is the only module open for a student with no evidence; Modules 6-11 stay closed.
- Done: the roadmap shows mastery per module, the 0.9 threshold, and why a module is closed.
- Missing "no early answers": `reveal_answer` is allowed for the teacher at any time. The turn snapshot carries mastery but no attempt count, so no gate is possible.
- Missing hint progression: `hint_level_N` accepts any level; nothing ties the level to attempts or to the previous hint.
- Caveat: the server trusts the browser's reported test results (ADR 0002), so a direct API caller can claim passes and unlock modules.

### CH9VSA-110 A6: Partial
- Done: every proposal is logged with agent, proposed move and scope, verdict, ruled move and scope, rule id, reason code, masteries, unlocked modules, and shield state.
- Done: logs are written server-side only; students are denied by RLS; the admin page shows the newest 100 with verdict and student filters; decisions are logged even when the shield is off.
- Missing tamper evidence: `decisions` has no hash chain and no database-level append-only guard; only RLS and the store API enforce append-only.
- Missing course spec: course content is split into `course.ts` plus five typed module files, but it is still TypeScript constants with no runtime validation or single spec document.

## Agent moves

Ten move types in a closed set (`web/server/agents/moves.ts`).

| Move | Teacher | Deskmate | Shield only | Notes |
|---|---|---|---|---|
| `explain_concept` | yes | no | no | needs scope |
| `answer_question` | yes | no | no | needs scope |
| `hint_level_N` | yes | no | no | level >= 1, any level accepted, needs scope |
| `address_misconception` | yes | no | no | needs misconception id and scope |
| `reveal_answer` | yes | no | no | no attempt condition |
| `advance_to_module` | yes | no | no | target must be unlocked; renders a message, moves nobody |
| `stay_and_practise` | yes | no | no | renders a message, changes no state |
| `peer_question` | no | yes | no | no scope |
| `share_confusion` | no | yes | no | no scope |
| `redirect_to_module` | no | no | injected | not in the model schema; replaces a teacher move |

### How a turn is ruled
1. Both agents propose from the closed set in the same turn.
2. The role table blocks a move the agent is not allowed to make.
3. With the shield off, every move is allowed and logged as `VERIFYSHIELD_OFF`.
4. A teacher teaching move must name an unlocked module; a closed or out-of-course scope becomes a redirect.
5. The keyword backstop reads the student message and redirects even when the label says in scope.
6. `advance_to_module` aimed at a locked or unknown module becomes a redirect.
7. Deskmate moves are only role-checked, never scope-checked.
8. The approved move is rendered by that agent, streamed to the student, and stored with its move key.

### Verdict rules (`web/server/verify-shield/decide.ts`)

| Situation | Decision | Rule id | Reason code |
|---|---|---|---|
| Shield off | allow | `verify_shield` | `VERIFYSHIELD_OFF` |
| Missing module or exercise | block | `role_table` | `ROLE_FORBIDDEN` |
| Move not in the agent's role table | block | `role_table` | `ROLE_FORBIDDEN` |
| Teacher teaches a not-unlocked module | downgrade | `scope_requires_unlocked_module` | `MODULE_CLOSED` |
| Teacher teaches out of course | downgrade | `scope_in_course` | `OUT_OF_COURSE` |
| In-scope label, message names an out-of-course topic | downgrade | `scope_keyword` | `OUT_OF_COURSE_KEYWORD` |
| In-scope label, message names a closed module | downgrade | `scope_keyword` | `MODULE_CLOSED_KEYWORD` |
| Advance to a locked or unknown module | downgrade | `scope_requires_unlocked_module` | `MODULE_CLOSED` |
| Deskmate | role table only | `role_table` | `ROLE_PERMITTED` or `ROLE_FORBIDDEN` |

### Labels the student sees

| Move key | Label |
|---|---|
| `explain_concept` | Explanation |
| `answer_question` | Answer |
| `hint_level_N` | Hint |
| `address_misconception` | Misconception |
| `reveal_answer` | Answer revealed |
| `advance_to_module` | Next module |
| `stay_and_practise` | Keep practising |
| `redirect_to_module` | Not yet |

## Cross-cutting observations

- One course model now: `course.ts` is the source for modules, roadmap and redirects, and `student-model/mastery-parameters.ts` for the mastery parameters; the old static roadmap file no longer exists.
- Unlocking is permanent: `everMastered` keeps a module open after mastery falls.
- Module 1 is the only module open to a new student; the seed gives Bình passes on Modules 1-4 so the demo shows mastered, open and closed cards.
- `advance_to_module` and `stay_and_practise` are ruled and labelled but change no state; a student moves modules only by clicking an unlocked card.
- `redirect_to_module` is never proposed by a model, by design; the shield injects it.
- The trace panel exists and is off by default, matching US30.
- The Practice copy about evidence is stale and should be fixed before the demo.

## Outside Sprint 1

- A7 Course roadmap (US11): implemented, now mastery-driven, clickable, and grouped by parts.
- US32 and US33: done on `/admin`.
- US16 progress history: attempts are stored, but there is no progress screen.

## Suggested Jira updates

| Key | Recommendation | Note |
|---|---|---|
| CH9VSA-105 | Done | App, editor, browser Python, responsive layouts. |
| CH9VSA-106 | Done | Resume point and conversations; attempts now stored in evidence. |
| CH9VSA-107 | Done | Teacher and deskmate split enforced by role table. |
| CH9VSA-108 | Keep open | Tests done; plain-language errors missing; stale evidence copy. |
| CH9VSA-109 | Keep open | Scope gating and mastery unlocking done; attempt gate and hint progression missing. |
| CH9VSA-110 | Keep open | Decision log done; tamper evidence and validated course spec missing. |

## How this was checked

```
cd web
pnpm test        # 13 files, 130 tests pass
pnpm rehearsal   # Playwright; specs read, not run in this pass
```

Source of truth: `web/server/course/`, `web/server/student-model/`, `web/server/verify-shield/decide.ts`,
`web/server/turn/handle-turn.ts`, `supabase/migrations/`, `supabase/seed.sql`.
