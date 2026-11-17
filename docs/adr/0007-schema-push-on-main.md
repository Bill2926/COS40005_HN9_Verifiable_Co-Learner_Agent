# Schema push applies migrations to the shared project on main

A push to `main` runs `supabase db push` against the Supabase project the app already uses, `VerifiableCoLearnerAgents`, and does not run the seed. There is no staging project. The database students use is the one that receives the migration. A failed push leaves `main` ahead of that database. The Check stays free of Supabase credentials. Only this job holds a Supabase access token, as a GitHub Actions secret. The CLI uses that token to open a temporary login role, so the database password is not stored in GitHub.

## Considered Options

- **Apply migrations by hand**: rejected. A SQL file can land on `main` and never reach the project the app uses.
- **Push during the pull request**: rejected. An unmerged branch would change the live schema.
- **Include the seed on every push**: rejected. The seed recreates the demo accounts.

## Consequences

The access token has to exist as the `SUPABASE_ACCESS_TOKEN` GitHub Actions secret before the job can succeed. It is not the publishable key, the secret key, or the model key in `web/.env`.
