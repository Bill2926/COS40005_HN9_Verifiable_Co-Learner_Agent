# Guard patterns used on LLM tutors and agents

Research ticket [#8](https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent/issues/8) on map [#1](https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent/issues/1). Compiled 2026-10-07.
Vocabulary follows `CONTEXT.md` (Guard, Transition, Pedagogical state, Verification middleware, Shortcut learning). This file records facts and patterns only. Design choices belong to later tickets.

## Answer summary

- The 12 papers use about nine different kinds of Guard. They differ in **what is checked**: the proposed action or tool input, the order of steps (preconditions), whether the task is complete, the risk across the whole future trajectory, the content of the reply, an update to the learner model, or the learner's dialogue state.
- **Only four papers put the allow/deny decision in deterministic code at run time.** They all come from software-engineering venues and none were tested on tutoring:
  - **AgentSpec**: trigger → predicate → enforcement rules, with predicates written as Python Boolean functions.
  - **RefineAct**: a Prolog verifier over a specification that an LLM derives from the user's instruction.
  - **ProbGuard**: PRISM model checking over a Markov chain learned from traces, plus a threshold.
  - **IntelliCode**: an orchestrator that validates every learner-state update against a schema and rejects bad ones.

  **MaskingAgent** probably belongs here too, because it decides by executing the code in the tutor's reply. I could only read its abstract, so that is UNVERIFIED.
- **The tutoring papers mostly let an LLM decide**:
  - **Yasir et al.**: an LLM "Judge" rewrites the Tutor agent's feedback.
  - **VERITAS**: an LLM verification agent either refines the answer or refuses.
  - **Cohn et al. (Copa)**: GPT-5 picks a dialogue policy such as `PROBE_UNDERSTANDING` when students ask for direct answers.
  - **IntelliCode**: "no solution disclosure" in hints is enforced only by the prompt.

  **ReGuard** also uses a learned model as the decider: a fine-tuned 1B-parameter Llama.
- **What happens on a violation** falls into five groups:
  - block or stop (AgentSpec `stop`, RefineAct *Action Rejected*, ProbGuard *stop*)
  - escalate to a human (AgentSpec `user_inspection`, RefineAct *Approved with Constraints*)
  - regenerate with feedback (AgentSpec `llm_self_examine`, RefineAct *Revision Required*, ProbGuard *reflect*, VERITAS refinement loop)
  - rewrite the reply (Yasir Judge override, MaskingAgent masking)
  - a recovery move instead of refusal (ReGuard fallback policy; Copa "probe instead of answer"; VERITAS "fail gracefully")
- **Success is measured inconsistently.** The SE papers report safety/utility pairs: unsafe or failure rate against task completion or helpfulness, warning time, intervention rate and overhead in milliseconds. The tutoring papers report:
  - answer revelation, rated by human experts (Yasir)
  - "Reliability Rate" = correct answers + graceful refusals (VERITAS)
  - correlations between reliance and mastery (Copa)
  - mastery gain and calibration error (ECE) on simulated learners (IntelliCode)
  - "learning gain" of *LLM-simulated* students (Yasir)

  **No paper reports a deterministic answer-leak rate together with real learning gain against a control group.**
- **The learner-modelling papers argue that learner-model conditions should come from a dedicated knowledge-tracing (KT) model, not from the LLM.** Hooshyar et al. find DKT beats Llama-3-8B: AUC 0.83 vs 0.77 fine-tuned and 0.69 zero-shot, and DKT's mastery updates are more stable. Scarlatos et al. show a working split where the LLM labels each turn (knowledge component, correct or not) and a KT model computes mastery. Both match the project's rule that LLMs may label inputs but code decides.
- **Two warnings are directly relevant to "only code decides":**
  - LLMs did badly as allow/deny judges. Zero-shot GPT-5 and GPT-4o scored a monitor F1 of 0.29 in ReGuard. A verifier made already-reliable tutor feedback worse by 4–6 percentage points in Yasir et al.
  - Rules or specifications written by an LLM have systematic gaps: AgentSpec's generated rules had 70.96% recall, and RefineAct names specification faithfulness as its main threat to validity. So "code decides" is only as good as whoever wrote the Guard.

## How this was researched

The primary sources were the papers themselves (author or arXiv PDFs, ACL Anthology, AAAI OJS) and the official code repositories they link to. The team's notes in `group_review_notes.txt` already summarise ReGuard, AgentSpec, ProbGuard, AdaRubric and Looi et al. one paper at a time. This file does not repeat those summaries; it compares the papers along the Guard dimensions the ticket asks for.

| Paper | Version read | Access |
|---|---|---|
| AgentSpec | arXiv 2503.18666 **v3** (31 Jul 2025); published at ICSE '26 | full text |
| RefineAct | ASE '26 camera-ready PDF (lab site) | full text |
| ProbGuard | ASE '26 camera-ready PDF (author site) | full text |
| ReGuard ("From Refusal to Recovery") | IASEAI '26 proceedings PDF (AAAI OJS) | full text |
| When Verification Hurts (Yasir et al.) | arXiv 2603.27076 v1 | full text |
| Copa (Cohn et al.) | arXiv 2605.30539 v1 | full text |
| IntelliCode | EACL 2026 demo, ACL Anthology PDF | full text |
| Scarlatos et al. (LAK '25) | arXiv 2409.16490 v2 | full text |
| Huang, Scarlatos et al. (2026 follow-up) | arXiv 2605.01097 v1 | full text |
| Hooshyar et al. | arXiv 2512.23036 v1 (preprint title "Problems with LLMs for learner modelling…") | full text of preprint; **IEEE published version not read** |
| MaskingAgent | SIGCSE TS 2026 V.2 poster, pp. 1227–1228 | **abstract only**: the ACM DL returned HTTP 403 (Cloudflare) even though OpenAlex lists it as CC-BY |
| VERITAS | SAC '26, pp. 103–110 | **abstract only**: the ACM DL returned HTTP 403 |
| Looi, Liu & Sun ("Taming the black box") | CAEAI vol. 10, art. 100586 | **abstract only**: ScienceDirect returned HTTP 403 (it is a gold-OA journal) |

For the three abstract-only papers, any claim beyond the abstract is marked **UNVERIFIED**.

## Guard-type catalogue

Column meanings:
- **When**: *pre-gen* = before the LLM writes the reply or before the action executes; *post-gen* = after the reply is written but before the learner or environment sees it; *offline* = when the Guard or model is built.
- **Decided by**: *code* = deterministic rules or a solver; *learned* = a trained model (classifier, RL policy, KT model); *LLM* = a prompted or fine-tuned LLM making the call.

| # | Guard type | What is checked | When | Decided by | On violation | Paper(s) |
|---|---|---|---|---|---|---|
| G1 | **Trigger → predicate → enforcement rule** (a small rule language, or DSL) | A proposed action plus the current state. Triggers are `before_action`, `state_change` or `agent_finish`. Predicates are Booleans such as `is_destructive_cmd` or `!is_to_family_member` [AgentSpec §3.2, Fig. 3, Table 2]. | Pre-gen, at the moment the action is about to execute. Rules are written offline, by hand or by an LLM [AgentSpec §4]. | **Code**: predicates are Python Boolean functions the user writes, or that an LLM writes for user review [AgentSpec §4, §5.3]. | `stop` (end the trajectory); `user_inspection` (pause for human approval); `invoke_action` (run a predefined corrective action); `llm_self_examine` (the LLM regenerates a corrected action) [AgentSpec §3.3, Def. 3.2] | AgentSpec |
| G2 | **Specification derived from the user's intent, with precondition chains** (refinement calculus) | (a) Risky substrings in the tool input, e.g. `rm -rf /`. (b) The step's precondition must already be established by an earlier step's postcondition, which enforces order and prevents skipped steps. (c) On "Final Answer", the goal postcondition must be satisfied (a completeness check) [RefineAct §4.4]. | Spec built offline per task by an LLM and syntax-checked by SWI-Prolog [§4.2–4.3]; checked pre-gen on every proposed action and at task completion [§4.4]. | **Code** (Prolog) decides, but over a spec an **LLM wrote** (GPT-4o-mini formalises the intent; o1 refines the plan) [§5]. | One of four dispositions [§4.4]: *Approved*; *Approved with Constraints* (adds a scoped user-confirmation step); *Revision Required* (feedback naming the missing precondition, with up to 3 retries that get more directive each time); *Action Rejected* (blocked; the task may continue another way). **If retries run out, a non-final action goes ahead anyway**; a final action ends with an explanation [§4.4 "Retry Loop"]. | RefineAct |
| G3 | **Probabilistic look-ahead over the trajectory** (a Markov chain plus model checking) | P_safe, the probability that the invariant `AG ¬unsafe` (never reach an unsafe state) keeps holding from the current abstract state. States are vectors of predicate values; impossible transitions are excluded via `valid_tran` [ProbGuard §3.1–3.3]. | The Markov chain (DTMC) is learned **offline** from execution traces and is not updated at run time [§4]; checked **online** at every step, before the risk materialises [Alg. 2]. | **Code**: PRISM computes P_safe and the monitor compares it with a user-set threshold θ [§3.3, §4]. | `stop` (halt), or `reflect`: a fixed-format risk alert appended to the prompt. Reflect "is advisory and purely textual: ProbGuard never overrides action selection" [§4]. The framework itself does not prescribe which response to use [§3.3]. | ProbGuard |
| G4 | **Learned safety filter with a recovery policy** | Whether a candidate action leads to a state from which failure is unavoidable. This is a safety Q-value computed in the LLM's latent space, with failure defined by real outcomes such as a collision or going over budget [ReGuard §3.2–3.3]. | Trained offline with safety-focused RL (double DQN) in a simulator [§4–5]; run-time check on every step, intervening only when the monitor predicts failure [§6.2]. | **Learned**: a LoRA-fine-tuned Llama-3.2-1B [§5]. | The unsafe action is **replaced** by a fallback-policy action ("recovery"), not refused [§3.3]. The paper contrasts this with LlamaGuard, whose only response is stop [§6.2]. | ReGuard |
| G5 | **Execute the code in the reply, then mask it** | Whether the tutor's reply contains code that is a *correct full solution* [MaskingAgent abstract]. | Post-gen (it "inspects tutor responses") [abstract]. | Code execution [abstract]. **UNVERIFIED**: how correctness is judged (test cases? a reference solution?) and whether an LLM is involved. | **Rewrite**: the essential parts of the code are masked, producing a scaffolded version [abstract]. | MaskingAgent |
| G6 | **LLM verifier or judge on the tutor's output** | Yasir: the student's step and the Tutor agent's feedback, checked "for correctness and answer leakage", with full access to the solution [Yasir §4.4]. VERITAS: answers grounded in course content via retrieval (RAG), checked for reliability [abstract]. | Post-gen. | **LLM**. In Yasir, the Judge gets the derivation context from a knowledge graph, but the LLM still makes the call [§4.4, §6.4]. VERITAS uses "a dedicated verification agent" [abstract]. | Yasir: the Judge "either enhances or overrides" the feedback (a rewrite) [§4.4]. VERITAS: an iterative refinement loop (regenerate), or "fail gracefully by refusing to answer when confidence is low" [abstract]. **UNVERIFIED**: how VERITAS computes confidence. | Yasir et al.; VERITAS |
| G7 | **Diagnosis → intent selection → constrained response** (a three-layer pipeline) | The student's diagnosed state, which determines the instructional intent, which in turn constrains what the LLM may generate [Looi abstract]. | Pre-gen: the intent is fixed before the reply is written [abstract]. | "Rule-guided" [abstract]. **UNVERIFIED**: whether diagnosis and intent selection are code rules or LLM calls. | Constrains generation rather than blocking afterwards. The reported effect is fewer premature answers and less "early closure" [abstract]. | Looi et al. |
| G8 | **LLM chooses a dialogue policy, conditioned on the learner model** | The student's *dialogue state* (e.g. `INFORMATION_SEEKING`) combined with the learner model: task mastery from rubric scoring of logs, a strategy label, and a learner-state label [Copa §4]. | Pre-gen, on every student message [§4]. | **LLM**: GPT-5's DialogueAgent, which explains its choice step by step [§4]. The strategy and assessment labels also come from LLM sub-agents [§4]. | A recovery move: `PROBE_UNDERSTANDING` "when students request direct solutions or express misconceptions", instead of answering [§4]. Ad hoc escalation also happened ("maybe ask your teacher…") [§6.6]. | Cohn et al. (Copa) |
| G9 | **Single-writer, schema-validated learner state, plus rule-based curriculum** | Every proposed change ("delta") to the learner state from the six agents is checked against the state schema; conflicts are resolved by a fixed priority order [IntelliCode §2.1]. The Content Curator enforces prerequisite dependencies [§3.1]. | Before an update is committed [§2.1]. | **Code**: the orchestrator. The Learner Profiler and Content Curator are deterministic; hinting and code review use an LLM [§3.1]. | Malformed or conflicting deltas are "rejected and logged for audit" [§2.1]. Not disclosing solutions in hints is handled only by the five-level hint protocol in the prompt; no check is described [§3.1, Table 1]. | IntelliCode |
| G10 | **LLM labels, KT model computes mastery** (supplies inputs to learner-model Guards; not a Guard on its own) | Whether each student turn is correct, and which knowledge components (KCs) it involves. These labels are produced by GPT-4o; a KT model (BKT, DKT or LLMKT) then estimates mastery [Scarlatos §3–4]. The 2026 follow-up adds an IRT layer combining ability and item difficulty [Huang et al. §3.3]. | Offline in the paper: labelling a whole dialogue at once makes real-time KT "impossible" without per-turn labelling [Scarlatos §4.1]. | LLM labels; a learned or statistical model computes mastery. Hooshyar et al. argue the KT model should be "an authoritative source of mastery evidence" that the LLM is conditioned on [Hooshyar §5]. | Not applicable (no enforcement). | Scarlatos et al.; Huang et al.; Hooshyar et al. |

Further facts that bear on the catalogue:

- **Off-the-shelf classifier guards (LlamaGuard) only flag and block.** ReGuard trains a LlamaGuard-equivalent monitor for its driving domain. It has the lowest failure rate, but only because it "cheat[s] by shutting off the simulation before failure occurs", and its success rate is no higher than the base model's [ReGuard §6.2, Fig. 4].
- **AgentSpec contrasts itself with other guard styles.** NeMo Guardrails puts natural-language constraints at the dialogue level; GuardAgent relies on LLMs to interpret and apply rules. AgentSpec instead claims that "external, developer-defined enforcement" separates reasoning from enforcement and "improves verifiability" [AgentSpec §6.1].
- **AgentSpec has no look-ahead.** It enforces at discrete checkpoints and "lacks support for trajectory-based safety analysis". The authors name learning a DTMC as future work [AgentSpec §6.3]; that is what ProbGuard (same authors) then does.

## Evaluation metrics by paper

| Paper | Metric (as defined by the paper) | Setting | Headline result |
|---|---|---|---|
| AgentSpec | Per risk category: risky interpreter calls (#inv), rule violations caught (#vio), and items let through on user inspection (#pass) [Table 3] | RedCode-Exec code agent, 25 categories × 30 prompts | Intercepted risks in "over 90%" of cases [§1] |
| | % of hazardous instructions fulfilled, with vs. without AgentSpec; % of safe tasks completed [Table 4] | SafeAgentBench embodied agent | Hazards 0% with AgentSpec in all 10 unsafe categories; safe-task completion 58.62% → 54.26% |
| | % of runs complying with traffic law [Table 5] | Apollo / FixDrive driving scenarios | 100% |
| | Rules written by an LLM (o1): enforcement rate, precision and recall [Table 6, §5.3] | Same three domains | 87.26% (code); 95.56% precision and 70.96% recall (embodied); 5 of 8 scenarios (driving) |
| | Overhead [§5.5] | — | Parsing 1.42 ms; predicate evaluation 2.83 ms (code) and 1.11 ms (embodied) |
| RefineAct | ToolEmu *Safety Score* (0–3), *Failure Incidence* (%), *Helpfulness* (0–3). All three are scored by an LLM evaluator (GPT-4o) [§6.1–6.2] | 144 ToolEmu tasks, 36 toolkits | Failure incidence 77% → 39%; safety score 0.8 → 2.0; helpfulness 1.0 → 1.9 [Table 2] |
| | How often each verifier decision occurs; retry success rate [Tables 4–5] | 1,081 proposed actions | 50.7% approved, 27.0% revision required, 21.4% approved with constraints, 0.9% rejected; 68% of revisions succeeded (95% Development, 51% IoT) |
| | Latency [§6.4] | — | +20.1 s per task (+59.6%) |
| ProbGuard | *Advance Warning Time* = time of violation − time of the first prediction below θ; detection rate; false-positive rate on safe traces [§5.2, Table 1] | Apollo driving, 4 laws | Warnings up to 15.84 s with 0% false positives at θ = 0.3, and up to 38.66 s at θ = 0.7. False positives rise to 75% at θ = 0.5 and 100% at θ = 0.7. 100% detection |
| | *Unsafe %* vs. *Completion %* [Table 2] | SafeAgentBench, GPT-4o-mini ReAct agent | No monitor: 40.63% / 59.38%. stop at θ = 0.9: 2.60% / 10.42%. reflect at θ = 0.9: 14.07% / 47.74% |
| | Token use vs. AgentSpec; overhead; PAC sample bound [§6.2, Table 3] | — | 12.05% fewer tokens; under 50 ms at 32 states with caching; 185–1,016 traces needed for the run-time PAC bound, but **experiments used 30 traces per scenario** [§5.2, §7] |
| ReGuard | Success rate, failure rate, *Value F1* (monitor against a privileged monitor), monitor true-positive/true-negative rates, *conservativeness* (false-negative rate) [§6.1.1, Table 1] | Agentic driving | ReGuard: 77.3% success, 18.8% failure, Value F1 0.99. Zero-shot GPT-5 and GPT-4o as monitors: Value F1 0.29 |
| | Share of runs under budget [Table 2] | WebArena-style shopping | ReGuard 87.5% = GPT-4o 87.5%; Llama-3.1-8B 62.5% |
| | *Rollout F1*, *intervention rate* [§6.2, Fig. 4; Tables 3–4] | Shielding 1B/3B/8B agents; "backseat driver" advice | Shielded Llama-3.1-8B (no persona): success 44.9% → 64.2%, intervening on 62.1% of steps |
| MaskingAgent | "Experiments and instructor evaluations" [abstract]. **UNVERIFIED**: the exact metrics and numbers | Python programming course | "Effectively prevents solution leakage while preserving the pedagogical benefits" [abstract] |
| VERITAS | *Reliability Rate* = correct answers + graceful failures [abstract]. **UNVERIFIED**: any other metrics | 244 real exam questions, 3 university courses, 5 LLMs | 94.67% for the best models [abstract] |
| Looi et al. | Interactional consistency, premature answer-giving, early closure, cognitive engagement [abstract]. **UNVERIFIED**: how each was measured | Simulated persona dialogues, then a classroom pilot with 40 Grade 5 students | "Improves interactional consistency, reduces premature answer-giving and early closure" [abstract] |
| Yasir et al. | Pre/Post accuracy of the *simulated LLM student* (share of next steps that are optimal according to the knowledge graph); "learning gain" Δ = Post − Pre; Tutor rule accuracy; mean complexity of improved items; *Unique Improvement Count* (cases where only the Judge pipeline succeeds) [§5.1] | 516 proof states, 7 LLMs, 10,836 dialogues | The Judge helps when the Tutor's rule accuracy is below 70%, and costs 4–6 pp against the Teacher pipeline when it is above 85% [Table 2, §7] |
| | Human expert ratings of the feedback: *Mistake Identification, Correctness, **Answer Revelation**, Actionability* (Krippendorff's α ≥ 0.65) [§5.1, §6.4] | 10 responses per model | The Teacher pipeline (full solution access) scores highest on Answer Revelation; automated accuracy "overestimate[s] feedback quality" [§6.4] |
| Cohn et al. (Copa) | Spearman ρ between task mastery and: how often each dialogue policy is chosen; verbalised-understanding success rate; share of agent-support requests ("reliance"); a confidence proxy [§6.1–6.4] | 33 high-school dyads, 6 weeks, correlational | PROBE ρ = −0.34; understanding ρ = 0.40; reliance ρ = −0.26; confidence ρ = 0.40 |
| | Traceability of the evidence → decision → feedback chain: keyword recall and SBERT similarity, each against a shuffled baseline [Table 3] | Agent reasoning logs | 0.43 vs 0.21; 0.64 vs 0.39; 0.48 vs 0.24 (all p < 0.001) |
| | Hake normalised gain (two case-study dyads); Likert survey [§6.6–6.7] | — | 0.523 vs 0.450; "Copa understood what I was doing" scored 2.69/5 |
| IntelliCode | Mastery gain, ECE, success rate, learning velocity, topics covered [§4, Table 2] | 10 *simulated* learners over 14 days, compared with a stateless baseline | Mastery gain 3.42% vs 0.54%; ECE 0.043 vs 0.286; success rate 89.1% vs 52.4% |
| | Planned online metrics: hint acceptance ≥ 70%; "verification that the system never discloses full solutions" [§4] | — | **No results reported** |
| Scarlatos et al. | Accuracy, AUC and F1 for predicting whether the next student turn is correct [§5.3]; human rating of GPT-4o's labels [§7.1, Table 4] | CoMTA (153 dialogues), MathDial (2,823 dialogues) | LLMKT AUC 65.79 (CoMTA) and 76.71 (MathDial). Label quality: correctness 0.93/1 (α 0.18), KCs 3.28/4 (α 0.44) |
| Huang et al. | AUC and accuracy; Pearson r between predicted and empirical KC difficulty [Table 1, §5.2] | QATD2k, MathDial | AUC 65.25 and 76.59 (+0.36 and +0.60 over LLMKT); r = 0.368 |
| Hooshyar et al. | AUC, accuracy, precision, recall, F1; error rates in the early, middle and late parts of a sequence; *volatility* (mean absolute change in mastery); *inconsistency* (share of mastery updates moving in the wrong direction); compute cost [§3.3, Tables 3–6] | ASSISTments 2009–10 data, DKT vs Llama-3-8B | AUC: DKT 0.83, fine-tuned LLM 0.77, zero-shot LLM 0.69. Inconsistency: 0.4061, 0.4525 and 0.5012 respectively. Fine-tuning took about 198 GPU hours |

## Fit with the project's "only code decides" rule

`CONTEXT.md` defines the Verification middleware as "the deterministic component that makes the final allow/deny decision … LLMs may supply its inputs but never make the decision". Measured against that definition:

| Pattern | Fits? | Why (facts) |
|---|---|---|
| G1 AgentSpec predicates (`stop`, `user_inspection`, `invoke_action`) | **Fits** | The predicates are Boolean code, and rules are "declarative and externalized from the LLM" [AgentSpec §6.2]. If an LLM writes a predicate, it is still code, generated "for user review and approval" [§1, §4]. |
| G1 enforcement `llm_self_examine` | **Partial** | Code decides *that* a rule was violated, but the replacement action comes from an LLM [Def. 3.2(4)]. The paper does not say whether that replacement is checked again. |
| G2 RefineAct Prolog verifier | **Fits at run time, with caveats** | Prolog decides on each action. But (a) an LLM writes the spec, which *is* the Guard; the authors list the "faithfulness of the LLM-generated Prolog specifications" as the main threat to internal validity [§7]. (b) It **fails open**: after three failed retries a non-final action executes anyway [§4.4]. |
| G3 ProbGuard (`stop`) | **Fits** | PRISM and a threshold make the decision; the abstraction is about 200–250 lines of Python per domain [§4]. Its guarantees depend on the Markov assumption and on how good the abstraction is [§7]. |
| G3 ProbGuard (`reflect`) | **Does not fit as an allow/deny decision** | Code detects the risk, but the alert is advisory and the LLM decides whether to act on it [§4]. |
| G4 ReGuard | **Does not fit** | The monitor and the fallback are both a fine-tuned LLM [§5]. |
| G5 MaskingAgent execution check | **Probably fits (UNVERIFIED)** | Running the code is deterministic [abstract]. It only applies to executable code, and how "correct solution" is decided is not stated in the abstract. |
| G6 LLM judge or verifier (Yasir, VERITAS) | **Does not fit** | An LLM makes the call [Yasir §4.4; VERITAS abstract]. Yasir's knowledge-graph classifier *is* deterministic code, but it is used for offline evaluation and as context for the Judge, not as the run-time decider [§3.3, §4.4]. |
| G7 Looi three-layer pipeline | **Unknown (UNVERIFIED)** | The abstract says "rule-guided"; whether code or an LLM does diagnosis and intent selection needs the full text. |
| G8 Copa dialogue-policy choice | **Does not fit** | GPT-5 picks the policy [§4]. The rubric-based task-mastery score is computed from logs and could serve as a code input [§4], but the learner-state and strategy labels come from LLMs. |
| G9 IntelliCode orchestrator and curator | **Fits** for state updates and prerequisite rules | Schema validation, rejection and logging are done by code [§2.1]; the Profiler and Curator are deterministic [§3.1]. Non-disclosure in hints is prompt-only, so that part does not fit. |
| G10 LLM labels → KT model | **Fits the "LLM supplies inputs" clause** | The LLM only labels correctness and KCs; a separate model computes mastery [Scarlatos §3–4]. Hooshyar et al. give evidence that the LLM itself is a worse learner model [Tables 3, 5]. |

Facts from the papers that bear on this rule (no design conclusions drawn):

- **LLMs as monitors.** Zero-shot GPT-5 (minimal thinking) and GPT-4o reached a Value F1 of 0.29 as safety monitors. GPT-5 also had a false-negative ("conservativeness") rate of 0.94 [ReGuard Table 1].
- **Verifier side effects.** An LLM verifier "cannot undo premature revelation once disclosed". It also degrades already-reliable feedback through "over-specification" [Yasir §6.3–6.4].
- **Gaps in LLM-written rules.** Generated rules overfit to their examples, e.g. only flagging the exact files listed. Embodied-agent recall was 70.96% [AgentSpec §5.3].
- **Refusal has costs.** Refusal "is not always a safe choice" in agentic settings [ReGuard abstract]. In tutoring, students who always got probes instead of answers became frustrated: "all COPA did was ask us questions" [Copa §6.7].

## Open uncertainties

1. **Three papers are abstract-only.** MaskingAgent (ACM), VERITAS (ACM) and Looi et al. (Elsevier) are all listed as open access, but the publisher sites returned HTTP 403 to automated requests. Unknown for each:
   - MaskingAgent: how correctness is judged, what gets masked, and the leak or quality metrics.
   - VERITAS: the verification agent's criteria, how confidence is computed and what threshold triggers refusal, and how the refinement loop stops.
   - Looi et al.: whether diagnosis and intent selection are code or LLM, and how "premature answer-giving" was measured.
   - The team note's claim that the Looi pilot showed "arithmetic disagreements" is also unverified here.
2. **Hooshyar et al.:** I read the arXiv preprint. The IEEE published version ("Why Large Language Models Alone Fall Short… A Case Study") has a different title, and its numbers were not checked.
3. **AgentSpec:** I read arXiv v3 (July 2025). The ICSE '26 camera-ready (pp. 2938–2950) may differ.
4. **Yasir et al.'s headline numbers don't reconcile cleanly.** My arithmetic from Table 2:
   - "+35pp" (§6.3) is said to be the average for four named models (GPT-4.1, GPT-o3, Mistral, LLaMA). For those four, Judge vs. Pre ≈ +39.7pp, Judge vs. Tutor ≈ +23.2pp and Judge vs. Teacher ≈ +12.0pp. Judge vs. Pre gives ≈ +35.9pp only if Qwen is added.
   - "+10–14pp" (§7) matches Judge vs. Teacher for GPT-4.1, GPT-o3 and Mistral, but LLaMA's gain is only about +5pp.
   - "−4 to −6pp" is Judge vs. Teacher for Gemini and DeepSeek.
   - Qwen (70.2% rule accuracy) falls between the paper's "<70%" and ">85%" groups.
   - All "learning gains" are for **LLM-simulated students**. Code and data are "released upon publication".
5. **RefineAct reports its models inconsistently.** §5 says o1 executes the agent; §6.2 says both arms use "GPT-4o-mini for agents". Its safety and helpfulness scores come from ToolEmu's LLM evaluator, not from human or deterministic labels.
6. **ProbGuard's PAC guarantee was not met in its own experiments** (30 traces per scenario, against a requirement of 185–1,016) [§7].
7. **IntelliCode reuses the same numbers.** "Success rate 89.1% vs 52.4%" is reported both as adaptive vs. baseline (Table 2) and as with vs. without hints (§4.1). The safety metric "never discloses full solutions" is listed with no result.
8. **No paper in this set evaluates a deterministic answer-leak Guard together with real learner outcomes.** Copa (n = 33 dyads) is correlational with no control group [§5]. Looi's pilot has no controlled comparison (per the team notes; not verified). IntelliCode and Yasir use simulated learners. The four SE papers (AgentSpec, RefineAct, ProbGuard, ReGuard) are not about education at all.
9. **None of the tutoring papers uses a trajectory-level Guard** (ProbGuard-style look-ahead over a session, e.g. repeated answer-seeking). Whether such Guards transfer to dialogue is untested in this set.

## Sources

- Wang, H., Poskitt, C. M., & Sun, J. (2026). *AgentSpec: Customizable runtime enforcement for safe and reliable LLM agents.* ICSE '26, pp. 2938–2950. doi:10.1145/3744916.3764546. Read: [arXiv 2503.18666v3](https://arxiv.org/abs/2503.18666). Code: [haoyuwang99/AgentSpec](https://github.com/haoyuwang99/AgentSpec).
- Batole, F., Khomh, F., & Rajan, H. (2026). *RefineAct: Automatic runtime verification of LLM agent actions.* ASE '26. doi:10.1145/3832783.3834409. Read: [lab-design.github.io/papers/ASE-26/ase26.pdf](https://lab-design.github.io/papers/ASE-26/ase26.pdf). Code: [fraolBatole/RefineAct](https://github.com/fraolBatole/RefineAct) (now redirects to `v-fraolbatole/RefineAct`).
- Wang, H., Poskitt, C. M., Wei, J., & Sun, J. (2026). *ProbGuard: Proactive runtime monitoring for LLM agent safety via probabilistic prediction.* ASE '26. doi:10.1145/3832783.3837413. Read: [cposkitt.github.io/…/probguard_proactive_enforcement_ase26.pdf](https://cposkitt.github.io/files/publications/probguard_proactive_enforcement_ase26.pdf). Earlier preprint: [arXiv 2508.00500](https://arxiv.org/abs/2508.00500). Code: [haoyuwang99/ProbGuard](https://github.com/haoyuwang99/ProbGuard).
- Pandya, R., Bland, M., Nguyen, D. P., Liu, C., Fisac, J. F., & Bajcsy, A. (2026). *From refusal to recovery: A control-theoretic approach to generative AI guardrails* (ReGuard). IASEAI '26. Read: [ojs.aaai.org/index.php/IASEAI/article/view/43048](https://ojs.aaai.org/index.php/IASEAI/article/view/43048). Preprint: [arXiv 2510.13727](https://arxiv.org/abs/2510.13727).
- Baek, J., Yamazaki, T., Morihata, A., Mori, J., Yamakata, Y., Taura, K., & Chiba, S. (2026). *MaskingAgent: Preventing LLM tutor from providing full solutions in Python programming courses.* SIGCSE TS 2026 V.2, pp. 1227–1228. doi:[10.1145/3770761.3777255](https://doi.org/10.1145/3770761.3777255). Abstract from the [SIGCSE 2026 programme page](https://sigcse2026.sigcse.org/details/sigcse-ts-2026-posters/89/MaskingAgent-Preventing-LLM-Tutor-from-Providing-Full-Solutions-in-Python-Programmin) and Semantic Scholar.
- Victorio, L. S., Viçoso de Araujo, A., Borges, V. A., Turine, M. A. S., & Nogueira, B. M. (2026). *VERITAS: A multi-agent verification-based framework for reliable intelligent tutoring systems.* SAC '26, pp. 103–110. doi:[10.1145/3748522.3779997](https://doi.org/10.1145/3748522.3779997). Abstract from Semantic Scholar.
- Looi, C.-K., Liu, Z., & Sun, D. (2026). *Taming the black box: Design principles for rule-integrated LLM tutoring systems in primary school mathematical problem solving.* Computers and Education: AI, 10, 100586. doi:[10.1016/j.caeai.2026.100586](https://doi.org/10.1016/j.caeai.2026.100586). Abstract from the [EdUHK repository](https://repository.eduhk.hk/en/publications/taming-the-black-box-design-principles-for-rule-integrated-llm-tu/).
- Cohn, C., Rayala, S., Guo, S., Wang, H. D., et al. (2026). *A theory-guided LLM pedagogical agent for STEM+C scaffolding without over-reliance.* Read: [arXiv 2605.30539v1](https://arxiv.org/abs/2605.30539). Supplementary material: [claytoncohn/CE26_Supplementary_Materials](https://github.com/claytoncohn/CE26_Supplementary_Materials).
- Yasir, T., Tithi, S. D., Tabarsi, B., Droujkov, D., et al. (2026). *When verification hurts: Asymmetric effects of multi-agent feedback in logic proof tutoring.* Read: [arXiv 2603.27076v1](https://arxiv.org/abs/2603.27076).
- David, J., & Ghosh, S. (2026). *IntelliCode: A multi-agent LLM tutoring system with centralized learner modeling.* EACL 2026 System Demonstrations, pp. 129–138. Read: [aclanthology.org/2026.eacl-demo.10](https://aclanthology.org/2026.eacl-demo.10/). Code: [Redomic/intellicode-backend](https://github.com/Redomic/intellicode-backend).
- Scarlatos, A., Baker, R. S., & Lan, A. (2025). *Exploring knowledge tracing in tutor-student dialogues using LLMs.* LAK '25. doi:10.1145/3706468.3706501. Read: [arXiv 2409.16490v2](https://arxiv.org/abs/2409.16490). Code: [umass-ml4ed/dialogue-kt](https://github.com/umass-ml4ed/dialogue-kt).
- Huang, S., Scarlatos, A., Lee, J., & Lan, A. (2026). *Interpretable difficulty-aware knowledge tracing in tutor-student dialogues.* Read: [arXiv 2605.01097v1](https://arxiv.org/abs/2605.01097).
- Hooshyar, D., Yang, Y., Šír, G., Kärkkäinen, T., Hämäläinen, R., Cukurova, M., & Azevedo, R. (2025). *Problems with large language models for learner modelling: Why LLMs alone fall short for responsible tutoring in K–12 education.* Read: [arXiv 2512.23036v1](https://arxiv.org/abs/2512.23036). Published as *Why large language models alone fall short for responsible learner modelling in K–12 tutoring: A case study*, IEEE ([ieeexplore 11554315](https://ieeexplore.ieee.org/abstract/document/11554315/)); not read.
