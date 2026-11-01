# Web app

Nuxt app for the verifiable co-learner. From this directory, install dependencies and start the local server:

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and fill in the keys for the team's Supabase project, `VerifiableCoLearnerAgents`. The secret key stays in that file on the server; the browser only receives the publishable key.

Demo accounts, reproducible from `supabase/seed.sql`:

| Student | Email | Password |
|---|---|---|
| An | an@example.com | an-demo-password |
| Bình | binh@example.com | binh-demo-password |
