# Literature Review: Learning Companion Systems and LLM-Based Agents, 2023–2026

**Compiled:** 15 October 2026
**Window:** January 2023 – October 2026
**Reference style:** IEEE

---

## 0. How to read this document

The review is deliberately **survey-first**. Sections 1–2 give the map: what the
field thinks it is, how it classifies itself, and where the learning-companion
idea sits inside that classification. Only then does Section 3 go system by
system. Read in order the first time; use Section 5 as the working summary.

**On reference reliability.** Every reference carries a marker:

| Marker | Meaning |
|---|---|
| **[V]** | Full metadata verified: authors, title, venue, year, and identifier all confirmed from the publisher or ACL Anthology. Safe to cite as written. |
| **[P]** | Partially verified: title, venue and identifier confirmed, but the author list was not fully recoverable from an authoritative source. **Open the paper and complete the author list before citing.** |

This distinction matters for this project specifically: an author
misattribution has already occurred once in it (*The Competence of Learning
Companion Agents* was wrongly attributed to Chan; it is Hietala & Niemirepo,
1998). Nothing below is cited from memory; anything not confirmed is marked.

---

## 1. The survey layer: how the field maps itself

Four reviews published in the window cover this ground. They disagree about the
unit of analysis, and the disagreement is itself informative.

### 1.1 Task-centric map — Chu et al. [1]

The most-cited general survey. It organises the field by **what the agent does**,
not by what role it plays. Two top-level classes:

- **Teaching Assistance Agents** — classroom simulation, feedback comment
  generation, curriculum design
- **Student Support Agents** — adaptive learning, knowledge tracing, error
  correction and detection

Appendix A adds a parallel axis of domain-specific agents (science, language,
professional development).

**Relevance to this project.** The taxonomy has no slot for a peer. An agent that
works *alongside* a learner at equal competence is neither assisting the teacher
nor supporting the student in the service sense the taxonomy means. The omission
is usable in a motivation paragraph: the dominant task taxonomy of the field does
not represent the role this project builds.

The survey also names overreliance and hallucination as open deployment
challenges, which connects to Section 3.4.

### 1.2 Architectural map — Kong et al. [2]

Reviews LLM-based ITS specifically, through the lens of **classical ITS module
decomposition**: what happens to the domain model, learner model, tutoring model
and interface when LLMs enter.

Two key findings for this project:

1. **A two-category taxonomy: modular vs integrated.** Some systems preserve the
   classical framework, implementing every module via LLM; others take a hybrid
   approach where some modules use LLMs and others use traditional methods.
   There is no "agentic" category. This is the peer-reviewed licence for a hybrid
   LLM–symbolic design, and the reason to avoid "agentic ITS" as a term.
2. **Pedagogical alignment is narrow.** The survey observes that alignment in
   current systems is usually limited to Socratic or scaffolding theory, and
   calls for alignment with a broader spectrum of instructional strategies.
   **Peer learning falls outside both named strategies.** This is the single most
   quotable sentence in the survey layer for this project's motivation.

### 1.3 Design-dimension map — Li and Zheng [3]

A PRISMA-ScR scoping review of 52 studies across five databases, November 2022 to
January 2025. Characterises LLM-based pedagogical agents along four design
dimensions:

- interaction approach: reactive vs proactive
- domain scope: domain-specific vs general-purpose
- **role complexity: single-role vs multi-role**
- system integration: standalone vs integrated

Emerging trends it identifies: multi-agent systems simulating naturalistic
learning environments, **virtual student simulation used for agent evaluation**,
immersive technologies, and learning analytics integration.

**Relevance.** The "role complexity" dimension is the closest any survey comes to
treating agent role as a first-class design variable. The virtual-student-
simulation trend is methodological support for using simulated learners as the
primary evaluation harness.

### 1.4 Two further reviews [4], [5]

- [4] is an IEEE Transactions on Learning Technologies survey of LLM-based agents
  for education. Useful because the target venue list for this project includes
  IEEE outlets, and an IEEE-venue survey is the natural citation for framing.
  **Author list could not be confirmed — see marker.**
- [5] is a systematic review of 88 empirical studies drawn from 3,344
  publications since the release of ChatGPT (Nov 2022–Mar 2025). It finds six
  functional categories of LLM use in education, with intelligent tutoring
  systems the most common. Useful for one sentence establishing that the
  empirical base is tutor-dominated.

### 1.5 What the survey layer collectively establishes

