# Component: admin

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

`web/server/admin/handle-admin.ts`, one file. The product owner's handler: it checks who is asking, then saves
the model choice, switches the VerifyShield and lists decisions. Part of [server/00-overview.md](00-overview.md).

Legend: solid = runtime import, dashed = type-only import. Blue = this component, grey = other components.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  route["<b>api/admin.post.ts</b>"]:::near
  handle["<b>admin/handle-admin.ts</b><br/>handleAdmin"]:::comp
  choice["<b>language-model/index.ts</b>"]:::near
  shield["<b>verify-shield/index.ts</b>"]:::near
  decisionLog["<b>storage/decision-log.ts</b>"]:::near
  settings["<b>storage/model-settings-store.ts</b>"]:::near

  route -->|"handleAdmin and error classes"| handle
  handle -->|"resolveModelChoice"| choice
  handle -->|"verifyShieldEnabled"| shield
  handle -.->|"type: DecisionLogStore"| decisionLog
  handle -.->|"type: ModelSettingsStore"| settings
```

## Behaviour (from the code)

| Step | What happens |
|---|---|
| Who may call | No email: `SignInRequiredError` (401). Email not in the comma-separated `adminEmails`: `ProductOwnerRequiredError` (403). |
| `save` event | Validates the provider with `resolveModelChoice`, keeps the current API key if the new one is blank, and stores the settings. |
| `verifyShield` event | Saves the on or off switch. |
| Every call | Returns the model settings with the API key masked, the current shield state, and up to 100 decisions filtered by verdict and student id. |

## Verified imports

- Runtime: `language-model` (`resolveModelChoice`; type `ModelSettings`), `verify-shield` (`verifyShieldEnabled`; type `VerifyShieldStore`).
- Type only: `storage/decision-log`, `storage/model-settings-store`.
- It never imports Supabase code; the route passes the stores in.
- Imported by `api/admin.post.ts`. Tests: `admin-handler.test.ts`.
