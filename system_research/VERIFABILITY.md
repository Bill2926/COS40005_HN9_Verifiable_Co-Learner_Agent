### What can be verified in Capstone

Verification here means checking the system against its own declared specification —
not against the real world. The project can prove what the system **cannot** do
(structural and behavioural guarantees), and can make every past decision
reconstructible. It cannot prove that the pedagogical model is didactically *correct*,
that generated content is *good*, or that learners *learn better*; those require
validation with real students and are declared out of scope.

The claims attach to the **pedagogical shield** (M2 + M3 + M6), never to the co-learner
agents (M1). The agents are non-deterministic and are deliberately not required to be
verifiable; the contribution is a guaranteed envelope around unguaranteed agents.

This approach relocates the unverifiable part rather than removing it: "do the agents
behave correctly" (unverifiable) becomes "does the shield match its spec" (verifiable),
leaving "is the spec complete" as a reviewable, human-readable artefact.

### Verification Methods

**VM1. Model-level — model owned by M2, checked by M3's algorithms**
Exhaustive traversal of the curriculum DAG and the pedagogical state machine, invoked by
the curriculum importer once at import time, before any learner interacts with the
system. Proves a property holds across *every* possible path, not merely across the test
cases the author thought of. This is the only method that yields a guarantee in the strong
sense, and it is where the word "semi-formal" in the capstone description is earned.

**VM2. Decision-level — enforced in M2, agents constrained in M1**
The shield is deterministic and non-bypassable: it never calls an LLM, and it is the
single mediation point between a proposed agent action and the learner. The agents are
constrained on both sides of the shield — they propose only typed moves from a closed
action space, and the utterance rendered for an approved move passes a deterministic
structural post-filter before it is served. Verified by replay (identical input yields
identical verdict across N runs) and by adversarial testing (M5). A technical guarantee
about system behaviour, not a mathematical proof.

**VM3. Audit-level — lies in M6 (evidence ledger) and M2 (decision log)**
Every decision is recorded with enough context to be reconstructed independently: the
ledger is append-only and accepts writes only from an allowlisted set of deterministic
sources, and each verdict is logged with the proposed action, the state it was computed
from, and the guard and threshold in force. Verified by a replay script that recomputes
historical verdicts from the log and checks for exact agreement. Consumed by M5.

### Capstone's Verifiable Characteristics

**VC1. No shortcut exists in the pedagogical model**
No path through the curriculum or the phase state machine reaches an assessment state
without passing the required practice states; the concept graph is acyclic and fully
reachable; declared thresholds are jointly satisfiable. A property of the model, asserted
over all paths.

**VC2. The shield cannot be bypassed**
No agent action, and no utterance rendered for one, reaches the learner except through
M2. There is no alternative route, no direct handler, no fallback path that skips
mediation, and no rendering path that escapes the post-filter. If VC2 fails, every other
characteristic is void.

**VC3. Decisions are deterministic and replayable**
The same ledger state and the same proposed action always produce the same verdict, and
any past decision can be recomputed from the audit log and shown to match what was served.

**VC4. Learner state derives only from objective evidence**
Values that guards depend on originate from deterministic sources. The agents may perceive,
propose and phrase, but never write to the evidence ledger and never decide a transition.
The deskmate agent's own knowledge state is held separately in M1 and is never conflated
with the learner's student model — the deskmate may be wrong about the learner, which is
pedagogically intended and carries no verifiability consequence.

### VC Applied Use Cases

**UC1 → VC1** — "Can I move on to the next concept?"
The model, not the code, decides. Verified before anyone uses the system.

**UC2 → VC2** — "Just give me the full solution."
The agent may propose it; the move never reaches the learner. Verified by attack, not by
trust.

**UC3 → VC3** — "Why was I blocked yesterday?"
The log recomputes the same verdict. Verified by replay.

**UC4 → VC4** — "The deskmate said I understood it."
Talk is content, not evidence. Only facts move the ledger.

### Verification Methods Mapping

| Characteristic | Methods | How it is demonstrated |
|---|---|---|
| VC1 | VM1 | Graph traversal over the full model; seeded invalid curricula are rejected at import |
| VC2 | VM2 | Single mediation point by architecture + adversarial prompt suite, reported as a pass rate against the `--no-shield` baseline |
| VC3 | VM2, VM3 | N-run determinism check + replay script recomputing historical verdicts |
| VC4 | VM3 | Append-only ledger with source allowlist; provenance traceable for every mastery value |

Each characteristic additionally carries its stated assumptions — e.g. VC1 holds only for
curricula loaded through the importer; a file edited outside that path is not covered.