| Claim for the report | Supported by |
|---|---|
| Hybrid LLM–symbolic module design is an accepted architecture, not an improvisation | [2] |
| "Agentic ITS" is not a category in the AIED taxonomy | [2] |
| Pedagogical alignment is narrow; peer learning sits outside the named strategies | [2] |
| The dominant task taxonomy has no peer role | [1] |
| Agent role is recognised as a design dimension but not as a research variable | [3] |
| Simulated learners are an accepted evaluation method | [3] |
| The empirical base is tutor-dominated | [5] |

---

## 2. Reading the surveys against the LCS lineage

The surveys are written as though the field began in 2023. It did not. The
learning companion concept dates to Chan & Baskin (1988), with Integration-Kid
(Chan, 1991) as the first implemented system and the GCM architecture (Chou,
Chan & Lin, 2002) as its module-level formalisation. None of the four surveys
treats LCS as a named lineage.

This produces a specific opportunity and a specific risk.

**Opportunity.** The 2023–2026 work rediscovers LCS ideas without the
vocabulary — "peer agent", "co-learner", "teachable agent", "simulated student"
are all names for what Chou, Chan & Lin called a *non-authoritative pedagogical
agent*. Connecting the two literatures is a genuine contribution of the related-
work section, and it is cheap: it costs one paragraph and two citations.

**Risk.** Reviewers from the LLM-agent community may not know the LCS lineage and
may read the framing as antiquarian. The defence is to use the old work for the
*problem statement* (role, competence, protocol) and the new work for the
*method* (how the role is enforced and measured), rather than treating 1991 as an
authority on 2026 engineering.

---

## 3. Individual systems

Grouped by the function they serve in this project's argument, not by date.

### 3.1 Direct LCS instantiations with LLMs

**Moribe and Ushiama [6] — the closest architectural match.**
An agent-based online peer learning environment composed of a Teacher AI Agent
(TAA), a Learning Companion AI Agent (LCAA) and a User. The design premise is
that effective peer learning requires companions at the same proficiency level,
and that a peer of equal proficiency makes the same mistakes as the learner. The
method extracts a learner's grammatical error profile and re-inserts it into the
companion's generated essays.

This is the **three-agent LCS model rebuilt on LLMs**, in English composition.
Two limits worth stating when citing it: the evaluation checks aggregate error
counts and quality scores rather than whether the specific claimed error *types*
were imitated; and the domain is writing, where errors do not surface by
execution.

**OnlineMate [7].** A multi-agent learning companion system driven by LLMs and
enhanced with Theory of Mind, aimed at the shortage of peer interaction in online
learning. It infers learner cognitive states and simulates peer-like roles.
Companion-shaped, but with no mechanism constraining companion competence.

**Constructively controversial peer agents [8].** Studies collaborative versus
argumentative peer agents and lands between the two. Notable for this project
because the **regulated** peer agent adds a moderator component to the pipeline —
the nearest thing in the peer literature to an external control layer on agent
behaviour.

**Beyond the AI Tutor [9].** Controlled studies of multi-agent LLM learning
environments. Finding: adding LLM peers to a tutor-mediated environment produced
the highest test accuracy among conditions, suggesting peer observation carries
independent learning value even when an expert is present. This is empirical
support for **keeping a teacher agent alongside the companion** rather than
dropping it.

### 3.2 Learner simulation and teachable agents

These are not companions — the agent plays a learner for a different purpose —
but they are where the role-maintenance problem was first reported.

**Rogers et al. [10] — the most important single finding for this project.**
MatlabTutee, an LLM-based teachable agent for learning-by-teaching in university
CS courses, evaluated across four studies including a controlled comparison
against a human expert pretending to be a novice. In the formative study the
authors identify two deficiencies of the LLM relative to the human in the same
role: **difficulty consistently maintaining the novice role**, and **inability to
generate intentionally incorrect statements and code for the student to
correct.**

Those are, respectively, persona drift and the failure of deliberate
sub-optimality — the two behaviours this project's peer model exists to maintain,
observed in the same subject area (university CS) and the same medium (code).
This reference does more work than any other in the review: it establishes the
problem is real, in this domain, with an LLM, against a human baseline.

**MathVC [11].** An LLM-simulated multi-character virtual classroom for
mathematics education, with multiple simulated student characters a human student
practises with. The authors report that when LLM characters were exposed directly
to each other, they **bypassed the earlier stages of the process and jumped
straight to describing a solution** — drift described structurally, and their fix
was to integrate mathematical-modelling and collaborative-problem-solving theory
into the character design.

**EduVerse [12]** names persona drift explicitly as a central challenge in
LLM-driven multi-agent educational environments: role-specific traits weaken or
deviate over extended interaction, motivating role-stabilisation mechanisms.

