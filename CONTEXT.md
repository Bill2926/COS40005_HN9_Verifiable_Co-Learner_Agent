# Verifiable Co-Learner Agent

A web-based co-learner for first-year students learning Python, where a teacher agent and a deskmate agent help the student learn deeper, not just faster, and a deterministic VerifyShield rules on every agent move before the student sees it.

## Language

### People and agents

**Student**:
The first-year learner, with no programming background, who studies a course in the app. The primary user. A lecturer or the product owner is never a student: they are never enrolled and never see a student's pages.
_Avoid_: user, learner

**Profile**:
A student's own display name and profile picture, which they can change, shown with their student number and campus, which they cannot. Only students have a profile for now.
_Avoid_: account, settings

**Campus**:
The Swinburne campus a student studies at: Hanoi, Da Nang, Ho Chi Minh City or Can Tho. The student chooses it once, the first time they sign in, and must choose one before studying; afterwards only the product owner can change it. Lecturers and the product owner see it beside the student number, and a lecturer can filter enrolled students by it. It changes nothing about the course, the mastery threshold or the agents.
_Avoid_: site, location, branch

**Student number**:
A student's short identifier in the form SWB followed by at least four digits (SWB0001), like a university student ID, given to the student when their account is created and unique across the whole system; a number is never given out twice. Lecturers and the product owner can see it; only the product owner can change it, and each change is recorded. It is how staff tell students apart.
_Avoid_: student id, user id

**Teacher agent**:
The co-learner agent that knows the full content of the current module; the only agent allowed to teach, correct, or suggest moving the student to another module. The student may also choose any unlocked module themselves.
_Avoid_: tutor, assistant, bot, instructor

**Deskmate agent**:
The co-learner agent working at roughly the student's level, which learns alongside them and may only ask peer questions or share confusion. Named Mai to the student. Knows only what the student can see: the exercise, the student's work and the conversation, never the module's hints or misconception responses.
_Avoid_: companion, buddy, second tutor

**Co-learner agent**:
The whole product as the student experiences it: the teacher agent and the deskmate agent operating inside the VerifyShield.

**Product owner**:
The person who reviews what the VerifyShield decided, switches it on or off, and chooses the language model. Also sees every student by name, student number and email, and is the only person who can change a student number or a student's campus. Never sees a student's code, conversation or mastery. Does not manage courses: that is the lecturer.
_Avoid_: admin, assessor

**Lecturer**:
The person who owns a course: edits or imports its course spec, sets its mastery threshold, and sees who is enrolled by name, student number and email. Never sees a student's code, conversation or mastery. Has no say over the VerifyShield or the language model. One person may be both a lecturer and the product owner.
_Avoid_: teacher, instructor, admin, product owner

### Course

**Course**:
A subject taught through Python exercises with automatic tests, such as Introduction to Programming with Python. It is made of parts and modules, is owned by one lecturer, and has its own mastery threshold. A student's mastery, evidence, conversations and resume point all belong to one course.
_Avoid_: subject, class, program

**Enrollment**:
A student's membership of a course. A student studies only the courses they are enrolled in.
_Avoid_: registration, subscription

**Course spec**:
The single file that declares everything a course contains: its parts, modules in order, and each module's materials, quiz, exercises, hint ladder and misconception responses, plus what counts as out of course. A lecturer edits it as a course draft or imports it whole, and it takes effect only when published whole; the course is whatever its published spec says.
_Avoid_: syllabus, course file, curriculum

**Course draft**:
A lecturer's unpublished changes to a course spec, made in the editor or loaded from an imported or exported file. Students never see a draft; publishing it replaces the course spec as one change in the course history.
_Avoid_: unsaved spec, working copy

**Course preview**:
The lecturer's view of a course draft as a student would see it, with exercises they can run and submit and the teacher-only content shown and marked. No agents take part and nothing is recorded.
_Avoid_: test mode, student view

**Materials**:
What a module teaches in Learn mode, as an ordered list of blocks: text, code examples, images and videos. A diagram is an image. Every kind of block is optional.
_Avoid_: content, lesson, notes

