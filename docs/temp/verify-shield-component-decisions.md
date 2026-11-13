# VerifyShield component: settled decisions (draft, pre-spec)

Status: grilled 2026-11-13, not yet a spec or tickets. Read together with `agents-component-decisions.md` (D1–D7); V2 revises D5 there.

## Scope

- Covers `verify-shield/` (`decide.ts`, `verify-shield-store.ts`), plus the places in `turn/handle-turn.ts` that build `TurnSnapshot` and record decisions.
- ADR 0001 still holds: rulings are deterministic, never call a language model, and can be replayed from the decision log.

## Current rules, for reference

Applied in order by `decide()`; the first rule that matches wins.

0. Shield off → allow everything (`verify_shield` / `VERIFYSHELD_OFF`).
1. Empty module or exercise → block (wrongly labelled `role_table` / `ROLE_FORBIDDEN`).
2. Role table → block (`ROLE_FORBIDDEN`).
3. Scope, for Teacher teaching moves only (`scopeDowngrade`): keyword backstop → out of course → closed module, each a downgrade to `redirect_to_module`.
4. Advance to a known, closed module → downgrade to redirect (`advanceDowngrade`).
5. Otherwise allow (`ROLE_PERMITTED`).

## Decisions

### V2. Role is ruled by the VerifyShield, not the proposal schema (Q2) — ADR 0003
- One proposal schema shared by both agents. Role is enforced only by Rule 2, so oversteps are logged and can be shown with the shield off.
- Revises agents D5.

### V3. The VerifyShield rules on moves only (Q3)
- `CONTEXT.md` now says so. Rendered text is not checked this sprint.
- Parked for later: a deterministic check after rendering (e.g. matching a code block that defines the exercise's function, or a reference solution). It would need a buffered Teacher reply instead of a streamed one, and reference solutions in the course content.

### V4. Rule 1 gets its own label (Q4)
- `ruleId: turn_placement`, `reasonCode: NO_PLACEMENT`.

### V5. Fix the typo `VERIFYSHELD_OFF` → `VERIFYSHIELD_OFF` (Q5)
- Rewrite stored rows in `decisions`, in the same migration as agents D4 (`advance_to_item` → `advance_to_module`).

### V6. No silently skipped rules (Q6)
- `TurnSnapshot.unlockedModuleIds`, `studentMessage` and `verifyShieldOn`, and `decide`'s `course` parameter, become required.
- Merge `moduleId` and `currentModuleId` into one field: they are always equal (`standingFor(estimate, placement.module.id)`).
- Tests pass full snapshots.

### V7. Unknown scope (Q7)
- A scope that is neither a course module nor `out_of_course` → downgrade to `redirect_to_module(out_of_course)`, `reasonCode: SCOPE_UNKNOWN`. Today it is logged as `MODULE_CLOSED` while `redirectText` says "outside this course".

### V8. Advance edge cases (Q8)
- Target is not a course module → `block`, `ADVANCE_UNKNOWN_MODULE`.
- Target is the current module → downgrade to `stay_and_practise`, `ADVANCE_TO_CURRENT`.

### V9. Validate `misconceptionId` (Q9)
- The snapshot carries the current module's misconception ids.
- An unknown id → downgrade to `answer_question` with the same scope, `MISCONCEPTION_UNKNOWN`. Not a block, so the Teacher does not fall silent while the student is wrong.

### V10. Keyword backstop unchanged (Q10)
- Keywords are still whole module titles plus the out-of-course list (`course/course.ts`). This rarely catches a mislabelled move, e.g. "how do I use a dictionary?" does not match "Dictionaries and Sets".
- Left as is until the adversarial benchmark measures how often mislabelling gets through (ADR 0001 consequences).

### V11. Hint ladder rule (Q11, implements agents D6)
- New rule after scope (3, 4) and before the default allow: `ruleId: hint_ladder`, `reasonCode: HINT_SKIPPED`.
- `TurnSnapshot.highestHintGiven: 0 | 1 | 2 | 3`, worked out from stored `approvedMove`s in the module's conversation.
- A level above `highestHintGiven + 1` → downgrade to `hint_level_N` at `highestHintGiven + 1`. A rung already given may be repeated.

### V12. No scope check on the Deskmate (Q12)
- The Deskmate cannot teach, so it cannot teach out of course. Unchanged.

## Rule order after these changes

0. Shield off → allow (`VERIFYSHIELD_OFF`).
1. No placement → block (`turn_placement` / `NO_PLACEMENT`).
2. Role table → block (`ROLE_FORBIDDEN`).
3. Scope (Teacher teaching moves): keyword backstop → out of course → unknown scope (`SCOPE_UNKNOWN`) → closed module.
4. Advance: unknown → block; current → `stay_and_practise`; closed → redirect.
5. Misconception id unknown → `answer_question` (`MISCONCEPTION_UNKNOWN`).
6. Hint ladder → next rung (`HINT_SKIPPED`).
7. Allow (`ROLE_PERMITTED`).

(`reveal_answer` leaves the teaching moves and the role table, per agents D2.)

## Tentative work breakdown (not yet tickets)

1. Snapshot contract: required fields and the merged module field (V6), plus the label fix (V4). Do first; everything else builds on it.
2. Migration: the typo (V5), together with agents D4.
3. New and corrected rules: V7, V8, V9, V11.
4. Docs: ADR 0003 (written), and `docs/c4/03-components` for the VerifyShield once `TurnSnapshot` changes.

Depends on agents item 1 (the single Move contract), because the rules match on move types.

## Seen but parked

- V3's check on rendered output.
- V10's stronger keyword backstop, waiting on the benchmark.
- `verifyShieldForTurn`: when the store read fails, it falls back to the environment without saying so. Acceptable for now; mention it if the admin component is grilled.
