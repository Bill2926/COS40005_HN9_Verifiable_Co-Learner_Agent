# C4 Level 2: Containers

> [C4 index](README.md) / Level 2: Containers

The application is one Nuxt 4 codebase (`web/`) that runs as two runtime containers: a browser
single-page app (with a Pyodide worker) and a Nitro server. Data and sign-in live in Supabase.

Colours: blue is code in this repo, brown is an external system, teal is a database.

```mermaid
flowchart TB
  classDef person fill:#0b3d73,stroke:#082b52,color:#ffffff
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef ext fill:#8a5a00,stroke:#5c3c00,color:#ffffff
  classDef db fill:#0f766e,stroke:#0a4f4a,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  student(["<b>Student</b>"]):::person
  owner(["<b>Product owner</b>"]):::person

  subgraph sys["Verifiable Co-Learner"]
    direction TB
    spa["<b>Web app</b><br/>Nuxt 4, Vue 3, CodeMirror<br/>Workspace, chat, admin pages"]:::comp
    pyodide["<b>Python runner</b><br/>Pyodide in a Web Worker<br/>Runs code and tests"]:::comp
    server["<b>Turn and admin server</b><br/>Nuxt Nitro, TypeScript<br/>SSR, /turn, /api/admin,<br/>VerifyShield, mastery"]:::comp
  end

  auth["<b>Supabase Auth</b><br/>Accounts and sessions"]:::ext
  db[("<b>Postgres database</b><br/>Supabase, RLS<br/>Conversations, evidence,<br/>decisions, settings")]:::db
  llm["<b>LLM provider</b><br/>OpenAI-compatible API"]:::ext
  cdn["<b>jsDelivr CDN</b><br/>Pyodide files"]:::ext

  student -->|"Studies in"| spa
  owner -->|"Reviews and configures on /admin"| spa
  spa -->|"Posts code and tests to"| pyodide
  spa -->|"Loads pages from, calls<br/>/turn and /api/admin on"| server
  spa -->|"Signs in and out via"| auth
  pyodide -->|"Downloads the runtime from"| cdn
  server -->|"Verifies the session with"| auth
  server -->|"Reads and appends records in"| db
  server -->|"Requests moves and<br/>text from"| llm

  style sys fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

## Containers

| Container | Technology | Responsibility |
|---|---|---|
| Web app | Nuxt 4, Vue 3, Nuxt UI, Tailwind 4, CodeMirror 6 | Renders the workspace (Study and Roadmap layouts), chat, practice panel, About and admin pages. Keeps drafts and roadmap arrangement in `localStorage` and layout in a cookie. Code in `web/app/`. |
| Python runner | Pyodide 314, Web Worker | Executes the student's code for Run and for the tests on Submit. Loads the runtime from jsDelivr (`browser-worker.mjs`). The browser then sends the test results to the server as counts (ADR 0002: the server trusts them). Code in `web/app/python/`. |
| Turn and admin server | Nuxt Nitro (`web/server/`) | Also renders pages on the server (SSR) and checks the session before rendering `/sign-in` and `/`. API: `POST /turn` (streamed NDJSON), `POST /api/admin`, `GET /course-outline`. Runs the turn handler, the VerifyShield (`verify-shield/`), BKT mastery (`student-model/`), the course (built from the course spec it reads from the database) and the language-model layer. |
| Postgres database | Supabase Postgres | Tables `courses` (each course's whole course spec, teacher-only content included, readable only with the secret key), `students`, `conversations`, `messages`, `resume_points`, `evidence`, `quiz_answers`, `decisions`, `model_settings`, `verify_shield_settings`. Written by the server with the secret key, which bypasses RLS. The two ledgers (`evidence`, `quiz_answers`) are append-only: no policy, and update and delete revoked from the anon and authenticated roles. Student data (`evidence`, `quiz_answers`, `conversations`, `resume_points`, `decisions`) carries a `course_id`. |
| Supabase Auth | Supabase | Email sign-in. A trigger on `auth.users` creates the matching `students` row. |
| LLM provider | OpenAI-compatible API | Both agents call it twice per turn: once to propose a move, once to render text for an approved move. |
| jsDelivr CDN | Public CDN | Serves the Pyodide runtime to the browser. |

## Notes

- The VerifyShield, the agents, the language-model layer and the student model (evidence ledger and BKT estimate) are components inside the server
  container, not separate containers: they are not deployed on their own. See
  [server/00-overview.md](03-components/server/00-overview.md).
- Supabase Postgres and Supabase Auth are drawn as two elements for clarity but belong to the one
  external system "Supabase" in [01-context.md](01-context.md).
- `web/server/python/node-runner.ts` (Python on the server) is imported only by
  `web/tests/python-runner.test.ts` (checked by search over `web/`), so it is not drawn. If the
  server starts to run Python in production, add it then.
- The browser never reads or writes the database. Verified: nothing under `web/app/` calls
  `supabase.from(...)` or creates its own client; the only browser use of `$supabase` is
  `signInWithPassword`, `signOut` and `getClaims`. All data access is in `web/server/storage/`.
  RLS also denies a signed-in student on `students` (`web/tests/students-boundary.test.ts`).
- The browser's `$supabase` client and the server's request client both use the publishable key;
  only the server's storage clients use the secret key.
- Deployment is in [04-deployment.md](04-deployment.md).
