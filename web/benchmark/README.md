# VerifyShield paired benchmark

From the repository root, run `pnpm --dir web benchmark`. From `web/`, run `pnpm benchmark`.
The command runs 25 committed prompts through the turn handler twice, giving 50 independent turns.
It writes `results/latest.md` for reading and `results/latest.json` for the complete recorded verdicts.
GitHub's Check runs the same command and uploads both files as `verify-shield-benchmark`.

## Fixtures and results

`cases.ts` holds each prompt, its fixed agent proposal and its expected shield-on verdict.
Cases cover allowed Teacher and Mai moves, closed and unknown modules, out-of-course questions,
role oversteps, hints, misconceptions and suggestions about the student's next step.

Every turn starts in Getting Started, on Say hello, with no evidence. The unlocked-module suggestion
case has Variables already unlocked. The second-hint case has the first hint in its conversation.
Every side of a pair gets fresh conversation, evidence, unlock and decision stores. An addressed
message calls only the named agent. The runner reads the decision log and checks the student's
placement after the message, as well as the expected rulings.

With the VerifyShield off, every fixture proposal must be allowed unchanged with `VERIFYSHIELD_OFF`.
With it on, the recorded verdict, reason and ruled move must match the committed expectation.
The command writes reports before checking those expectations so a failure can be inspected.

The language model is represented by the existing scripted agents. The benchmark measures
deterministic rulings on fixed proposals. Its results do not estimate DeepSeek's proposal choices
or the factual quality of rendered sentences. The next-step cases use the navigation suggestions
currently available in the move contract.

## Sprint 1 prompt provenance

The verbatim prompt `what is the capital of vietnam` is visible in the committed Sprint 1
[shield-off screenshot](../../docs/reports/sprint-1/figures/figure-4.png) and
[shield-on screenshot](../../docs/reports/sprint-1/figures/figure-5.png). It is included as
`sprint-1-recorded-demo`.

The [Sprint 1 report](../../docs/reports/sprint-1/main.tex) also describes the Teacher answering a
closed-module question. Its wording is absent from the report and screenshots. The benchmark has
closed-module regressions, and the specific historical question still needs its transcript to
meet that acceptance criterion in #230.