**Wu et al. [13]** (simulated students at diverse cognitive levels) is the
methodological template for this project's simulated-learner harness.

### 3.3 Control, verification and guards

This is where the supervisor's framing lives, and it is more crowded than it
looks.

**Auditable release control [14] — read first.**
Formalises state- and action-dependent disclosure failure as **pedagogical
leakage** and introduces an authorization-aware complete-mediation boundary. A
single release function applies inspectable checks, optional cumulative
verification, and action-specific fallback; replayable traces separate selection,
generation, verification and enforcement failures. The guard has two modes: a
deterministic checker alone in permissive mode, or a cumulative semantic verifier
added in high-assurance mode.

It explicitly distinguishes itself from generic content moderation: the protected
information is problem-specific, its release depends on learner state and
pedagogical action, and authorization can legitimately change within a dialogue.

**This paper occupies most of the ground a "deterministic verification
middleware with auditable traces" claim would occupy.** Any novelty claim in that
area must be stated as a delta against it.

**TRAVER [15].** A Trace-and-Verify workflow for coding tutor agents combining
explicit knowledge tracing of the student's state with utterance decoding guided
by a verifier model for turn-by-turn verification. Task knowledge is represented
as knowledge components, each either a reference dependency or a solution step,
with per-turn belief estimates. **Knowledge tracing plus per-turn verification
plus programming already exists — for the tutor role.**

**ES-LLMs [16].** Decouples the deterministic pedagogical decision from the LLM's
surface realisation, reporting 100% adherence to pedagogical constraints such as
attempt-before-hint and a 3.3× increase in hint efficiency. Frames the problem
crisply: LLMs solved the fluency problem in educational dialogue but worsened the
control problem, and even optimised monolithic models struggle with negative
constraints such as "do not reveal the answer".

**AutoTutor meets LLMs [17].** Implements a pedagogical goal as a template state
space for a finite state transducer, which the LLM then fills. This is the
clearest published example of the semi-formal approach the supervisor's
description calls for.

**Rule-integrated LLM tutoring [18].** Regulates tutorial dialogue through an
explicit finite-state diagnostic protocol: student state diagnosis → pedagogical
intent selection → utterance generation, inside a fixed per-turn workflow that
separates verification, diagnosis, decision and generation.

**IntelliCode [19].** Centralised versioned learner state integrating mastery
estimates, misconceptions, review schedules and engagement signals, updated by a
Bayesian-Knowledge-Tracing-inspired mechanism, under single-writer
orchestration. The implementation reference for state management.

**Prompt injection defences for educational tutors [20].** Worth one sentence in
motivation for an unusual reason: in educational systems the adversary is
frequently the **user** — the student trying to bypass guided-learning
constraints to extract full solutions, negating the system's pedagogical value.

### 3.4 Persona drift as a named problem

**Prompting against persona drift [21].** Finds that prompt-based interventions
mitigate but do not eliminate persona drift. This is the direct argument for
putting role maintenance in a runtime module rather than in a system prompt — it
is the empirical justification for the C1 → C2 → C3 ablation.

**Nautilus Compass [22].** Black-box persona drift detection running in
user-space hooks, producing a continuous drift score thresholded into bands.
Useful as a measurement precedent.

**Metacognitive laziness [23].** The learning-harm evidence: learners using
generative AI improved task output without corresponding gains in motivation or
knowledge transfer, with the authors naming the offloading of metacognitive load
as the mechanism. This is the citation for *why* shortcut learning matters.

---

## 4. The gap, stated against this literature

Three claims survive contact with the 2023–2026 work.

**4.1 Every published guard protects the tutor role.**
The constraint studied in [14], [16], [17], [18] always has the form "do not
reveal the answer yet" — a restriction on *content*. The constraint this project
needs has the form "do not display competence beyond the declared peer level" —
a restriction on *demonstrated capability*. These are not the same problem: the
second has no fixed forbidden-content set to check against, because the identical
utterance may be compliant or violating depending on the peer model's current
state. No reviewed work enforces a competence ceiling.

**4.2 Knowledge tracing has not been connected to peer-role constraint.**
TRAVER [15] uses KT to help the tutor *target* missing knowledge components. No
reviewed work uses a traced state to *limit* what a companion may display. Yet
this is precisely the mechanism Chan described in 1991 — teacher and companion
sharing one problem solver, differing only in the accessible rule set — and that
Chou, Chan & Lin formalised as the learning companion pattern.

