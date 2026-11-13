# Component: routes

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

HTTP endpoints of the server. They only read the session, build the dependencies, call a handler and map
errors to HTTP status codes. Part of [server/00-overview.md](00-overview.md).

Legend: solid = runtime import, thick = HTTP call with no import. Blue = this component, grey = another component.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  spa["<b>Web app</b>"]:::near

  subgraph routes["routes"]
    direction TB
    turnRoute["<b>routes/turn.post.ts</b><br/>POST /turn"]:::comp
    adminRoute["<b>api/admin.post.ts</b><br/>POST /api/admin"]:::comp
    outlineRoute["<b>routes/course-outline.get.ts</b><br/>GET /course-outline"]:::comp
  end

  handleTurn["<b>turn/handle-turn.ts</b>"]:::near
  handleAdmin["<b>admin/handle-admin.ts</b>"]:::near
  agents["<b>agents/index.ts</b>"]:::near
  stores["<b>storage</b><br/>supabase-* stores"]:::near
  shield["<b>verify-shield</b><br/>index.ts"]:::near
  studentId["<b>shared/student-id.ts</b>"]:::near
  course["<b>course/index.ts</b>"]:::near

  spa ==>|"turn events"| turnRoute
  spa ==>|"admin requests"| adminRoute
  spa ==>|"course outline"| outlineRoute

  turnRoute -->|"sessionStudentId"| studentId
  turnRoute -->|"handleTurn, streamTurn,<br/>UnknownExerciseError"| handleTurn
  turnRoute -->|"agentsForTurn"| agents
  turnRoute -->|"5 createSupabase...Store"| stores
  turnRoute -->|"verifyShieldForTurn"| shield
  adminRoute -->|"sessionEmail"| studentId
  adminRoute -->|"handleAdmin and 4 error classes"| handleAdmin
  adminRoute -->|"3 createSupabase...Store"| stores
  outlineRoute -->|"courseModules, courseTitle"| course

  style routes fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

## Files

| File | Responsibility (from the code) |
|---|---|
| `routes/turn.post.ts` | Returns 401 when there is no session. Navigation events (`select_module`, `select_exercise`, `preview_module`) skip the model and shield reads. `message` and `submission` events are answered as an NDJSON stream; the other events as JSON. Builds the Supabase stores on every request (the model-settings and shield stores only for events that call the model) and passes them to `handleTurn` or `streamTurn`. |
| `api/admin.post.ts` | Passes the session email, `adminEmails`, the env model settings and three stores to `handleAdmin`. Maps `SignInRequiredError`, `ProductOwnerRequiredError`, `ModelSettingsError` and `AdminRequestError` to their `statusCode`. |
| `routes/course-outline.get.ts` | Public course outline for the About page: number, name, part, summary, availability. No student data. |

## Verified imports

- `turn.post.ts`: `shared/student-id`, `agents` (`agentsForTurn`), `storage/supabase-conversation-store`, `supabase-decision-log`, `supabase-evidence-store`, `supabase-model-settings-store`, `supabase-verify-shield-store`, `verify-shield` (`verifyShieldForTurn`), `turn/handle-turn`.
- `admin.post.ts`: `shared/student-id`, `admin/handle-admin`, `storage/supabase-decision-log`, `supabase-model-settings-store`, `supabase-verify-shield-store`.
- `course-outline.get.ts`: `course` (`courseModules`, `courseTitle`).
- Auto-imported, no import statement: `defineEventHandler`, `readBody`, `createError`, `sendStream`, `setResponseHeader`, `useRuntimeConfig`.

## Tests

No test imports these files. `turn-endpoint.test.ts` tests `handle-turn.ts` directly, not the route.
