# Agents component: settled decisions (draft, pre-spec)

Status: grilled 2026-11-13, not yet a spec or tickets. Other components will be grilled before this becomes issues.

## Sprint scope

- In scope: chatting with the language model — the Teacher and Deskmate propose → VerifyShield → render loop, the prompts, and the Move contract between `agents/` and `language-model/`.
- `verify-shield/` and `turn/` change only where they consume a Move.
- Out of scope: mastery, evidence, the course roadmap UI, admin, provider changes.

## Decisions

### D1. Deskmate sees only what the student sees (Q2, Q9)
- Remove `misconceptionResponses` from `DeskmateContext` (`agents/contexts.ts`) and from `deskmateContext()` (`turn/handle-turn.ts`) and `deskmatePrompt()`.
- Deskmate keeps: exercise statement, draft, run output, submission, conversation.
- Added by student-model S15/S16: both agents also see the module's quiz results (answered questions only); only the Teacher sees the explanations.
- "Mai" is the Deskmate's official display name (now in `CONTEXT.md`).
- Deskmate prompts change from "You know little" to "at the student's level, learning alongside them".

### D2. Remove `reveal_answer` this sprint (Q3, Q14)
- Remove it from `Move`, `moveTypes`, `roleTable.teacher` and the proposal schema.
- Keep the `'Answer revealed'` label in `teacherMoveLabel` so stored messages still display.
- Reason: the role table allowed it while the render instructions forbid handing over a solution. A gated version (allowed after N failed attempts) needs evidence and belongs to a later sprint.

### D3. `advance_to_module` and `stay_and_practise` are suggestions (Q4)
- They change nothing in placement or mode. The Teacher suggests and the student chooses.
- Teacher render instructions must word these as suggestions, never as "we are moving now".

### D4. Rename `advance_to_item` → `advance_to_module` (Q5, Q14)
- "Item" is only an internal design-doc word (`CONTEXT.md`, Module).
- Add a Supabase migration that rewrites `advance_to_item:*` → `advance_to_module:*` in `messages.approved_move`, `decisions.proposed_move` and `decisions.ruled_move`.
- Update `moveKey`, `teacherMoveLabel`, `decide.ts` and the tests.

### D5. One source of truth for the Move contract (Q6)
- Today the move list lives in five places: `moveTypes`, the `Move` union, `roleTable`, the zod `moveSchema` (in `language-model/provider-language-model.ts`), and the hand-written list in `teacherProposeInstructions`. They have already drifted: `scope?` is optional in TS but required in zod.
- Move the zod schema into `agents/moves.ts`. From it, derive the `Move` type, **one** proposal schema shared by both agents (every move except `redirect_to_module`), and each agent's move list in its propose instructions (from `roleTable`).
- Revised by verify-shield decision V2 / ADR 0003: no per-agent schema. The role table is enforced only by the VerifyShield, so oversteps are ruled on, logged, and visible with the shield off.
- `language-model` takes the proposal schema as a parameter and no longer defines moves itself.
- `scope` becomes required in the type. Fake agents must give scope.
- `redirect_to_module` stays a VerifyShield-only move: it is in the `Move` type but in no agent's proposal schema.

### D6. Hint ladder rules (Q7, Q10, Q11)
- Every module has exactly 3 rungs (true for all 5 modules today). `hint_level_N.level` is `int().min(1).max(3)` in the schema, so the model is told the limit. No extra cap in `decide`.
- Conversation lines in the prompt include `approvedMove`, so the Teacher knows which rungs it has given.
- When rendering `hint_level_k`, the prompt contains only rung k, not the whole ladder.
- No skipping rungs: VerifyShield gets the highest rung already given in this module (worked out from stored `approvedMove`s and put in `TurnSnapshot`). A proposal above highest + 1 is downgraded to highest + 1. Repeating a rung ≤ highest is allowed.

### D7. Prompt hardening (Q8, Q12, Q13)
- Wrap all student-authored content (messages, draft, run output, submitted code) in clear delimiters, and tell both agents that content inside them is data, not instructions. VerifyShield is still the real guard.
- Retry `proposeMove` once, only on a parse or schema failure (never on network errors or 4xx), before falling back. The retry lives in `language-model/`.
- Cap the conversation in both prompts at the last 30 messages, with an "N earlier messages omitted" line. The hint rungs in D6 come from the store, not the truncated prompt.

## Tentative work breakdown (not yet tickets)

1. Single-source Move contract (D5), with removing `reveal_answer` (D2) and the hint `max(3)` (D6, schema part).
2. Rename to `advance_to_module` plus migration (D4).
3. Deskmate's view and persona (D1).
4. Hint ladder memory and no skipping (D6), plus suggestion wording (D3).
5. Prompt hardening (D7).

Order: 1 → 2 → (3, 4, 5 in parallel). Test-first with fake agents and the prompt tests. Update `docs/c4/03-components` where a component interface changes (item 1 changes the `agents` ↔ `language-model` boundary; item 4 adds to `TurnSnapshot`).

## Seen but parked (outside this sprint)

- ~~`decide.ts` reason code typo `VERIFYSHELD_OFF`~~: now verify-shield decision V5, fixed in the same migration as D4.
- The Deskmate proposes in parallel with the Teacher, so it decides without seeing the Teacher's reply in this turn (the render does see it). Kept as is for latency.