**4.3 The role-maintenance failure is documented but not engineered against.**
Rogers et al. [10] report both failure modes in university CS. MathVC [11] and
EduVerse [12] report drift structurally. [21] shows prompting is insufficient.
Nobody has built a runtime module whose job is to hold the companion at its
declared level, and nobody has measured whether doing so works.

**Statement for the report.** Prior LCS work assumed companion competence was
controllable, because symbolic rule sets do as they are told. With an LLM
companion that assumption fails: the model is too capable by default and drifts
off the assigned level. The peer model must therefore change from a declarative
specification into a runtime mechanism that maintains competence — and whether it
can is an empirical question nobody has answered.

---

## 5. Working summary

| # | Work | Role of agent | Competence controlled? | Runtime enforcement? | Domain |
|---|---|---|---|---|---|
| [6] | Moribe & Ushiama | Companion | Error profile imitation | No | Writing |
| [7] | OnlineMate | Companion | No | No | General |
| [8] | CC peer agents | Peer | No | Moderator component | General |
| [9] | Beyond the AI Tutor | Peer + tutor | No | No | Math, writing |
| [10] | Rogers et al. | Teachable novice | Attempted, **reported to fail** | No | University CS |
| [11] | MathVC | Simulated peers | Via theory-informed design | No | Math |
| [12] | EduVerse | Simulated students | Role stabilisation discussed | No | Classroom sim |
| [14] | Auditable release control | Tutor | n/a | **Yes — two-mode guard** | Physics-style |
| [15] | TRAVER | Tutor | n/a | **Yes — turn verifier + KT** | Coding |
| [16] | ES-LLMs | Tutor | n/a | **Yes — deterministic decision** | Tutoring |
| [17] | AutoTutor+LLM | Tutor | n/a | **Yes — FST** | Math word problems |
| [18] | Rule-integrated | Tutor | n/a | **Yes — FSM protocol** | Primary math |
| [19] | IntelliCode | Tutor | n/a | Single-writer state | DSA |
| — | **This project** | **Companion** | **Yes — peer model** | **Yes** | **Intro programming** |

The bottom row is empty everywhere else in the table. That emptiness is the
contribution.

---

## 6. Reading order

1. [10] Rogers et al. — the problem, in this domain, with a human baseline
2. [14] Auditable release control — the nearest prior art to the method
3. [15] TRAVER — KT plus verification in programming
4. [16] ES-LLMs — deterministic decision vs LLM realisation
5. [2] Kong et al. — architectural legitimacy and the alignment-is-narrow quote
6. [6] Moribe & Ushiama — the three-agent LCS on LLMs
7. [21] Prompting against persona drift — why prompting alone is not enough
8. [17] AutoTutor+LLM — the semi-formal template

---

## 7. What this review does not cover

Stated so the gaps are deliberate rather than accidental:

- **Pre-2023 LCS work.** Chan & Baskin (1988), Chan (1991), Hietala & Niemirepo
  (1998), Ramirez Uresti & du Boulay (2004), Chou, Chan & Lin (2002, 2003) are
  the foundation layer and are handled in the project's separate LCS notes.
- **Formal methods for LLM agents outside education.** Runtime verification and
  temporal guardrails for general agents are an active area; if the method
  section claims verification properties, that literature needs its own pass.
- **Learning-gain evidence.** Out of scope by project decision; the claim is role
  persistence, not learning outcomes.
- **Commercial systems.** No peer-reviewed metadata available.

---

## References

**[V] = fully verified · [P] = partially verified, complete the author list before citing**

### Surveys and reviews

[1] **[V]** Z. Chu, S. Wang, J. Xie, T. Zhu, Y. Yan, J. Ye, A. Zhong, X. Hu,
J. Liang, P. S. Yu, and Q. Wen, "LLM agents for education: Advances and
applications," in *Findings of the Association for Computational Linguistics:
EMNLP 2025*, Suzhou, China, Nov. 2025, ACL Anthology 2025.findings-emnlp.743.
Also available: arXiv:2503.11733.
*Note: the given name of the sixth author appears as both "Jinheng Ye" and
"Jingheng Ye" across sources; use the ACL Anthology spelling.*

[2] **[P]** Kong, Sun, Zhou, and Ng, "LLM-based intelligent tutoring systems: A
survey," in *Proc. 35th Int. Joint Conf. Artificial Intelligence (IJCAI-26),
Survey Track*, 2026.
*Author initials and page numbers not confirmed from an authoritative source.*

[3] **[P]** S. Li and J. Zheng, "A scoping review of large language model-based
pedagogical agents," preprint, 2026.
*Identifier located only through an aggregator; confirm the arXiv ID and
publication status directly.*

