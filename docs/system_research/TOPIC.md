# Project: Verifiable Co-Learner Agent

## Scope and targeted user
**Capstone Project A**: Introduction to Programming (Python) for 1st-year CS student (6 weeks for implementation). The MAIN user of this is the student (student-focus, not like a dashboard for lecturer) <br>
**Capstone Project B**: not yet

## Abstract
With the fast-paced, deep integration of GenAI-based agents into today's educational activities, concerns have emerged regarding the adverse impact of these agents on learners, particularly regarding shortcut learning. The aim of this project is to investigate and develop a verifiable co-learner agent that keeps track of a learner's interactions across core university activities—including lectures, tutorials, assignments, and exams. By utilizing semi-formal software engineering models to enforce responsible and verifiable usage, the system ensures that learners can actually learn not only faster but also deeper with the support of AI agents. Every interaction is evaluated by a deterministic verification middleware to guarantee adherence to strict educational rubrics rather than unconstrained AI outputs.

## Context 
The agent operates across the core learning activities of the university academic lifecycle. The primary goal is to translate ambiguous conversational intents into semi-formally verified pedagogical states, eliminating detrimental learning shortcuts and ensuring cognitive engagement across theory acquisition, guided tutorials, project implementations, and exam revision.

## Objectives 
The project delivers an LLM-powered co-learner synthesis engine, a semi-formal pedagogical verification middleware, and a full-stack educational web application featuring an interactive canvas to visualize learning progression in real-time. An empirical benchmark harness is included to evaluate guard preservation, outer-fringe reachability, decision replay, and post-filter integrity, each measured against a `VerifyShield-off` baseline.

## Methodology 
The project exclusively leverages semi-formal software engineering methods to accommodate students with limited backgrounds in those areas. The verification engine utilizes graph-based algorithms, including Depth-First Search (DFS) state traversal and static constraint checking, to deterministically verify transition validity across educational boundaries. The VerifyShield is empirically evaluated offline using scripted student scenarios and a fixed adversarial prompt set, both committed as data so that every run is reproducible.