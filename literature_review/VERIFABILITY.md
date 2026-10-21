Định nghĩa cốt lõi: verifiability là mức độ mà một hệ thống (hoặc một đặc tả của nó) cho phép người ta kiểm chứng bằng phương tiện khách quan, hữu hạn rằng nó thoả mãn các yêu cầu đã nêu.

Chú ý từ khoá: khách quan (không phụ thuộc ý kiến người đánh giá) và hữu hạn (tồn tại một quy trình kết thúc được, cho ra phán quyết đạt/không đạt).

Bốn điều kiện tiên quyết

Một hệ thống chỉ verifiable khi có đủ:

1. Đặc tả chính xác — phải có thứ để so sánh. Không có spec thì không có khái niệm đúng/sai, chỉ có khái niệm bất ngờ/không bất ngờ.
2. Tính quan sát được (observability) — trạng thái bên trong phải đọc ra được để so với kỳ vọng.
3. Tính tái lập (reproducibility) — cùng đầu vào phải cho cùng hành vi. Bất định làm hỏng gần như mọi phương pháp kiểm chứng.
4. Không gian trạng thái bị chặn — đủ nhỏ hoặc đủ cấu trúc để duyệt, trừu tượng hoá, hoặc suy luận quy nạp.

### What can be verified in Capstone

Verification here means checking the system against its own declared specification —
not against the real world. The project can prove what the system **cannot** do
(structural and behavioural guarantees), and can make every past decision
reconstructible. It cannot prove that the pedagogical model is didactically *correct*,
that generated content is *good*, or that learners *learn better*; those require
validation with real students and are declared out of scope.

This approach relocates the unverifiable part rather than removing it: "does the LLM
behave correctly" (unverifiable) becomes "does the enforcement layer match its spec"
(verifiable), leaving "is the spec complete" as a reviewable, human-readable artefact.

### Verification Methods

**VM1. Model-level — lies in M3 (static constraint checking)**
Exhaustive traversal of the curriculum DAG and the pedagogical state machine, performed
once at import time, before any learner interacts with the system. Proves a property
holds across *every* possible path, not merely across the test cases the author thought
of. This is the only method that yields a guarantee in the strong sense, and it is where
the word "semi-formal" in the capstone description is earned.

**VM2. Decision-level — lies in M2 (enforced), M1 (constrained)**
The enforcement layer is deterministic and non-bypassable: it never calls an LLM, it is
the single mediation point between generated content and the learner, and M1 output is
restricted to a closed schema. Verified by replay (identical input yields identical
verdict across N runs) and by adversarial testing (M5). A technical guarantee about
system behaviour, not a mathematical proof.

**VM3. Audit-level — lies in M6 (evidence ledger) and M2 (decision log)**
Every decision is recorded with enough context to be reconstructed independently: the
ledger is append-only and accepts writes only from an allowlisted set of deterministic
sources, and each verdict is logged with the state it was computed from. Verified by a
replay script that recomputes historical verdicts from the log and checks for exact
agreement. Consumed by M5.

### Capstone's Verifiable Characteristics

**VC1. No shortcut exists in the pedagogical model**
No path through the curriculum or the phase state machine reaches an assessment state
without passing the required practice states; the concept graph is acyclic and fully
reachable. A property of the model, asserted over all paths.

**VC2. The enforcement layer cannot be bypassed**
No LLM-generated content reaches the learner except through M2. There is no alternative
route, no direct handler, no fallback path that skips mediation. If VC2 fails, every
other characteristic is void.

**VC3. Decisions are deterministic and replayable**
The same ledger state and the same proposal always produce the same verdict, and any
past decision can be recomputed from the audit log and shown to match what was served.

**VC4. Learner state derives only from objective evidence**
Values that guards depend on originate from deterministic sources; the LLM may propose
and phrase, but never writes to the evidence ledger and never decides a transition.

### VC Applied Use Cases

**UC1 → VC1** — "Can I move on to the next concept?"
The model, not the code, decides. Verified before anyone uses the system.

**UC2 → VC2** — "Just give me the full solution."
M1 may generate it; it never reaches the learner. Verified by attack, not by trust.

**UC3 → VC3** — "Why was I blocked yesterday?"
The log recomputes the same verdict. Verified by replay.

**UC4 → VC4** — "The agent said I understood it."
Talk is content, not evidence. Only facts move the ledger.

### Verification Methods Mapping

| Characteristic | Methods | How it is demonstrated |
|---|---|---|
| VC1 | VM1 | Graph traversal over the full model; seeded invalid curricula are rejected at import |
| VC2 | VM2 | Architectural single mediation point + adversarial prompt suite, reported as a pass rate |
| VC3 | VM2, VM3 | N-run determinism check + replay script recomputing historical verdicts |
| VC4 | VM3 | Append-only ledger with source allowlist; provenance traceable for every mastery value |

Each characteristic additionally carries its stated assumptions — e.g. VC1 holds only for
curricula loaded through the importer; a file edited outside that path is not covered.