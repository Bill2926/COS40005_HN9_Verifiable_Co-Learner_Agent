# Student model (BKT) and course: settled decisions (draft, pre-spec)

Status: grilled 2026-11-13, not yet a spec or tickets. Read with `agents-component-decisions.md` (D1–D7) and `verify-shield-component-decisions.md` (V2–V12).

## Scope

- **Quiz is in this sprint** (Q1), alongside chat with the LLM.
- Touches `course/` (content), `student-model/` (BKT), `storage/` (a new table), `turn/` (a new event), `agents/` (context), and the Learn-mode UI.

## How it works today, for reference

- Only a submission writes evidence: one append-only row in `public.evidence` per submission, holding test counts only, never code (`supabase/migrations/20261111181404_create_evidence.sql`).
- `estimateMastery` (`student-model/estimate.ts`) replays the whole ledger with BKT every time it is needed. Nothing is stored. Parameters (`mastery-parameters.ts`): prior 0.1, learning 0.15, slip 0.1, guess 0.2, threshold 0.9.
- A submission is correct only when all tests pass. A pass counts only the first time per exercise, and a failure always counts.
- Unlocking is a straight chain and permanent (`everMastered`).
- With these numbers, 3 passes in a row master a module (0.433 → 0.809 → 0.958).

## Decisions

### S1. Quiz format (Q2)
- Multiple choice: four choices, exactly one correct. No "predict the output" questions this sprint.

### S2. One quiz question is one BKT observation (Q3)

### S3. Quiz lives in Learn mode; new terms (Q4)
- Shown after the module's materials, as "check your understanding".
- New glossary terms **Quiz** and **Quiz answer**. **Evidence** now comes from a submission or a quiz answer. **Attempt** is still a submission only. **Working area**'s Learn mode now includes the quiz.
- This deliberately departs from the research docs ("the teaching phase produces no evidence"): reading still produces none, but answering a quiz does.

### S4. The server marks quiz answers (Q5)
- The correct choice stays on the server and is never sent before the student answers. The client sends only the chosen option.
- Quiz evidence is therefore more trustworthy than code evidence, which ADR 0002 still takes from the client.

### S5. Ignore everything after an exercise's first pass (Q6)
- Once an exercise is passed, later submissions on it, failures included, are no longer BKT observations. They are still recorded in the ledger.
- Fixes today's asymmetry, where a repeat pass is ignored but a repeat failure lowers mastery.

### S6. Hint-assisted passes: unchanged, parked (Q7)
- BKT does not know whether a pass came after hint rung 3. Revisit with data and an ADR: it would join `messages` into the student model, and the hint rung comes from an LLM-proposed (though VerifyShield-ruled) move.

### S7. Keep the BKT learning step after a failure (Q8)
- A failure at low mastery still raises it slightly (0.1 → 0.162 → 0.170). This is standard BKT; document it, don't change it.

### S8. One module name (Q9)
- Drop `name` from `StudyModule` (`course/study-module.ts`). `CourseModule.name` (`course/course.ts`) is the only source.
- The quiz is added to `StudyModule`, as module content.

### S9. Glossary describes what exists (Q10)
- The constraint checker (CBM-lite) is removed from **Evidence**. Parked as future work.

### S10. BKT slip and guess per kind of evidence (Q11)
- Shared: prior 0.1, learning 0.15, threshold 0.9.
- Submission: slip 0.1, guess 0.2 (unchanged). Quiz answer: slip 0.1, guess 0.25.
- Still written once, in `mastery-parameters.ts`.

### S11. Mastered needs at least one passed exercise (Q12)
- Mastered = BKT mastery ≥ threshold **and** at least one of the module's exercises passed. Otherwise 3 correct quiz answers alone would master a module (0.393 → 0.745 → 0.926) with no code written.
- `everMastered`, and so unlocking, uses the same rule.
- The course roadmap gives the reason when a module is at the threshold but has no exercise passed yet.
- The BKT maths is untouched.

### S12. Only the first answer to a quiz question counts (Q13)
- After answering, the server returns right/wrong, the correct choice, and a one-line explanation.
- The student may choose again to learn, but those choices are not written to the ledger.

