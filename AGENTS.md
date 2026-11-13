## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Naming

TypeScript conventions. Folders and files are `kebab-case`; classes, interfaces, types and Vue components are `PascalCase`; functions, variables and properties are `camelCase`.

- A C4 component (see **Component** in `CONTEXT.md`) is a folder named in `kebab-case` after its PascalCase name: the VerifyShield is `web/server/verify-shield/`, not `verdict/`. A component with an `index.ts` is imported only through it (`verify-shield`, `agents`, `language-model`, `student-model` and `course` today; `turn`, `storage` and `admin` are still imported file by file).
- Vue single-file components are `PascalCase.vue`, as Nuxt expects.
- Exceptions are names the framework fixes: `app.config.ts`, `*.client.ts` plugins, `pages/*.vue` route files.
- "Module" is only a unit of the course, never a part of the system.

### C4 docs

After modifying code, always update accordingly to docs/c4 if needed that strictly follow c4-architecture convention (e.g. if changes only little affect in function-level then there no need to update context or containers)