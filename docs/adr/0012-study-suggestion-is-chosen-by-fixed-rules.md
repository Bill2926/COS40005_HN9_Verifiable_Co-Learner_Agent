---
status: accepted
---

# The study suggestion is chosen by fixed rules over the activity log, not by the language model

The activity log records how a student studies: pasting, running, leaving a module, switching layout. Nothing read it. The student now gets one study suggestion drawn from it, and fixed rules in code choose the situation and the step: the same log and the same dismissals always give the same step, and the only thing stored is what the student dismissed.

The log is not evidence (ADR 0002 and ADR 0010 stand: only the sandbox result of a submission is). Letting the language model decide from it would make a student-visible step depend on a free-text judgement we cannot reproduce or test, and would let a prompt-injected message steer the dialog. A step that tells a student where to go must be explainable by the rows that caused it, which a rule can show and a model cannot.

## Considered Options

- **The Teacher proposes the suggestion as a move**: rejected. It would cost a proposing turn, vary between identical logs, and need its own VerifyShield rule to stay inside the unlocked modules. The Teacher instead keeps teaching, is told the current step, and the VerifyShield holds `advance_to_module` to it.
- **Store the suggestion**: rejected. A stored suggestion goes stale as the log grows. Only dismissals are stored, as a step identity and the log row its episode was anchored on.
- **Count the log as evidence**: rejected. The suggestion changes no mastery, unlock or roadmap, and a dismissal writes no evidence row.

## Consequences

The twelve situations and their priority live in `web/server/study-suggestion/`; changing one is a code change with a test through the turn handler. A step's sentence is shown to the student and given to the Teacher word for word. Mai never hears it. A course preview, and a lecturer or administrator surface, show none.