### S13. Quiz content (Q14, revised)
- **3 questions per module** (revised from 5: five was too many), written in the module files (`course/modules/*.ts`) next to the exercises: 15 questions for the 5 available modules.
- Each question has 4 choices, one correct choice, and an explanation.
- Each wrong choice may carry a `misconceptionId` that points into the module's `misconceptionResponses`.

### S13a. Populate the quiz content of the current modules
- Write the quiz for each of the 5 available modules (Getting Started, Variables, Strings, Conditionals, Loops): 3 questions each, 4 choices, one correct choice, an explanation, and a `misconceptionId` on a wrong choice where one of the module's `misconceptionResponses` fits.
- Questions cover only that module's materials, never a later or closed module, so a quiz cannot teach something out of order.
- The correct choice's position varies across questions, and all choices are of similar length, so the answer cannot be guessed from the shape.
- A content test checks every module: exactly 3 questions, 4 choices each, exactly one correct, every `misconceptionId` resolves.
- Note: with 3 questions, a fully correct quiz takes mastery from 0.1 to 0.926. That is above the threshold, so S11 (at least one passed exercise) is what keeps a module from being mastered by the quiz alone.

### S14. A separate `quiz_answers` table (Q15)
- Columns: `student_id, module_id, question_id, choice, correct, recorded_at`, with `unique (student_id, module_id, question_id)` (only the first answer is stored, per S12). Server only, with RLS and no policies, like `evidence`.
- Conceptually both tables are the evidence ledger. `EvidenceStore.forStudent` merges them by time into one `Observation` stream with `kind: 'submission' | 'quiz_answer'`.
- While touching storage: revoke `update, delete` on both ledger tables from `anon, authenticated`, so "append only" holds even if a policy is added later.

### S15. Quiz answers in the conversation (Q16)
- Every quiz answer appends an `event` message (e.g. "Quiz 2: chose B, wrong").
- Only a wrong answer starts an agent turn. A right one does not.
- Teacher context gets the module's quiz results, with `misconceptionId` where present. Deskmate context gets the results too (the student can see them, per agents D1), but not the explanations.

### S16. Teacher sees only answered quiz questions (Q17)
- Unanswered questions and their correct choices never enter any prompt. Otherwise "what is the answer to question 3?" could leak the one answer that counts, and the VerifyShield does not check rendered text (V3).

## Effects on the other decision files

- Agents D1 (Deskmate's view): add quiz results, without explanations (S15).
- Agents D7 (delimiters): the event text of a quiz answer is not student-authored and needs no delimiter, but any free text would.
- VerifyShield: no new rule. The quiz answer key is protected by keeping it out of prompts (S16), not by the VerifyShield.

## Tentative work breakdown (not yet tickets)

1. BKT fixes on the existing ledger: S5, S10 (types only, quiz guess not used yet), S11. Pure functions, test-first.
2. Course content model: S8, and the quiz shape in `StudyModule` (S13), typed as exactly three questions like `tests`.
2a. Course content: write the 15 quiz questions for the 5 current modules, plus the content test (S13a). Can start as soon as the shape in item 2 is settled.
3. Storage: the `quiz_answers` migration, revoking ledger grants, and the merged `forStudent` (S14).
4. Turn: a quiz-answer event, server marking, first-answer-only (S4, S12, S15).
5. Agents: quiz results in the Teacher and Deskmate context, answered questions only (S15, S16).
6. UI: the quiz in Learn mode, and the roadmap reason for S11.
7. Docs: `docs/c4/03-components` for student-model, course and storage. The research docs' "teaching phase produces no evidence" is now outdated.

Order: 1 and 2 in parallel → 2a alongside 3 → 4 → (5, 6).

## Seen but parked

- S6: hint-assisted passes.
- S9: the constraint checker (CBM-lite) and the "misconception state" estimator from the research docs (M6).
- "Predict the output" quiz questions (S1).
- The research docs' example "the deskmate raises the reset" conflicts with the glossary (only the teacher names a misconception) and with agents D1.
- Code evidence still comes from the client (ADR 0002). Server-side re-running would now be easy to compare with quiz marking, since `referenceSolution` already exists on the server.