**Mastery threshold**:
The mastery a module must reach, together with one passed exercise, to count as mastered. Set by the lecturer for the whole course, the same for every module in it. The only part of the mastery estimate a lecturer can change.
_Avoid_: pass mark, cut-off, BKT threshold

**Course history**:
The record of every change a lecturer made to a course: each course spec published and each change of mastery threshold, with who made it and when. It records the course, never a student or a verdict.
_Avoid_: audit log, decision log, changelog

**Module**:
One unit of the course that a student masters, such as Module 5: Loops. It has one mastery and its own conversation. Internal design documents call the same thing an *item*. The numbered system components (M1 to M7) are never written "Module N". In architecture, "module" is never used for a part of the system: see **Component**.
_Avoid_: topic, lesson, unit, node

**Part**:
A named group of consecutive modules on the course roadmap, such as Part 2: Control Flow. A part has no mastery of its own.
_Avoid_: section, chapter, module

**Exercise**:
A practice task belonging to one module, checked by automatic tests.
_Avoid_: problem, task, assignment

**Quiz**:
The three multiple-choice questions belonging to one module, offered in Learn mode after the materials to check understanding. Each question has four choices and exactly one is correct.
_Avoid_: test, exam, check

**Quiz answer**:
The student's choice on one quiz question, marked right or wrong by the server. The correct choice is never sent to the student's device. A quiz answer is not an attempt.
_Avoid_: response, quiz attempt

**Test**:
One automatic check of an exercise, comparing what the student's code returns for a given input with the expected value.
_Avoid_: assertion, test case

**Misconception**:
A specific wrong idea that explains a student's mistake, such as setting a running total back to zero inside the loop. Only the teacher agent names or corrects one to the student.
_Avoid_: bug, error, mistake

**Hint ladder**:
The three hints of a module, from gentlest (1) to most direct (3). The teacher agent gives one rung at a time, may repeat a rung already given, never skips ahead to a rung beyond the next one, and never goes past rung 3; no rung is the finished solution.
_Avoid_: hint list, hint level

**Course roadmap**:
The picture of the course that shows every module, grouped into parts, as mastered, open, or closed, with the student's mastery beside it and the reason a closed module is closed. A module that its course spec lists without content stays closed as not available.
_Avoid_: knowledge map, skill tree, course map, progress map

**Unlocked module**:
A module that is open or mastered. Module 1 is unlocked from the start; each later module unlocks when the one before it is mastered, and stays unlocked even if mastery later falls or the lecturer raises the mastery threshold.
_Avoid_: available, accessible

**Out of course**:
Anything the student asks about that is not part of any module, such as classes or pandas, including small talk. Treated like a question about a closed module: the teacher agent redirects instead of answering.
_Avoid_: off-topic, irrelevant

**Mindmap**:
The student's personal canvas of a course: every module of the course roadmap, which the student can move but never remove or change, together with the student's own notes and the links they draw. It is neither evidence nor part of the resume point, and it never changes a module's state or the current module.
_Avoid_: roadmap, knowledge map, mind map

**Note**:
A student's own item on their mindmap: natural-language text, an optional image and a colour from a fixed set, which the student can create, change, link to modules or other notes, and delete. A note is always linked to at least one module or other note. The agents never read notes.
_Avoid_: node, card, sticky

**Mindmap arrangement**:
Where the student has placed each module and note on their mindmap. Personal to the student and kept with their account, so it follows them across devices.
_Avoid_: roadmap arrangement, map arrangement, layout, positions

### Workspace

**Workspace layout**:
How the student's screen is arranged. There are two, chosen by the student: the Study layout (the course roadmap as a list beside the working area and conversation) and the Mindmap layout (the mindmap as a canvas beside a panel that holds the chosen note and a link to study the current module, with no working area and no conversation; choosing an unlocked module on the canvas makes it the current module). Switching layouts changes nothing but the arrangement on screen.
_Avoid_: screen, view, variant, Map canvas, Roadmap layout

**Conversation**:
The exchange between the student and both agents about one module. Each module has its own conversation; moving to another exercise in the same module continues it.
_Avoid_: chat, thread, session

