# Verifiable Co-Learner Agent

A web-based co-learner for first-year students learning Python, where a teacher agent and a deskmate agent help the student learn deeper, not just faster, and a deterministic VerifyShield rules on every agent move before the student sees it.

## Language

### People and agents

**Student**:
The first-year learner, with no programming background, who uses the app. The only primary user.
_Avoid_: user, learner

**Teacher agent**:
The co-learner agent that knows the full content of the current module; the only agent allowed to teach, correct, or suggest moving the student to another module. The student may also choose any unlocked module themselves.
_Avoid_: tutor, assistant, bot, instructor

**Deskmate agent**:
The co-learner agent working at roughly the student's level, which learns alongside them and may only ask peer questions or share confusion.
_Avoid_: companion, buddy, second tutor

**Co-learner agent**:
The whole product as the student experiences it: the teacher agent and the deskmate agent operating inside the VerifyShield.

**Product owner**:
The person who reviews what the VerifyShield decided, switches it on or off, and chooses the language model. Sees decisions and settings, never a student's code.
_Avoid_: admin, lecturer, assessor

### Course

**Module**:
One unit of the course that a student masters, such as Module 5: Loops. It has one mastery and its own conversation. Internal design documents call the same thing an *item*. The numbered system components (M1 to M7) are never written "Module N".
_Avoid_: topic, lesson, unit, node

**Part**:
A named group of consecutive modules on the course roadmap, such as Part 2: Control Flow. A part has no mastery of its own.
_Avoid_: section, chapter, module

**Exercise**:
A practice task belonging to one module, checked by automatic tests.
_Avoid_: problem, task, assignment

**Test**:
One automatic check of an exercise, comparing what the student's code returns for a given input with the expected value.
_Avoid_: assertion, test case

**Misconception**:
A specific wrong idea that explains a student's mistake, such as setting a running total back to zero inside the loop. Only the teacher agent names or corrects one to the student.
_Avoid_: bug, error, mistake

**Course roadmap**:
The picture of the course that shows every module, grouped into parts, as mastered, open, or closed, with the student's mastery beside it and the reason a closed module is closed. A module with no content yet stays closed as not available.
_Avoid_: knowledge map, skill tree, course map, progress map

**Unlocked module**:
A module that is open or mastered. Module 1 is unlocked from the start; each later module unlocks when the one before it is mastered, and stays unlocked even if mastery later falls.
_Avoid_: available, accessible

**Out of course**:
Anything the student asks about that is not part of any module, such as classes or pandas, including small talk. Treated like a question about a closed module: the teacher agent redirects instead of answering.
_Avoid_: off-topic, irrelevant

**Roadmap arrangement**:
Where the student has placed each module on the course roadmap in the Roadmap layout. Personal to the student and their device; it is neither evidence nor part of the resume point, and it never changes a module's state or the current module.
_Avoid_: map arrangement, layout, positions

### Workspace

**Workspace layout**:
How the course roadmap, working area and conversation are arranged on screen. There are two, chosen by the student: the Study layout (the course roadmap as a list beside the working area and conversation) and the Roadmap layout (the course roadmap as a canvas with the working area and conversation over it). Switching layouts changes nothing but the arrangement on screen.
_Avoid_: screen, view, variant, Map canvas

**Conversation**:
The exchange between the student and both agents about one module. Each module has its own conversation; moving to another exercise in the same module continues it.
_Avoid_: chat, thread, session

**Portrait**:
The fixed picture that stands for the teacher agent, the deskmate agent, or the student beside their messages in a conversation. Every student sees the same three portraits; a student does not choose their own.
_Avoid_: avatar, profile picture, icon

**Working area**:
The panel that shows either the current module's materials (Learn mode) or the current exercise, editor and test results (Practice mode).

**Run**:
Executing the student's code in the editor to see its output. A run is not an attempt and produces no evidence.
_Avoid_: execute, test

**Submission**:
The student's code sent to be checked against the exercise's tests. The only action that counts as an attempt and produces evidence.
_Avoid_: run, check, upload

**Attempt**:
One submission on an exercise.

**Evidence**:
A recorded fact about what the student did, produced from a submission by the test runner or the constraint checker. Reading materials and running code produce none.

**Draft**:
The code currently in the student's editor that has not been submitted. Kept on the student's device only; it is neither evidence nor part of the resume point.
_Avoid_: save, autosave

### Standing

**Resume point**:
What a student gets back on signing in again: the module and exercise they were on, and that module's conversation.
_Avoid_: progress, session, save state

**Progress**:
The student's record over time: exercises completed and attempts needed to pass them.
_Avoid_: resume point, mastery

**Mastery**:
The system's estimate, between 0 and 1, of how well a student knows a module, computed from evidence alone; a module counts as mastered once its mastery reaches the threshold.
_Avoid_: progress, score, level, SM

### VerifyShield

**Turn**:
One student message together with the agent messages that answer it.

**Move**:
A typed pedagogical action an agent proposes from a closed set; the agent writes text only for a move that has been approved.
_Avoid_: action, intent, response

**VerifyShield**:
The deterministic envelope that rules on every proposed move (allow, block, or downgrade) and checks every rendered text before the student sees it. It can be switched off for every student at once to show the behaviour without it; it is on unless switched off.
_Avoid_: shield, guard, filter, harness

**Redirect**:
The move the VerifyShield puts in place of a teacher move about a closed module or something out of course: the teacher names where that belongs and brings the student back to the current module.
_Avoid_: refusal, decline

**Decision log**:
The record of every verdict the VerifyShield reached, with what it was proposed, what it knew, and whether it was switched on. It records the system, never the student's work.
_Avoid_: audit log, history, evidence

**VerifyShield trace**:
A panel, off by default, that shows the raw verdict for each turn, meant for assessors rather than students.
_Avoid_: shield trace
