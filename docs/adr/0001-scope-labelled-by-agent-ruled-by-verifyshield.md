# Scope is labelled by the teacher agent and ruled on by the VerifyShield

The VerifyShield must block the teacher agent from answering questions about closed modules or anything out of course, but it may not call a language model, or a ruling could not be replayed from the decision log. So the teacher agent's proposed move carries a scope label (a module, or "out of course") chosen by the language model with the student's course roadmap and mastery in its prompt, and the VerifyShield rules on that label deterministically against the student's unlocked modules, downgrading to a Redirect. A fixed keyword list, built from the course's Out of Scope list and the names of closed modules, is checked as a backstop against a mislabelled move.

## Considered Options

- **The VerifyShield classifies the question itself with a language model**: rejected, because it ends determinism and with it replay.
- **Tell the teacher agent the rule in its prompt and trust it**: rejected, because nothing would be ruled on, logged, or testable by the benchmark.

## Consequences

The rule is only as good as the label: a student who talks the language model into mislabelling a question can still get an answer the keyword backstop does not catch. We accept this for sprint 1; the benchmark's adversarial set should measure how often it happens.