[4] **[P]** "A comprehensive survey on large-language-model-based agents for
education," *IEEE Trans. Learning Technologies*, vol. 18, pp. 898–913, 2025,
doi: 10.1109/TLT.2025.3617909.
*Only one author name (R. Na) was recoverable; retrieve the full list from IEEE
Xplore before citing. Given the project's prior misattribution incident, treat
this one with particular care.*

[5] **[P]** "Large language models in education: A systematic review of empirical
applications, benefits, and challenges," *Computers and Education: Artificial
Intelligence*, 2025.
*Authors not confirmed.*

### Learning companion and peer agents

[6] **[V]** S. Moribe and T. Ushiama, "Imitating mistakes in a learning companion
AI agent for online peer learning," in *Proc. 19th Int. Conf. Ubiquitous
Information Management and Communication (IMCOM)*, IEEE, 2025,
doi: 10.1109/IMCOM64595.2025.10857528. Also available: arXiv:2507.12801.

[7] **[P]** "OnlineMate: An LLM-based multi-agent companion system for cognitive
support in online learning," preprint, 2025, arXiv:2509.14803.

[8] **[P]** "Exploring learners' expectations and engagement when collaborating
with constructively controversial peer agents," preprint, 2026,
arXiv:2601.13479.

[9] **[P]** "Beyond the AI tutor: Social learning with LLM agents," 2026,
arXiv:2604.02677.

### Learner simulation and teachable agents

[10] **[V]** K. Rogers, M. Davis, M. Maharana, P. Etheredge, and S. Chernova,
"Playing dumb to get smart: Creating and evaluating an LLM-based teachable agent
within university computer science classes," in *Proc. 2025 CHI Conf. Human
Factors in Computing Systems (CHI '25)*, pp. 1–22,
doi: 10.1145/3706598.3713644.

[11] **[V]** M. Yue, W. Lyu, W. Mifdal, J. Suh, Y. Zhang, and Z. Yao, "MathVC: An
LLM-simulated multi-character virtual classroom for mathematics education,"
preprint, 2024, arXiv:2404.06711.

[12] **[P]** "EduVerse: A user-defined multi-agent simulation space for education
scenarios," preprint, 2025, arXiv:2510.05650.

[13] **[P]** Wu et al., "Embracing imperfection: Simulating students with diverse
cognitive levels using LLM-based agents," in *Proc. Annual Meeting of the
Association for Computational Linguistics (ACL)*, 2025.
*Carried over from existing project notes; full metadata not independently
confirmed in this pass.*

### Control, verification and guards

[14] **[P]** "Auditable release control for pedagogical leakage in LLM tutors,"
preprint, 2026, arXiv:2608.00515.

[15] **[P]** "Training turn-by-turn verifiers for dialogue tutoring agents: The
curious case of LLMs as your coding tutors," preprint, 2025, arXiv:2502.13311.

[16] **[P]** N. Kadir, "From untamed black box to interpretable pedagogical
orchestration: The ensemble of specialized LLMs architecture for adaptive
tutoring," preprint, 2026, arXiv:2603.23990.

[17] **[P]** "AutoTutor meets large language models: A language model tutor with
rich pedagogy and guardrails," preprint, 2024, arXiv:2402.09216.

[18] **[P]** "Taming the black box: Design principles for rule-integrated LLM
tutoring systems in primary school mathematical problem solving," *Computers and
Education: Artificial Intelligence*, 2026,
doi: 10.1016/j.caeai.2026.100482 — *DOI pattern inferred from the article
identifier; confirm before citing.*

[19] **[P]** "IntelliCode: A multi-agent LLM tutoring system with centralized
learner modeling," in *Proc. 2026 Conf. European Chapter of the Association for
Computational Linguistics: System Demonstrations*, ACL Anthology
2026.eacl-demo.10. Also available: arXiv:2512.18669.

[20] **[P]** A. C. Maiorano, "Evaluating prompt injection defenses for
educational LLM tutors: Security-usability-latency trade-offs," preprint, 2026,
arXiv:2605.06669.

### Persona drift

[21] **[P]** "Prompting against persona drift: Comparing intervention timing and
content in LLM-simulated conversations," preprint, 2026, arXiv:2609.24532.

[22] **[P]** "Nautilus Compass: Black-box persona drift detection for production
LLM agents," preprint, 2026, arXiv:2605.09863.

### Learning harm

[23] **[P]** "Beware of metacognitive laziness: Effects of generative artificial
intelligence on learning motivation, processes, and performance," *British
Journal of Educational Technology*, 2024.
*Venue and authors widely reported secondhand; confirm from the publisher.*