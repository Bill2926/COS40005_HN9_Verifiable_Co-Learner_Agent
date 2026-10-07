# Which teacher–student dialogue corpora can serve as ground truth for the Benchmark harness?

Ticket: [#6](https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent/issues/6) · Map: [#1](https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent/issues/1) · Researched 2026-10-07 · Terms follow `CONTEXT.md` (Activity, Pedagogical state, Transition, Guard, Intent, Learning milestone, Shortcut learning).

Every factual claim carries a source tag such as [S4]. The tags resolve in the Sources list at the end. Anything I could not confirm against a primary source is marked **UNVERIFIED**. Statements labelled *Assessment* are my own judgement, not a sourced fact.

## Answer in brief

- **No public corpus matches the brief end to end.** None records a university student working with an AI co-learner across Lectures, Tutorials and Assignments, and none ships human-labelled Pedagogical states or Learning milestones. The Benchmark harness will have to combine several corpora and add a thin layer of our own annotation.
- **Tutorial is the best-covered Activity.** MathDial (2,861 dialogues, CC BY-SA 4.0) has per-turn teacher moves and a dialogue-level "teacher had to reveal the answer" flag [S4][S6]. TSCC v2 (260 one-to-one lessons) has sequence-type labels that read almost like Pedagogical states [S1]. MRBench has per-reply "Revealing of the Answer" labels, which give Guard-preservation ground truth directly [S18].
- **Assignment has the only real university data.** StudyChat (UMass Amherst AI course, 2,214 conversations, CC BY 4.0) includes assignment context, grades, and labels for student requests such as "Write Code" and "Write English" that can stand in for shortcut-seeking [S23][S24]. The Socratic Debugging Benchmark supplies gold instructor behaviour that guides the student without giving away the fix [S27][S28]. CS1QA (TA chats from a university intro-programming course, authors at KAIST) adds real TA–student help questions [S25][S26].
- **Lecture is the weakest.** Real university lecture and office-hour transcripts exist (MICASE, BASE), but they carry no pedagogical labels and contain no learner–AI interaction [S34][S35]. The closest dialogue form is TutorChat: 80k synthetic textbook-grounded dialogues with no declared licence [S38]. For the prerequisite graph, LectureBank and MOOCCubeX provide concept and prerequisite data rather than dialogues [S39][S40].
- **Knowledge-tracing labels exist only for school maths.** The Scarlatos et al. dialogue-KT repo releases GPT-4o-annotated per-turn knowledge-component (Common Core) and correctness labels for CoMTA and MathDial [S21][S22]. Eedi's QATD-2k ties 1,971 real tutoring chats to diagnostic questions and a subject→topic→subtopic hierarchy [S20].
- **Licences are the main practical constraint.**
  - CoMTA may only be used for internal evaluation. Training on it is prohibited, and so is publishing it or any derivative [S9].
  - NCTE forbids sharing the data, and every user must submit their own form [S16].
  - TSCC is non-commercial, and every collaborator must be named on the request form [S2].
  - MathDial, MRBench, StudyChat, CIMA, Socratic Debugging and CS1QA can be downloaded openly.

## Comparison table

"Open" means a direct download. "Click-through" means accepting terms online with no human review. "Form" means a request with human or automatic review.

| Corpus | Subject · level | Size | Real or synthetic | Licence · access | Annotations useful to us | Best Activity fit |
|---|---|---|---|---|---|---|
| **TSCC v2** | English as a second language (ESL), CEFR B1–C2 · not a university course | 260 lessons, 41.5k turns [S1] | Real one-to-one chat lessons | Cambridge bespoke non-commercial licence · Google form [S2] | Sequence types, teaching focus, grammatical-error correction; SETT (Self-Evaluation of Teacher Talk) on 50 lessons [S1] | Tutorial |
| **MathDial** | Maths word problems (GSM8k), grade-7-like confusions | 2,861 dialogues [S4] | Human teachers + LLM-simulated students [S6] | CC BY-SA 4.0 (GitHub) / CC BY 4.0 (Hugging Face) · open [S4][S5] | Teacher move per turn (Focus/Probing/Telling/Generic); `self-correctness` incl. "Yes, but I had to reveal the answer" [S4][S6] | Tutorial |
| **MRBench** | Maths · school (from MathDial + Bridge) | v1: 192 dialogues / 1,596 replies; v3: 300 [S18] | Mixed: LLM and human tutor replies | CC BY-SA 4.0 · open [S18] | 8 human-annotated dimensions per reply incl. **Revealing of the Answer**, Providing Guidance, Mistake Identification [S18][S19] | Tutorial (Guard checks) |
| **CIMA** | Italian prepositional phrases · crowdworkers | 1,135 entries; 391 exercises / 2,880 tutor replies [S7][S8] | Role-play by Mechanical Turk workers [S8] | CC BY 2.5 · open [S7] | Tutor actions (Question, Hint/Information Reveal, Correction, Confirmation, Other); student actions (Guess, Question, Affirmation, Other); grammar rules [S7] | Tutorial |
| **CoMTA** | Maths, Elementary→Calculus · school | 188 conversations [S9][S10] | Real students + Khanmigo (LLM tutor) [S10] | Khan Academy evaluation-only licence; **no training, redistribution or publication** · open download [S9] | `expected_result` (Answer Accepted 108 / Not Accepted 80), `math_level` [S9]; GPT-4o knowledge-component (KC) + correctness labels via dialogue-KT [S21] | Tutorial (correctness Guard) |
| **Bridge** | Maths, grades 1–5, US Title I schools | 700 snippets (last 5 messages before a mistake) [S13] | Real novice tutors + expert rewrites [S13] | Repo MIT / Hugging Face data CC BY-NC 4.0 · open [S11][S12] | Error type, strategy, intention, expert response [S11] | Tutorial (remediation) |
| **NCTE transcripts** | Maths, grades 4–5 classrooms | 1,660 lessons, 317 teachers [S15] | Real classroom audio transcripts | Research-only, no sharing · **per-user Google form**; metadata via ICPSR [S14][S16][S17] | Turn-level (subset): on-task, high uptake, focusing question, student reasoning; observation scores [S14] | Lecture-like (whole class) |
| **TalkMoves** | Maths, K-12 classrooms | 567 transcripts [S36] | Real | CC BY-NC-SA 4.0 · open (public subset) [S36] | 10 human talk moves per sentence; Switchboard-style dialogue acts [S36] | Lecture-like |
| **Eedi QATD-2k** | Maths, UK, mean student age 12 | 1,971 dialogues, 68,717 messages [S20] | Real human-tutor chats | CC BY-NC-SA 4.0 in card text (Hugging Face tag says CC BY-NC 4.0) · open [S20] | Anchoring diagnostic question + answer options; subject/topic/subtopic hierarchy; **machine-predicted** talk moves [S20] | Tutorial / Exam revision |
| **MTM v1 (National Tutoring Observatory)** | Maths, US middle/high school (UPchieve) | 4,654 transcripts, 274k utterances [S37] | Real | "Subject to governance and access controls"; **download route UNVERIFIED** [S37] | None released with v1; annotation tool (Sandpiper) separate [S37] | Tutorial |
| **StudyChat** | AI/ML programming · **university (UMass, 3rd/4th year)** | 2,214 conversations, 16,851 student utterances, 203 students [S24] | Real students + unconstrained gpt-4o-mini [S24] | CC BY 4.0 · Hugging Face click-through gate [S23] | GPT-4.1 dialogue acts (8 broad/31 specific); assignment specs, 924 graded submissions, assignment + exam scores [S23][S24] | **Assignment** |
| **Socratic Debugging Benchmark** | Python novice debugging · CS1 level | v1: 23 problems, 34 bugs, 86 dialogues [S28]; v2/v3 larger [S27] | Instructor-authored (simulated) | MIT (Hugging Face tag) · open [S27] | Problem, buggy code, bug description, **bug fixes**, unit tests, main + alternative Socratic replies per turn [S28] | **Assignment** |
| **CS1QA** | Python intro course · **university** (authors at KAIST) | 9,237 annotated Q–A pairs + 17,698 unannotated chat sessions [S26] | Real TA–student chat | MIT repo · annotated set open; unannotated by email [S25] | Question type, relevant code lines, answer, code snapshot at question time [S26] | **Assignment** |
| **CodeWorkout (2nd CSEDM challenge)** | Java CS1 · university | 50 problems; 800+ students, 130k+ submissions across semesters [S30] | Real submission logs (no dialogue) | DataShop; **access level UNVERIFIED** [S30] | ProgSnap2 events, scores (% tests passed), compile errors, final grades [S30][S32] | Assignment (milestone proxy) |
| **CSEDM 2019 (ITAP)** | Python novices | 89 students, 38 problems [S29] | Real logs (no dialogue) | DataShop · **UNVERIFIED** [S29] | Submissions + **hint requests** (`X-HintRequest`) [S29] | Assignment (help-seeking proxy) |
| **MICASE** | Mixed disciplines · **university (U. Michigan)** | 152 transcripts, 1.85M words [S34] | Real speech | Free for study/teaching/research; full corpus by (nominal-fee) licence [S34] | Speech-event type (lectures, discussion/lab sections, office hours, study groups…), speaker academic role; no pedagogical labels [S34] | **Lecture**, Tutorial (office hours) |
| **BASE** | Four disciplinary groups · **university (Warwick, Reading)** | 160 lectures + 39 seminars [S35] | Real speech | Non-commercial; quoting limits · Oxford Text Archive [S35] | TEI XML transcripts; no pedagogical labels [S35] | **Lecture** |
| **TutorChat / TutorEval** | Textbook chapters (LibreTexts), ~40% STEM · university textbooks | 80k dialogues / 834 questions [S38] | Synthetic (GPT-3.5/4) / expert-written questions | **No licence declared** · open on Hugging Face [S38] | Chapter grounding; TutorEval free-form questions on a chapter [S38] | Lecture (synthetic) |
| **LectureBank** | NLP/ML lecture files · university | 1,352 lecture files (paper); 7,499 URL records now [S39] | Real course materials (no dialogue) | **No licence declared** [S39] | Topic taxonomy; 208 concepts with prerequisite annotations [S39] | Lecture (prerequisite graph) |
| **MOOCCubeX** | Chinese MOOCs (XuetangX) · university-level | 4,216 courses, 637k concepts [S40] | Real platform data (no tutoring dialogue) | Repo GPL-3.0; **data licence UNVERIFIED** [S40] | Concept–video/problem links; prerequisite labels (psychology, maths, CS); exercise correctness; QA-bot logs [S40] | Lecture (prerequisite graph) |

## Per-corpus notes

### Named in the ticket

**Teacher-Student Chatroom Corpus (TSCC) v2.**
- *Content.* 260 one-to-one online English lessons, each about an hour long, run by 2 teachers with 13 students. That is 41,484 turns and 362,440 words; learners are rated CEFR B1–C2 [S1].
- *Annotations.*
  - Threading.
  - Major and minor *sequence types*: opening, topic, presentation, eliciting, scaffolding, enquiry, homework, closing and others.
  - Teaching focus (the skill being targeted).
  - Resources used.
  - Minimal grammatical-error correction.
  - Per-lesson CEFR level.
  - SETT modes and "interactures" on 50 lessons [S1].
- *Access and licence.* The corpus is released through a request form. By submitting it you accept a University of Cambridge licence that is non-exclusive, non-transferable and for non-commercial research and education only. You must acknowledge the corpus in publications and list every collaborator (a new form is needed for new collaborators) [S2].
- *Fit (Assessment).* This is the corpus the brief has in mind with "teacher–student chatroom". Its sequence types map almost directly onto a Tutorial state machine (opening → topic → presentation/eliciting/scaffolding → homework → closing), so it suits **state-reachability** tests. It has no correctness or knowledge-component (KC) labels and is language learning rather than a university course. Learner ages are **UNVERIFIED**.

**MathDial.**
- *Content.* 2,861 one-to-one dialogues grounded in GSM8k word problems. Each record includes the problem, the correct answer, the student's incorrect solution and confusion profile, and the teacher's free-text description of the confusion [S4].
- *How it was made.* The teachers were 91 professionals with teaching experience, recruited through Prolific. The students were InstructGPT (`text-davinci-003`) prompted with common misconceptions [S6].
- *Annotations.*
  - Each teacher utterance carries a move label from a taxonomy: **Focus**, **Probing**, **Telling** ("revealing answer/strategy") and **Generic** [S6].
  - At the end of each dialogue the teacher reports `self-correctness`: `Yes`, `Yes, but I had to reveal the answer`, or `No` [S4].
  - Agreement on the move labels is moderate: κ = 0.60 between two independent annotators, rising to 0.67 when Focus and Probing are merged [S6].
- *Licence.* CC BY-SA 4.0 per the GitHub README, but CC BY 4.0 per the Hugging Face card [S4][S5]. Treat it as BY-SA to be safe.
- *Fit (Assessment).* Strong **Tutorial** ground truth:
  - Teacher moves can serve as Transition labels.
  - "Telling" and "had to reveal" mark Guard-violation events.
  - `ground_truth` is a natural Learning milestone (the student reaches the correct answer).
  - The students are simulated, so real shortcut-seeking behaviour is absent.

**CIMA.**
- *Content.* Crowdworkers on Mechanical Turk role-played students and tutors on exercises translating English prepositional phrases into Italian [S8]. The released `dataset.json` contains 1,135 Prepositional Phrase entries. Each has the past conversation, the stimulus (preposition, object, colour), grammar rules, student actions, several tutor responses and tutor actions. The "shape" subset in the file is empty [S7].
- *Annotations.*
  - Tutor actions: Question, Hint/Information Reveal, Correction, Confirmation, Other.
  - Student actions: Guess, Question, Affirmation, Other [S7].
- *Licence.* CC BY 2.5 [S7].
- *Fit (Assessment).* Having several tutor responses for the same context is useful for testing whether the Verification middleware allows *any* acceptable reply. The domain is a toy one.

**CoMTA (Khan Academy).**
- *Content.* 188 anonymised conversations based on real Khanmigo sessions with students, ranging from elementary maths to calculus [S10]. By level: Elementary 52, Algebra 45, Calculus 35, Trigonometry 30, Geometry 26 [S9].
- *Annotations.* Each conversation has `expected_result`, which says whether the tutor should accept the student's final answer: Answer Accepted 108, Answer Not Accepted 80 [S9]. Scarlatos et al. note that Khanmigo is prompted to use the Socratic method and not to reveal answers directly [S22].
- *Licence.* An "Evaluation Dataset License" allows internal, non-commercial evaluation of models only. Re-distribution, publication, training and production use of the dataset *or its derivatives* are prohibited [S9].
- *Fit (Assessment).* Good for a **correctness Guard** (the system must not accept a wrong answer). We can run the benchmark on it but cannot publish annotated excerpts.

**Bridge.**
- *Content.* 700 examples from text-based tutoring of grade 1–5 students in mostly Title I US schools. Each example holds the last 5 messages before a student mistake, the novice tutor's response, two expert responses, and the expert's error type, strategy (`z_what`) and intention (`z_why`). It covers 120 lesson topics [S13][S11].
- *Licence.* MIT on the GitHub repo, but CC BY-NC 4.0 on the Hugging Face data card [S11][S12].
- *Fit (Assessment).* Snippets, not whole dialogues, so it is of limited use for state reachability. The error-type and strategy labels are useful for testing remediation Transitions.

**NCTE classroom transcripts.**
- *Content.* 1,660 grade 4–5 maths lessons, each 45–60 minutes, from 317 teachers in 4 US districts, recorded 2010–2013 [S15].
- *Annotations.* Turn-level labels exist for only a *small subset*: `student_on_task`, `teacher_on_task`, `high_uptake`, `focusing_question` and `student_reasoning`. The rest must be inferred with the authors' classifiers (EduConvoKit) [S14]. Observation scores, value-added measures and surveys sit in ICPSR study 36095, which is free to users at ICPSR member institutions [S14][S17].
- *Access.* Each user fills in a Google form and agrees to research-only use, no harm to teachers or students, and **not sharing the data with anyone else** [S16].
- *Fit (Assessment).* The largest real classroom corpus, but it is elementary school and whole-class rather than one-to-one. It could inform how a Lecture is structured, not university content.

**MRBench.**
- *Content.* Built on MathDial and Bridge. v1 has 192 conversations with 1,596 tutor responses from seven LLMs plus humans, each human-annotated on 8 dimensions: Mistake Identification, Mistake Location, **Revealing of the Answer** (Yes correct / Yes incorrect / No), Providing Guidance, Actionability, Coherence, Tutor Tone and Humanlikeness [S18][S19]. v2 has 200 conversations; v3 has 300 but only 4 dimensions for the added examples [S18].
- *Licence.* CC BY-SA 4.0 [S18].
- *Fit (Assessment).* The most direct off-the-shelf ground truth for **Guard preservation**. Given a dialogue context and a candidate reply, it says whether the reply leaks the answer.

**Eedi Question-Anchored Tutoring Dialogues (QATD-2k).**
- *Content.* 1,971 real chat interventions (68,717 messages) between 1,073 UK students (mean age at intervention 12) and 25 consenting tutors, collected November 2021 to February 2025. Each dialogue starts when a student asks for help on a Diagnostic Question [S20].
- *Metadata.* Question text and answer options; subject→topic→subtopic labels; and `TalkMovePrediction` labels applied by a GPT-based classifier, **not** by humans [S20].
- *Licence.* The card text says CC BY-NC-SA 4.0 and the Hugging Face metadata tag says CC BY-NC 4.0. Commercial use requires contacting Eedi [S20].
- *Limits.* Student identities are not linkable for privacy reasons [S20].
- *Fit (Assessment).* Real student behaviour, including answer-guessing in the card's sample ("is it c", "is it d") and requests for clues. That makes it useful for **Intent** extraction and shortcut-seeking, but it is school maths.

**Programming-education datasets (CSEDM / ProgSnap2 / CodeWorkout).**
- *What they are.* These are submission logs, not dialogues. ProgSnap2 is a CSV event format: a `MainTable` of events plus `CodeStates` snapshots [S32].
- *2nd CSEDM Data Challenge (CodeWorkout).* Organisers describe 130,000+ Java submissions to 50 problems from 800+ students, with tracks to predict later-problem success and final-exam grades [S30]. One paper that uses the data reports a labelled Spring 2019 subset of 246 students from a CS1 course "at a public university" [S31, secondary]. It is hosted on DataShop as "CodeWorkout data Spring 2019" (files-only). Whether it is public or by request is **UNVERIFIED** [S30].
- *2019 CSEDM challenge (ITAP).* 89 novice Python students, 38 problems, with every attempt and **hint request** logged [S29]. Participant level is **UNVERIFIED**.
- *Fit (Assessment).* Useful as **Learning milestone proxies** for Assignments: first-correct submission, passing tests, and the final grade. Hint requests give a behavioural signal of help-seeking. Neither dataset provides KC labels for free.

### Additional candidates found

**StudyChat.**
- *Content.* An IRB-approved study in UMass Amherst COMPSCI 383 (AI). Students were in their third or fourth year. Data covers Fall 2024 and Spring 2025: 2,214 conversations, 16,851 student utterances, 203 consenting students and 7 assignments. It also includes 924 graded submissions from 158 students, assignment instructions and starter code, and assignment and exam scores [S24][S23].
- *Tutor setup.* The chatbot was gpt-4o-mini with the default "You are a helpful assistant" prompt, no course materials, and no restrictions on use [S24].
- *Dialogue acts.* Broad classes are Writing (Write Code, Write English, …), Editing, Contextual Questions, Conceptual Questions, Verification, Context, Off Topic and Misc [S24]. The labels were generated by GPT-4.1 [S23]. Human–LLM agreement on a held-out set is κ ≈ 0.58 for broad labels, on par with human–human agreement of 0.58 [S24].
- *Finding.* Students who used the LLM to write reports and "circumvent assignment learning objectives" did worse on exams [S24].
- *Licence and access.* CC BY 4.0. The Hugging Face repo is gated with automatic approval (click-through) [S23].
- *Fit (Assessment).* The **closest real analogue to our Assignment setting**, with university students, real Intents and observable shortcut-seeking. Because the assistant was *unguarded*, its replies are negative examples: they show what a Guard should block. They are not gold tutor behaviour. Anonymised `userId` links one student's conversations across assignments [S23], which few other corpora allow (see Gaps).

**Socratic Debugging Benchmark.**
- *Content.* Instructor-authored dialogues in which an instructor guides a novice Python student to find and fix a single bug *without being given the solution* [S28].
- *Per-dialogue inputs.* Problem description, buggy code, bug description, bug fixes, unit tests, and a main plus alternative Socratic instructor utterances at each turn. v1 has 23 problems, 34 bugs, 86 dialogues and 2,092 utterances [S28]; v2 and v3 add more dialogues [S27].
- *Licence.* MIT (Hugging Face licence tag; the GitHub repo declares none) [S27].
- *Fit (Assessment).* Excellent Guard fixtures for programming Assignments. The bug fix is the hidden answer, so a reply that states it violates the Guard. "Student fixes the bug" is the Learning milestone.

**CS1QA.**
- *Content.* Questions and answers from synchronous student–TA chat during online lab sessions of a university introductory Python course, with each student's keystroke-level code history [S26]. The paper refers to "the IRB at our university" and the authors are at KAIST; that the course is KAIST's is an inference. The annotated set has 9,237 Q–A pairs with question type, relevant code lines and the code snapshot at question time. There are also 17,698 unannotated chat sessions with code [S26].
- *TA probing questions.* TAs' questions are typed as Comparison, Reasoning, Explanation, Meaning or Guiding [S26].
- *Language.* Mostly Korean, machine-translated into English and quality-checked [S26].
- *Licence and access.* The annotated data is in the repo (MIT). The unannotated data is available by email to the authors [S25].
- *Fit (Assessment).* Real university Assignment help-seeking with TA answers. Weaker than StudyChat for whole-dialogue state modelling because it is mostly Q–A pairs.

**SIGCSE 2025 AI-augmented TA artefacts.** 185 undergraduates on a CS1 C course. Their "Get Help" requests (115 handled by an LLM, 17 by human TAs) come with code state, test results and the AI or TA feedback. MIT licence [S33]. *Assessment:* small, but a further real university Assignment sample.

**MICASE.**
- *Content.* 152 transcripts (1,848,364 words) of academic speech at the University of Michigan [S34]. Event types: small and large lectures (62), discussion sections (9), lab sections (8), office hours (8), study groups (8), seminars (8), advising (5) and others [S34].
- *Metadata.* Each transcript header gives the speech-event type, academic division and speaker attributes such as academic role. There are no dialogue-act or correctness labels [S34].
- *Access.* Free for study, teaching and research. Transcripts can be downloaded one by one. The complete corpus is available under a single-user or site licence for a nominal fee [S34].
- *Fit (Assessment).* The best *real university* Lecture and office-hour material. It needs our own milestone and state annotation.

**BASE.**
- *Content.* 160 lectures and 39 seminars recorded at Warwick and Reading, spread evenly across four disciplinary groups, as TEI XML [S35].
- *Terms.* Use is non-commercial. Quotation is limited to 100 running words per passage and 200 per assignment, and the developers must be told about resulting publications [S35, conditions as reproduced by Sketch Engine].
- *Fit (Assessment).* Lecture material only. Its seminars are a modest Tutorial-like supplement.

**TalkMoves.**
- *Content.* 567 K-12 maths lesson transcripts. Each sentence is human-annotated with one of 10 accountable-talk moves for teachers and students, plus Switchboard-style dialogue acts [S36].
- *Licence and access.* CC BY-NC-SA 4.0. Only the publicly accessible transcripts are in the repo [S36].
- *Fit (Assessment).* Its talk-move scheme is a ready-made label set for whole-class (Lecture-like) discourse.

**MTM v1 (National Tutoring Observatory).**
- *Content.* 4,654 maths tutoring transcripts from UPchieve, a free US online tutoring service for low-income middle and high school students. 274,121 utterances across 15 maths subjects up to Calculus AB [S37].
- *Status.* Described as "the largest publicly available tutoring interaction dataset", released "subject to appropriate governance and access controls". No turn-level labels are released [S37].
- *Access.* I could not find a download location on the observatory's Hugging Face organisation or its public GitHub repos (**UNVERIFIED**).

**TutorChat and TutorEval.**
- *Content.* TutorChat is 80,000 GPT-3.5/GPT-4 dialogues grounded in LibreTexts textbook chapters, about 40% STEM. TutorEval is 834 expert-written questions about long chapters [S38].
- *Licence.* Neither Hugging Face dataset declares a licence [S38]. Usage rights are therefore **UNVERIFIED**.
- *Fit (Assessment).* The only dialogue resource shaped like "chatting with a co-learner about lecture or theory content" at university level, but it is synthetic and legally unclear.

**LectureBank and MOOCCubeX.** Not dialogue corpora, but possible ground truth for the **prerequisite graph**.
- *LectureBank.* University NLP lecture files with a topic taxonomy and binary prerequisite annotations over 208 concepts. No licence on the repo [S39].
- *MOOCCubeX.* Chinese MOOC data: concepts linked to videos and problems, predicted and human prerequisite labels for psychology, maths and CS, exercise correctness, and logs from the platform's QA bot. The repo is GPL-3.0 [S40].

## Shortlist by Activity

These rankings are *Assessment*, based on the evidence above.

### Lecture

1. **MICASE**, with **BASE** as backup. Real university lectures, discussion sections and office hours, free for research [S34][S35]. We would need to annotate concepts, milestones and states ourselves.
2. **TutorChat / TutorEval.** Dialogue grounded in university textbook chapters [S38]. Synthetic, and its licence must be clarified before use.
3. **LectureBank** or **MOOCCubeX** for prerequisite-graph and concept ground truth [S39][S40]. If an *annotated* discourse scheme is needed, borrow TalkMoves' talk moves [S36] or NCTE's uptake and focusing-question codes [S14]. Both are K-12.

### Tutorial

1. **MathDial**, together with the dialogue-KT GPT-4o KC and correctness labels. It covers Transitions (teacher moves), Guard events (Telling, "had to reveal") and milestones (the correct answer) [S4][S6][S21].
2. **TSCC v2.** Real one-to-one lessons whose sequence types act as Pedagogical-state ground truth for reachability [S1]. Access requires the form.
3. **MRBench.** Human labels for whether a reply reveals the answer or provides guidance, for Guard preservation [S18].

Alternates: **Eedi QATD-2k** (real students, answer-seeking) [S20]; **CoMTA** (answer-acceptance correctness, evaluation-only) [S9]; **CIMA** (several valid tutor replies per context) [S7].

### Assignment

1. **StudyChat.** Real university assignment help with dialogue acts that proxy shortcut-seeking, plus grades [S23][S24].
2. **Socratic Debugging Benchmark.** Gold "guide, don't solve" behaviour, with the bug fix acting as the hidden answer the Guard must protect [S27][S28].
3. **CS1QA.** Real TA–student help questions tied to code state [S25][S26].

Supporting data: **CodeWorkout / CSEDM** for milestone proxies such as first-correct submissions and final grades [S30], and the hint-request logs in **CSEDM 2019** [S29].

### Exam revision (later)

There is no good fit. Eedi's diagnostic questions [S20] and CodeWorkout's final grades [S30] are the nearest signals.

## Gaps: what no corpus provides

1. **University student plus AI co-learner across Lectures and Tutorials.** Only StudyChat is a university student–LLM corpus, and it covers assignments with an unguarded assistant [S24]. Lecture corpora are monologic or classroom transcripts with no learner–AI turn-taking [S34][S35].
2. **Human-labelled Pedagogical states matching our state machines.** The nearest equivalents are TSCC sequence types, MathDial teacher moves, CIMA actions, TalkMoves talk moves and StudyChat dialogue acts [S1][S6][S7][S36][S24]. Each needs a crosswalk to our states and Intents, and some agreement figures are only moderate (MathDial κ = 0.60, StudyChat κ ≈ 0.58) [S6][S24].
3. **Human-labelled Learning milestones or KCs for university content.** Per-turn KC and correctness labels exist only for school maths, and were produced by GPT-4o (dialogue-KT [S21][S22]). Assignment grades and test results are coarse, per-task proxies [S24][S30].
4. **Explicit shortcut-seeking labels.** No corpus has a human-annotated "solution request / shortcut attempt" class. Available proxies are StudyChat Writing/Write Code (LLM-labelled) [S24], CSEDM hint requests [S29], MathDial "Telling" and "had to reveal" [S4], MRBench "Revealing of the Answer" [S18], and the guessing visible in Eedi [S20]. Persistent or adversarial answer-seeking students are not represented; MathDial's students are cooperative simulations [S6].
5. **Cross-session learner linkage.** Scarlatos et al. note that no open large-scale tutoring dialogue dataset links students across dialogues [S22]. StudyChat's anonymised `userId` is a partial exception [S23]. Eedi deliberately limits student-level detail [S20].
6. **Replay divergence (Assessment, not sourced).** Recorded student turns respond to the *original* tutor. Once our Co-learner replies differently, the next recorded student turn may no longer follow. Replay therefore suits per-turn checks (classifying Intents, judging a single reply against a Guard) better than full multi-turn state-reachability claims. Multi-turn reachability may need simulated students, as in MathDial's interactive evaluation [S6].
7. **Exam revision and non-English or Vietnamese contexts.** No dialogue corpus covers exam revision. The non-English corpora are CS1QA (Korean, machine-translated) and MOOCCubeX (Chinese) [S26][S40].

## Open uncertainties

- **MTM v1 access route.** The paper says "open … subject to governance and access controls", but I found no public download. **UNVERIFIED** [S37].
- **CodeWorkout and CSEDM 2019 DataShop access.** Public, login-only or by request? **UNVERIFIED**. The challenge site did not render through my fetch tools [S29][S30].
- **Conflicting licences.** MathDial: CC BY-SA vs CC BY [S4][S5]. Bridge: MIT vs CC BY-NC [S11][S12]. Eedi: CC BY-NC-SA vs CC BY-NC [S20]. The safe reading is the more restrictive one.
- **No declared licence.** TutorChat, TutorEval and LectureBank [S38][S39]. MOOCCubeX's data licence beyond the GPL-3.0 repo is **UNVERIFIED** [S40].
- **TSCC.** Learner ages, and whether a student team qualifies under the request process, are **UNVERIFIED** [S1][S2].
- **ICPSR membership.** Whether Swinburne is an ICPSR member, which decides access to NCTE metadata, is **UNVERIFIED** [S17].
- **Socratic Debugging v2/v3 counts.** I did not verify exact dialogue counts [S27].
- **Licence of the dialogue-KT annotated data.** CoMTA's licence forbids publishing derivatives, yet the dialogue-KT repo redistributes an annotated CoMTA under that licence [S9][S21]. We should not republish it either.

## Sources

Primary sources were retrieved 2026-10-07. "HF API" means `https://huggingface.co/api/datasets/<id>` (licence tags and gating) on that date.

- [S1] Caines et al. 2022, *The Teacher-Student Chatroom Corpus version 2* (NLP4CALL). https://aclanthology.org/2022.nlp4call-1.3/ · PDF https://aclanthology.org/2022.nlp4call-1.3.pdf
- [S2] TSCC data-request form and licence terms. https://forms.gle/pKc48WMhnySC8zDk9
- [S3] Caines et al. 2020, *The Teacher-Student Chatroom Corpus* (v1). https://aclanthology.org/2020.nlp4call-1.2/
- [S4] MathDial GitHub README (data fields, CC BY-SA 4.0). https://github.com/eth-nlped/mathdial
- [S5] MathDial Hugging Face card (CC BY 4.0). https://huggingface.co/datasets/eth-nlped/mathdial
- [S6] Macina et al. 2023, *MathDial* (EMNLP Findings). https://arxiv.org/abs/2305.14536
- [S7] CIMA GitHub README and `dataset.json`. https://github.com/kstats/CIMA
- [S8] Stasaski, Kao & Hearst 2020, *CIMA* (BEA). https://aclanthology.org/2020.bea-1.5/
- [S9] Khan Academy `tutoring-accuracy-dataset` repo: `CoMTA_dataset.json`, `LICENSE`. https://github.com/Khan/tutoring-accuracy-dataset
- [S10] Khan Academy blog, *Introducing a New Dataset…* https://blog.khanacademy.org/introducing-a-new-dataset-to-further-the-field-of-ai-research/
- [S11] Bridge GitHub README (MIT repo). https://github.com/rosewang2008/bridge
- [S12] Bridge Hugging Face card (CC BY-NC 4.0). https://huggingface.co/datasets/rose-e-wang/bridge
- [S13] Wang et al. 2024, *Bridging the Novice-Expert Gap…* (NAACL). https://arxiv.org/abs/2310.10648
- [S14] NCTE transcripts README. https://github.com/ddemszky/classroom-transcript-analysis
- [S15] Demszky & Hill 2023, *The NCTE Transcripts* (BEA). https://aclanthology.org/2023.bea-1.44/
- [S16] NCTE per-user access form and terms. https://forms.gle/1yWybvsjciqL8Y9p8
- [S17] ICPSR study 36095, *National Center for Teacher Effectiveness Main Study*. https://www.icpsr.umich.edu/web/ICPSR/studies/36095
- [S18] MRBench repo (versions, schema, CC BY-SA 4.0). https://github.com/kaushal0494/UnifyingAITutorEvaluation
- [S19] Maurya et al. 2025, *Unifying AI Tutor Evaluation* (NAACL). https://aclanthology.org/2025.naacl-long.57/
- [S20] Eedi QATD-2k Hugging Face card; HF API. https://huggingface.co/datasets/Eedi/Question-Anchored-Tutoring-Dialogues-2k
- [S21] `umass-ml4ed/dialogue-kt` README (annotated CoMTA and MathDial). https://github.com/umass-ml4ed/dialogue-kt
- [S22] Scarlatos, Baker & Lan 2025, *Exploring Knowledge Tracing in Tutor-Student Dialogues using LLMs* (LAK). https://arxiv.org/abs/2409.16490
- [S23] StudyChat Hugging Face card; HF API (gated: auto). https://huggingface.co/datasets/wmcnicho/StudyChat
- [S24] McNichols et al., *The StudyChat Dataset* (LAK 2026). https://arxiv.org/abs/2503.07928
- [S25] CS1QA GitHub README (MIT). https://github.com/cyoon47/cs1qa
- [S26] Lee et al. 2022, *CS1QA* (NAACL). https://aclanthology.org/2022.naacl-main.148/
- [S27] Socratic Debugging Benchmark repo and Hugging Face card (MIT tag). https://github.com/taisazero/socratic-debugging-benchmark · https://huggingface.co/datasets/taisazero/socratic-debugging-benchmark
- [S28] Al-Hossami et al. 2023, *Socratic Questioning of Novice Debuggers* (BEA). https://aclanthology.org/2023.bea-1.57/
- [S29] CSEDM 2019 Data Challenge README (ITAP data). https://github.com/thomaswp/CSEDM2019-Data-Challenge
- [S30] 2nd CSEDM Data Challenge announcement (SoLAR) and DataShop project 585. https://www.solaresearch.org/2021/11/the-2nd-csedm-data-challenge-in-cooperation-with-solar-is-happening-now/ · https://sites.google.com/ncsu.edu/csedm-dc-2021/ · https://pslcdatashop.web.cmu.edu/Project?id=585
- [S31] *(Secondary)* OpenReview paper using the CodeWorkout Spring 2019 subset. https://openreview.net/pdf?id=SuW4Rsu-kZq
- [S32] ProgSnap2 specification repo. https://github.com/CSSPLICE/progsnap2
- [S33] SIGCSE 2025 user-study artefacts (MIT). https://github.com/ai-cet/sigcse2025-userStudy-artifacts
- [S34] MICASE online site, manual and fair-use statement. https://quod.lib.umich.edu/m/micase/ · https://talkbank.org/ca/access/0docs/MICASE.pdf · https://lsa.umich.edu/content/dam/eli-assets/elidocuments/MICASE%20Fair%20Use%20Statement.pdf
- [S35] BASE manual, Oxford Text Archive record 2525, OTA user agreement; usage conditions as reproduced by Sketch Engine. https://warwick.ac.uk/fac/soc/al/research/collections/base/history/base_manual.pdf · https://ota.bodleian.ox.ac.uk/repository/xmlui/handle/20.500.12024/2525 · https://ota.bodleian.ox.ac.uk/repository/xmlui/page/licence-ota · https://www.sketchengine.eu/british-academic-spoken-english-corpus/
- [S36] TalkMoves repo and Suresh et al. 2022 (LREC). https://github.com/SumnerLab/TalkMoves · https://aclanthology.org/2022.lrec-1.497/
- [S37] Kizilcec et al. 2026, *Million Tutoring Moves (MTM)*. https://arxiv.org/abs/2605.08092
- [S38] Chevalier et al. 2024, *Language Models as Science Tutors*; repo; HF API (no licence tag). https://arxiv.org/abs/2402.11111 · https://github.com/princeton-nlp/LM-Science-Tutor
- [S39] Li et al. 2019, *What Should I Learn First: Introducing LectureBank* (AAAI); repo. https://arxiv.org/abs/1811.12181 · https://github.com/Yale-LILY/LectureBank
- [S40] MOOCCubeX repo (GPL-3.0) and Yu et al. 2021 (CIKM). https://github.com/THU-KEG/MOOCCubeX · https://dl.acm.org/doi/10.1145/3459637.3482010