**Portrait**:
The picture beside each message in a conversation. The teacher agent and the deskmate agent have fixed portraits, the same for every student; the student's portrait is the profile picture from their profile.
_Avoid_: avatar, icon

**Quote**:
Text the student selects from an agent message or from the materials and places in their message to ask about it. It is part of the student's message, so the turn is ruled like any other.
_Avoid_: selection, citation, reference

**Working area**:
The panel that shows either the current module's materials and quiz (Learn mode) or the current exercise, editor and test results (Practice mode).

**Run**:
Executing the student's code in the editor to see its output. A run is not an attempt and produces no evidence.
_Avoid_: execute, test

**Submission**:
The student's code sent to be checked against the exercise's tests. The only action that counts as an attempt and produces evidence.
_Avoid_: run, check, upload

**Attempt**:
One submission on an exercise.

**Evidence**:
A recorded fact about what the student did, produced from a submission (by the test runner) or from a quiz answer. Reading materials, running code and chatting produce none.

**Activity log**:
The record of what a student did in the app: signing in, opening a module, switching mode or layout, runs, submissions, quiz answers, messages, changes to notes and the mindmap, and changes to their profile. It never holds keystrokes, drafts or the code of a run, and it is never evidence, so it never changes mastery. No screen shows it; students are told it is kept.
_Avoid_: audit log, tracking, telemetry, history

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
The system's estimate, between 0 and 1, of how well a student knows a module, computed from evidence alone, from both submissions and quiz answers; a module counts as mastered once its mastery reaches the threshold and the student has passed at least one of its exercises, so quiz answers alone never master a module.
_Avoid_: progress, score, level, SM

### VerifyShield

**Turn**:
One student message together with the agent messages that answer it.

**Addressed agent**:
The one agent a student names at the start of a message (`@Teacher` or `@Mai`); only that agent answers the turn. A message that names no agent is answered by both, teacher first. Naming an agent never widens what it may do: the deskmate agent still only asks peer questions or shares confusion.
_Avoid_: mention, tag, target

**Deskmate switch**:
The student's own choice to keep the deskmate agent out of their conversations. While it is off the deskmate agent proposes nothing, so nothing of it reaches the decision log, and naming it as the addressed agent has no effect. On unless the student switches it off; it belongs to the student, across courses and devices. It is not the VerifyShield, which only the product owner switches.
_Avoid_: Mai toggle, mute

**Move**:
A typed pedagogical action an agent proposes from a closed set; the agent writes text only for a move that has been approved.
_Avoid_: action, intent, response

**VerifyShield**:
The deterministic envelope that rules on every proposed move (allow, block, or downgrade) before any text for it is written. It rules on moves only: the words an agent writes for an approved move are not checked. It can be switched off for every student at once to show the behaviour without it; it is on unless switched off.
_Avoid_: shield, guard, filter, harness

**Redirect**:
The move the VerifyShield puts in place of a teacher move about a closed module or something out of course: the teacher names where that belongs and brings the student back to the current module.
_Avoid_: refusal, decline

**Decision log**:
The record of every verdict the VerifyShield reached, with what it was proposed, what it knew (including the mastery threshold in force), the rule checks it made, the addressed agent of the turn, and whether it was switched on. It records the system, never the student's work.
_Avoid_: audit log, history, evidence

**Rule check**:
One rule the VerifyShield applied to a proposed move, in order, with whether it passed and why. The last rule check is the one that decided the verdict. A verdict reached while the VerifyShield was off has none.
_Avoid_: rule result, step

**VerifyShield trace**:
A panel, off by default, that shows the raw verdict for each turn, meant for assessors rather than students.
_Avoid_: shield trace

### Architecture

**Component**:
A named part of a container that has one job, such as the VerifyShield of the server or the python runner of the web app. Its folder is the kebab-case of its name (`verify-shield/`). Follows the C4 convention, so it is the word for a part of the system in the C4 documents, the research documents (M1 to M7) and code comments. A **Module** is only ever a unit of the course. A Vue single-file component is a Vue component, not a C4 component; say "Vue component" where both could be meant.
_Avoid_: module, part, layer
