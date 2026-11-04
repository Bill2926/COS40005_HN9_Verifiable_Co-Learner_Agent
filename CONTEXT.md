# Verifiable Co-Learner Agent

A web-based co-learner for first-year students learning Python, where a teacher agent and a deskmate agent help the student learn deeper, not just faster, and a deterministic shield rules on every agent move before the student sees it.

## Language

### People and agents

**Student**:
The first-year learner, with no programming background, who uses the app. The only primary user.
_Avoid_: user, learner

**Teacher agent**:
The co-learner agent that knows the full content of the current topic; the only agent allowed to teach, correct, or move the student between topics.
_Avoid_: tutor, assistant, bot, instructor

**Deskmate agent**:
The co-learner agent working at roughly the student's level, which learns alongside them and may only ask peer questions or share confusion.
_Avoid_: companion, buddy, second tutor

**Co-learner agent**:
The whole product as the student experiences it: the teacher agent and the deskmate agent operating inside the shield.

### Course

**Topic**:
One unit of the course that a student masters, such as `for_loop`. Internal design documents call the same thing an *item*; the two words are interchangeable and nothing else may be called either.
_Avoid_: lesson, module, node

**Exercise**:
A practice task belonging to one topic, checked by automatic tests.
_Avoid_: problem, task, assignment

**Test**:
One automatic check of an exercise, comparing what the student's code returns for a given input with the expected value.
_Avoid_: assertion, test case

**Misconception**:
A specific wrong idea that explains a student's mistake, such as setting a running total back to zero inside the loop. Only the teacher agent names or corrects one to the student.
_Avoid_: bug, error, mistake

**Knowledge map**:
The picture of the course that shows every topic as mastered, open, or closed, with the reason a closed topic is closed.
_Avoid_: skill tree, course map, progress map

### Workspace

**Conversation**:
The exchange between the student and both agents about one topic. Each topic has its own conversation; moving to another exercise in the same topic continues it.
_Avoid_: chat, thread, session

**Working area**:
The panel that shows either the current topic's materials (Learn mode) or the current exercise, editor and test results (Practice mode).

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
What a student gets back on signing in again: the topic and exercise they were on, and that topic's conversation.
_Avoid_: progress, session, save state

**Progress**:
The student's record over time: exercises completed and attempts needed to pass them.
_Avoid_: resume point, mastery

**Mastery**:
The system's estimate of how well a student knows a topic, computed from evidence alone; it decides when a topic counts as mastered.
_Avoid_: progress, score, level

### Shield

**Turn**:
One student message together with the agent messages that answer it.

**Move**:
A typed pedagogical action an agent proposes from a closed set; the agent writes text only for a move that has been approved.
_Avoid_: action, intent, response

**Shield**:
The deterministic envelope that rules on every proposed move (allow, block, or downgrade) and checks every rendered text before the student sees it.
_Avoid_: guard, filter, harness

**Shield trace**:
A panel, off by default, that shows the raw verdict for each turn, meant for assessors rather than students.
