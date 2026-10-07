# Project: Verifiable Co-Learner Agent
### Abstract
With the fast-paced, deep integration of GenAI-based agents into today's educational activities, concerns have emerged regarding the adverse impact of these agents on learners, particularly regarding shortcut learning. The aim of this project is to investigate and develop a verifiable co-learner agent that keeps track of a learner's interactions across core university activities—including lectures, tutorials, assignments, and exams. By utilizing semi-formal software engineering models to enforce responsible and verifiable usage, the system ensures that learners can actually learn not only faster but also deeper with the support of AI agents. Every interaction is evaluated by a deterministic verification middleware to guarantee adherence to strict educational rubrics rather than unconstrained AI outputs.

### Context 
The agent operates across the core learning activities of the university academic lifecycle. The primary goal is to translate ambiguous conversational intents into semi-formally verified pedagogical states, eliminating detrimental learning shortcuts and ensuring cognitive engagement across theory acquisition, guided tutorials, project implementations, and exam revision.

### Objectives 
The project delivers an LLM-powered co-learner synthesis engine, a semi-formal pedagogical verification middleware, and a full-stack educational web application featuring an interactive canvas to visualize learning progression in real-time. An empirical benchmark harness is included to evaluate pedagogical state reachability, guard preservation, and learning milestone recall against ground-truth educational datasets.

### Methodology 
The project exclusively leverages semi-formal software engineering methods to accommodate students with limited backgrounds in those areas. The verification engine utilizes graph-based algorithms, including Depth-First Search (DFS) state traversal and static constraint checking, to deterministically verify transition validity across educational boundaries. The agent is empirically evaluated using standardized teacher-student chatroom corpora and curated university activity datasets.
