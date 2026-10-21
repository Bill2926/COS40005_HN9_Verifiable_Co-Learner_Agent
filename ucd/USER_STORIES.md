# User Stories — Intro to Programming (Python) Learning System

**Primary persona:** a first-year student with **no prior programming knowledge**.
She has never installed a compiler and does not yet know what a variable or a loop is.

**Agent model:** three agents — the student (human), the **companion agent** (same
competence level as the student, may be wrong), and the **teacher agent** (complete and
correct, intervenes rarely). Both agents draw on the same knowledge base; the companion
sees a restricted view of it.

---

### US1 · Start without installing anything — `UC1`
**As a** student who has never programmed,
**I want** to start writing code right after signing in,
**so that** I am not blocked by setup before I have learned anything.

- Everything runs in the browser; no step asks me to install software.
- I reach a runnable editor in ≤ 3 clicks.

---

### US2 · Plan before coding — `UC2`
**As a** student who does not know how to begin,
**I want** to agree on an approach in plain language before writing code,
**so that** I start with a plan instead of a blank editor.

- When I ask how to start, the companion replies with a plan in plain language and **no code**.
- The plan is phrased as a suggestion I can challenge, not an instruction.

---

### US3 · Decide, and be taken seriously — `UC3`
**As a** student,
**I want** to reject the companion's idea and have mine used instead,
**so that** I stay the decision-maker.

- If I disagree, the companion acknowledges my alternative and does not re-assert its own more than once.
- The recorded decision is mine.

---

### US4 · Have my plan tried even when it is wrong — `UC4`
**As a** student,
**I want** my chosen approach to actually be run,
**so that** I discover the problem from the result rather than from a correction.

- An incorrect plan is implemented and executed without pre-emptive correction.
- When it fails, the conversation turns to the observed failure, not to "I told you so".

---

### US5 · Understand what went wrong — `UC5`
**As a** student who finds error messages frightening,
**I want** results and errors shown in plain language first,
**so that** failure feels like information, not punishment.

- A failed test names the input, the expected value and the produced value.
- A runtime error opens with a plain-language sentence; the raw traceback is behind a "show full error" link.

---

### US6 · Debug together instead of being handed a fix — `UC6`
**As a** student facing a failing test,
**I want** to narrow the cause through questions,
**so that** I learn a debugging procedure I can reuse.

- The first response to "help" is a question or an observation about the output, not a corrected line of code.
- Each turn eliminates one hypothesis and names what we now know.

---

### US7 · Get unstuck without getting the answer — `UC7`
**As a** stuck student,
**I want** graduated hints,
**so that** I can move forward while still doing the work.

- The first hint points at the area and shows no code; each further request escalates one labelled level.
- The full solution is never volunteered unless the teacher agent is triggered (US10).

---

### US8 · Be rescued when the two of us get nowhere — `UC10`
**As a** student stuck together with my companion,
**I want** a teacher to step in and settle the question,
**so that** we do not stay lost in a wrong direction indefinitely.

- The teacher intervenes automatically after N consecutive failed rounds, or immediately when I ask to be told.
- An intervention is visibly marked as coming from the teacher, not the companion.
- After the explanation, control returns to the companion and the peer dialogue resumes.

---

### US9 · See that I am improving — `UC8`
**As a** student who doubts she can code,
**I want** visible evidence of progress,
**so that** I stay motivated through the early weeks.

- I can see exercises completed, concepts covered, and attempts-to-pass over time.
- No comparison against other students is shown.

---

### US10 · Add an exercise — `UC9`
**As an** instructor,
**I want** to author a problem with test cases through a form,
**so that** I can extend the exercise bank without touching the codebase.

- The exercise is validated against the reference solution before publishing.

---

### US11 · Tune when the teacher steps in — `UC10`
**As an** instructor,
**I want** to configure the intervention threshold N,
**so that** the teacher matches how much struggle my course intends.

- Changing N applies to all new sessions in that course.
- The default is documented and used when I change nothing.

---

## Notes for the report

- **US4 is the behavioural keystone.** Executing the student's plan even when it is
  wrong is what distinguishes this system from a conventional help tool, and it is the
  requirement most likely to be silently violated at implementation time.
- **US8 is the pressure valve that protects US4.** Without a separate teacher, the only
  escape from a dead end is the companion stepping out of role to explain — which makes
  the correct behaviour and the failure mode indistinguishable. Keeping the teacher as a
  distinct agent means teaching turns are attributable, so they can be excluded from the
  companion's drift measurement rather than contaminating it.