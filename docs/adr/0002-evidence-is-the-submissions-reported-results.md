# Evidence is the submission's reported test results

Mastery is Bayesian Knowledge Tracing over the evidence ledger, and unlocking a module follows from it, so what counts as a correct observation decides what the student may study. A submission's tests are run in the student's browser under Pyodide, which is also what shows the student their results and keeps the editor responsive without a server round trip. The ledger therefore records the counts the submission reports: tests passed, tests total, and whether all of them passed. The server trusts those numbers; it does not run the tests again before writing the row.

## Considered Options

- **Run the exercise's tests again on the server before writing evidence**: rejected for this sprint. The server already has a Python runner, but a second run doubles the work on every submission, makes a submission wait on it, and needs the two runners to agree on every exercise before a disagreement can be read as anything but a bug.
- **Write evidence only for submissions whose code the server has executed**: rejected, same cost, and it would make the ledger silent whenever the server runner is unavailable, which reads as "the student did nothing" rather than "we could not check".

## Consequences

A student who calls the turn endpoint directly can report passes they did not earn. Three such submissions on three exercises master a module, and because a module stays unlocked once mastered, the module after it opens for good. This is a demonstration product with seeded accounts and no assessment riding on mastery, so we accept it for sprint 1. The ledger makes it visible rather than hiding it: every submission is one append-only row with its attempt number and counts, so a fabricated run can be read back afterwards. Checking submissions server-side is the fix when mastery starts to count for anything.
