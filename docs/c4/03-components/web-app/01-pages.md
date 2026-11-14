# Component: pages

> [C4 index](../../README.md) / Level 3: Components / Web app

The four routes of the web app and the app shell. Part of [web-app/00-overview.md](00-overview.md).

Legend: solid = runtime import, thick = runtime link with no import (Nuxt auto-registration, HTTP call, middleware
by name). Blue = this component, grey = other components or containers.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  subgraph pages["pages"]
    direction TB
    index["<b>pages/index.vue</b><br/>Workspace at /"]:::comp
    signin["<b>pages/sign-in.vue</b><br/>/sign-in"]:::comp
    about["<b>pages/about.vue</b><br/>/about"]:::comp
    admin["<b>pages/admin.vue</b><br/>/admin"]:::comp
    shell["<b>app.vue</b>, app.config.ts<br/>UApp, NuxtPage, colours"]:::comp
  end

  panels["<b>workspace components</b><br/>ConversationPanel, CourseRoadmap,<br/>RoadmapCanvas, WorkingArea"]:::near
  helpers["<b>client helpers</b><br/>drafts/store, workspace/layout,<br/>sign-in/intro"]:::near
  studentId["<b>shared/student-id.ts</b>"]:::near
  aboutParts["<b>about components</b><br/>SampleTurn, ShieldDiagram"]:::near
  mw["<b>middleware and plugins</b><br/>signed-in, workspace-layout,<br/>$supabase plugin"]:::near
  server["<b>Turn and admin server</b>"]:::near

  index -->|"imports 4 panels"| panels
  index -->|"createDraftStore, layout helpers"| helpers
  signin -->|"claimIntro, introStart, ..."| helpers
  index -->|"sessionStudentId,<br/>studentIdFromAuth"| studentId
  signin -->|"sessionStudentId"| studentId
  about -->|"studentIdFromAuth"| studentId
  signin ==>|"AboutSampleTurn"| aboutParts
  about ==>|"AboutSampleTurn,<br/>AboutShieldDiagram"| aboutParts
  index ==>|"middleware: signed-in,<br/>workspace-layout"| mw
  admin ==>|"middleware: signed-in"| mw
  index ==>|"/turn, /api/admin"| server
  about ==>|"/course-outline"| server
  admin ==>|"/api/admin"| server

  style pages fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

## Files

| File | Responsibility (from the code) |
|---|---|
| `pages/index.vue` | The workspace. Opens the student's module with `{event: 'open'}`, reads streamed turn events (NDJSON), sends messages, submissions and quiz answers (`{event: 'quiz_answer'}`, one question at a time, under the same lock as a submission), selects modules and exercises, prefetches module views on hover, and switches between the Study and Roadmap layouts (query `?layout=`, cookie). Also reads and sets the VerifyShield switch through `/api/admin`. Signs out with `$supabase.auth.signOut()`. |
| `pages/sign-in.vue` | Email and password form using `$supabase.auth.signInWithPassword`. On the server it redirects a signed-in user to `/`. Plays a first-visit intro (`sign-in/intro`). |
| `pages/about.vue` | Public About page: course outline from `/course-outline`, the shield diagram, the sample turn and the team. |
| `pages/admin.vue` | Product-owner page: model provider settings, VerifyShield switch, newest 100 decisions with filters. Shows a refusal on 403. |
| `app.vue`, `app.config.ts` | `UApp` with `NuxtPage`, light colour mode, indigo and slate palette. |

## Verified imports

- `index.vue`: `ConversationPanel`, `CourseRoadmap`, `RoadmapCanvas`, `WorkingArea`, `shared/turn` (type), `shared/student-id`, `drafts/store`, `workspace/layout`.
- `sign-in.vue`: `shared/student-id`, `sign-in/intro`.
- `about.vue`: `shared/student-id`.
- `admin.vue`: no imports from this repo.
- `AboutSampleTurn` and `AboutShieldDiagram` are used in templates without an import (Nuxt component auto-registration from `components/about/`).
- Middleware is attached by name in `definePageMeta`: `index.vue` uses `['signed-in', 'workspace-layout']`, `admin.vue` uses `'signed-in'`. `about.vue` and `sign-in.vue` set none.
- Nothing imports the pages; Nuxt routes them from the file names. No test imports them; the Playwright specs in `web/e2e/` drive them in a browser.
