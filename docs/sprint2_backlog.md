# Sprint 2 backlog (proposal)

Window: 16 Nov – 6 Dec 2026. Status: proposal for sprint planning, not yet in Jira.

## Goal

The agents notice what a student is doing and act on it, ground their help in the course material, and
every action they take is ruled on by VerifyShield and logged. Student code runs in a server-side sandbox,
and the app is live on a public test domain.

Sprint 1 built the vertical slice: sign-in, Python practice, two agents and VerifyShield on every move.
Sprint 2 keeps the same structure (parent items, build sub-tasks, one research card per item) and continues
the numbering from A7.

## Items

| Item | Owner | Stories | Done when |
|---|---|---|---|
| A7 Upgrade from LLM chatbot to an agentic AI system | Doanh, paired with Tuan | CH9VSA-71, -72, -81, -84, -91 | An agent acts without a student message, follows an agreed plan across reloads, and each action has a verdict in the decision log. |
| A8 RAG to ground agent replies in the coursework | Trung | CH9VSA-76, -77 | Replies draw on the current module's material and never on a closed module. |
| A9 Sandboxed Python practice | Tuan | CH9VSA-68, -73 | Forged browser results are rejected, student code cannot reach the network or file system, and errors read plainly. |
| A10 Misconception recognition | Manh | CH9VSA-80, -85 | Each of Modules 1–5 has at least one misconception detected from code and answered specifically. |
| A11 Deploy to a public test domain (no AWS yet) | Manh | CH9VSA-98 (without AWS) | Testers sign in on the public URL with demo accounts and the demo rehearsal passes there. |
| A12 Evaluation and tamper-evident log | Minh | CH9VSA-95, -96 | The benchmark runs with one command, an edited log row is detected, and CI shows no failing tests. |

## Sub-tasks

### A7 Upgrade from LLM chatbot to an agentic AI system

- A7.1 Agents observe events (failed submission, wrong quiz answer, inactivity) and act without waiting for a student message.
- A7.2 Plan before code: agree a plan in plain language, store it per exercise, follow and update it across turns.
- A7.3 The Teacher steps in after N failed rounds; the lecturer sets N.
- A7.4 VerifyShield rules on every agent-initiated action and records it in the decision log.
- A7.5 Least-privilege agent tools: read-only and limited to the current student, every tool call ruled on (review feedback: agent access to the database).
- R13 Research: agent loop design (observe, decide, act) and when to step in versus let the student struggle.

### A8 RAG to ground agent replies in the coursework

- A8.1 Index each module's lesson text, examples and exercises (vector index in Supabase, e.g. pgvector).
- A8.2 Retrieve only from modules the student has open.
- A8.3 Ground Teacher and Mai replies in the retrieved passages.
- A8.4 VerifyShield checks that every retrieved source belongs to an open module.
- R14 Research: chunking, embedding model choice and how to measure retrieval quality.

### A9 Sandboxed Python practice

- A9.1 Server-side sandbox that re-runs the submitted code and tests (carries A5.5 / CH9VSA-128).
- A9.2 Limits on time and memory; no network or file-system access.
- A9.3 Mastery updates only from sandbox-verified results.
- A9.4 Plain-language error messages from the sandbox output, and corrected evidence wording in Practice (carries A4.3 / CH9VSA-122 and A4.4 / CH9VSA-123).
- A9.5 Harmful-code cases (malware through chat or Practice) added to the security tests (review feedback).
- R15 Research: sandbox options (Pyodide on Node, container isolation, gVisor) and browser/server parity (carries R10 / CH9VSA-142).

### A10 Misconception recognition

- A10.1 Misconception catalogue per module in the course spec.
- A10.2 Detect misconceptions from code and test results (AST patterns).
- A10.3 VerifyShield rule: a misconception claim must match detected evidence.
- A10.4 Feedback on how code is built, e.g. `sum(xs)` instead of a loop.
- A10.5 Flag large pastes and sudden complete solutions; the Teacher asks the student to explain the code (review feedback: copy-pasted answers).
- R16 Research: AST-based misconception detection (carries R11 / CH9VSA-143).

### A11 Deploy to a public test domain

- A11.1 Choose a non-AWS host for the Nuxt server and register a test domain.
- A11.2 Production build with secrets kept on the server.
- A11.3 HTTPS and Supabase sign-in redirects for the domain.
- A11.4 Run the demo rehearsal against the public URL.
- A11.5 Per-student message limit before the site goes live (review feedback: chat limit).
- R17 Research: hosting options, cost, and where the A9 sandbox can run.

### A12 Evaluation and tamper-evident log

- A12.1 A 25-prompt shield-on/off benchmark set with fixed proposal fixtures.
- A12.2 Hash chain or database guard on the decision log (carries A6.3 / CH9VSA-131).
- A12.3 Store the course, rule and code versions with each decision.
- A12.4 A Supabase test project so the full test suite passes in CI.
- A12.5 Regression case for the locked-module question the Teacher answered during the 12 Nov demo.
- R18 Research: adversarial prompt coverage and replay determinism (carries R5 / CH9VSA-137 and R12 / CH9VSA-144).

Total: 6 items, 28 build sub-tasks, 6 research cards. The five sub-tasks marked "review feedback" come from the
12 Nov demonstration (Dr. Le Minh Duc, Dr. Nguyen Manh Toan and the other teams); see report section 3.5.

## Order

1. A9 first: agent actions in A7 need results the server can trust.
2. A7 and A8 in parallel once A9.1 is running.
3. A10 after A8.1, since detection reuses the indexed module content.
4. A11 from the middle of the sprint, once A9 has picked a sandbox that the host can run.
5. A12 throughout; the benchmark set should exist before A7 changes agent behaviour.

## Out of scope for Sprint 2

- AWS hosting (future work).
- Full decision replay, the paired benchmark run and the handover: final preparation week, 7–13 Dec.
- Backlog stories not pulled in: CH9VSA-82 guided debugging (first candidate if capacity allows), -83, -87, -88, -89, -92, -93.

## Before planning

- Close or split stories Sprint 1 already meets: CH9VSA-78 (knowledge map), -86 (quizzes, not the end-of-module test), -76 (scope-limited answers; A8 extends it).
- Decide CH9VSA-75: Sprint 1 removed the reveal move, so reword or close it.
- Estimate every item at planning (starting proposal: A7 8, A8 8, A9 8, A10 5, A11 5, A12 8 = 42 points).
- Start the sprint in Jira, and require one non-author approval on every PR.
