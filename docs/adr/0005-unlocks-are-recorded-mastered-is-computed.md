# Unlocks are recorded once; mastered is computed against the current threshold

A module unlocks for a student when the one before it is first mastered, and that unlock is stored as a fact that is never undone. Whether a module is mastered right now is still computed from evidence against the course's current mastery threshold. We do this because the lecturer can now change the threshold: replaying all evidence against a raised threshold would lock modules a student had already opened, which breaks the rule that an unlocked module stays unlocked.

## Considered Options

- **Replay evidence against the current threshold for unlocks too** (what the code did while the threshold was a constant): rejected, it re-locks modules when the threshold rises.
- **Stamp each piece of evidence with the threshold in force and replay against those**: rejected. It is harder to explain, and it makes a module's mastered state depend on the history of threshold changes rather than on the threshold the lecturer set.

## Consequences

Raising the threshold can turn a mastered module back to open, but never closed. Lowering it can unlock the next module on the student's next request.
