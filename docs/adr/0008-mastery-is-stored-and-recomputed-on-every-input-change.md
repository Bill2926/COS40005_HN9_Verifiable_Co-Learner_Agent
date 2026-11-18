# Mastery is stored, and recomputed whenever anything it depends on changes

Mastery used to be computed from the whole evidence ledger on every request and never kept. We now store each student's mastery per module in the database, and every reader uses that stored copy: the course roadmap, unlocking, the decision log snapshot, and the teacher agent's `get_student_mastery` tool. We do this so the teacher agent can look mastery up as a tool, against the same number the student sees, rather than receive a value recomputed into its prompt each turn. The stored copy is still derived from evidence alone (ADR 0002) and is never written by anything else.

A stored copy is only right while it is recomputed on every change to its inputs, not just on the student's own work. It is recomputed when:

- the student records new evidence (a submission or a quiz answer), for that student;
- a lecturer publishes a course spec, for every enrolled student, because modules, exercises and questions may have changed;
- a lecturer changes the mastery threshold, for every enrolled student, because whether a module is mastered is judged against the current threshold (ADR 0005).

If a stored row is missing, it is recomputed from evidence and saved before it is read.

## Considered Options

- **Keep computing on every request**: rejected. It works, but the tool would be returning the prompt's number by another route, and there is no single stored value that the roadmap, the VerifyShield and the agent are all seen to share.
- **Recompute only on the student's own evidence**: rejected. A publish or a threshold change would leave every student's stored mastery stale until they next submitted, and the roadmap would show a mastered state the current threshold does not support.

## Consequences

Publishing a course spec or changing the threshold now does work proportional to the number of enrolled students. Unlocks stay as ADR 0005 records them: a recompute can turn a mastered module back to open, never closed.
