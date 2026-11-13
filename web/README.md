# Web app

Nuxt app for the verifiable co-learner. From this directory, install dependencies and start the local server:

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and fill in the keys for the team's Supabase project, `VerifiableCoLearnerAgents`. The secret key stays in that file on the server; the browser only receives the publishable key.

Demo accounts, reproducible from `supabase/seed.sql`:

| Who | Email | Password |
|---|---|---|
| An | an@example.com | an-demo-password |
| Bình | binh@example.com | binh-demo-password |
| Product owner | owner@example.com | owner-demo-password |

An starts on Module 1 with nothing behind her. Bình has seeded passing submissions on every exercise of Modules 1 to 4, so those four read as mastered and she starts on Module 5. The seed writes those submissions into the `evidence` ledger; no mastery is stored. Mastery is Bayesian Knowledge Tracing over that ledger, with the parameters in `server/student-model/mastery-parameters.ts`, estimated again every time the course roadmap is drawn. Only a submission writes evidence, a passing submission counts the first time that exercise is passed, and a module unlocks for good once the module before it reaches 0.9.

The product owner opens `/admin` to choose a real OpenAI-compatible model or fake responses. `NUXT_ADMIN_EMAILS` lists who may open that page. A saved choice is used on the next turn. Until one is saved, the server environment supplies the model.

The VerifyShield is on for every student unless `NUXT_VERIFYSHELD` is `off`, or a row in `verify_shield_settings` says otherwise. That row wins on the next turn. The switch on the product owner page is a later slice.
