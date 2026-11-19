# The Nuxt server deploys to Render after main is green

A push to `main` deploys the Nuxt server only after Schema push has applied migrations and the Check workflow for that same commit has succeeded. The host is a Render web service defined in `render.yaml`, region Singapore, with auto-deploy turned off. GitHub calls that service's deploy hook. There is still no staging project: the public site uses `VerifiableCoLearnerAgents`, the database students already use. AWS stays undesigned.

## Considered Options

- **Render auto-deploy on every push to `main`**: rejected. The new server could start before `supabase db push` finishes.
- **Deploy from the pull request**: rejected. An unmerged branch would serve the live database.
- **AWS now**: rejected. The sprint leaves AWS for later, and `nuxt.config.ts` sets no Nitro preset. `pnpm build` already produces a Node server (`web/.output/server/index.mjs`).

## Consequences

The service does nothing until someone creates it from the blueprint and stores its deploy hook as the `RENDER_DEPLOY_HOOK` GitHub Actions secret. The secret key and the model key are typed into Render, not into the repo. `NUXT_SUPABASE_SECRET_KEY` and `NUXT_MODEL_API_KEY` stay server-only. Supabase Auth still needs the public URL added to Site URL and Redirect URLs before sign-in mail uses that host. A failed Schema push or a failed Check does not deploy. The hook builds the tip of `main`, so a commit that is no longer the tip does not call the hook.
