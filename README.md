# Verifiable Co-Learner Agent

A web-based co-learner for first-year students learning Python. A teacher agent and a deskmate agent help the student learn deeper, not just faster, and a deterministic VerifyShield rules on every agent move before the student sees it.

The app is a Nuxt 4 project in [`web/`](web/). It stores its data in a Supabase project (Auth and Postgres) and asks an OpenAI-compatible language model for the agents' moves. Student code runs in the browser with Pyodide.

## Installation

### 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| [Git](https://git-scm.com/) | any recent | cloning the repo |
| [Node.js](https://nodejs.org/) | 22 or newer (developed on 24) | running the app |
| [pnpm](https://pnpm.io/installation) | 10 or newer (developed on 12) | installing dependencies |
| A Supabase project | | sign-in and storage |
| An OpenAI-compatible API key | optional | real agent replies; without one, use the fake model |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | optional | only if you set up your own Supabase project |

### 2. Clone and install

```bash
git clone https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent.git
cd COS40005_HN9_Verifiable_Co-Learner_Agent/web
pnpm install
```

All app commands below run from `web/`.

### 3. Configure the environment

```bash
cp .env.example .env
```

Then fill in `web/.env`:

| Variable | What to put there |
|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | The Supabase project URL. Already set to the team project, `VerifiableCoLearnerAgents`. |
| `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key, from the Supabase dashboard under Project Settings, API Keys. |
| `NUXT_SUPABASE_SECRET_KEY` | The project's secret key, from the same page. Server only: never commit it and never prefix it with `NUXT_PUBLIC_`. |
| `NUXT_MODEL` | `real` to call a language model, or `fake` for the scripted Teacher and Deskmate with no network and no key. |
| `NUXT_MODEL_API_KEY` | Your model provider's API key. Only needed when `NUXT_MODEL=real`. |
| `NUXT_MODEL_BASE_URL`, `NUXT_MODEL_NAME` | The provider's base URL and model name. Default to DeepSeek. |
| `NUXT_ADMIN_EMAILS` | Comma-separated emails that may open `/admin`. |
| `LECTURER_EMAILS` | Comma-separated emails that may open `/lecturer`. |
| `NUXT_VERIFYSHELD` | `on` by default. `off`, `false` or `0` switches the VerifyShield off for every student. |

To try the app without a model key, set `NUXT_MODEL=fake`. The Supabase keys are required either way.

Team members get the Supabase keys from the `VerifiableCoLearnerAgents` project dashboard. If you do not have access to it, see [Using your own Supabase project](#using-your-own-supabase-project).

### 4. Run the app

```bash
pnpm dev
```

Open <http://localhost:3000> and sign in with one of the demo accounts:

| Who | Email | Password | Where to look |
|---|---|---|---|
| An, a student starting Module 1 | an@example.com | an-demo-password | `/` |
| Bình, a student starting Module 5 | binh@example.com | binh-demo-password | `/` |
| Administrator | owner@example.com | set by the account owner | `/admin` |
| Lecturer | lecturer@example.com | set by the account owner | `/lecturer` |

The administrator and lecturer passwords are not in this repository. The account owner keeps the new ones in the team password manager and in the GitHub Actions secrets `DEMO_OWNER_PASSWORD` and `DEMO_LECTURER_PASSWORD`. A rehearsal reads those names from the environment or from `web/.env`.

The administrator can change the language model on `/admin` without a restart. A choice saved there replaces the `NUXT_MODEL*` values in `.env`.

### Using your own Supabase project

The schema and the demo accounts live in [`supabase/`](supabase/). To build them in a project of your own:

1. Create a project at [supabase.com](https://supabase.com/dashboard) and note its project ref.
2. From the repo root, link it and apply the migrations and the seed:

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push --include-seed
   ```

3. In `web/.env`, set `NUXT_PUBLIC_SUPABASE_URL` to `https://<your-project-ref>.supabase.co` and fill in that project's publishable and secret keys.

## Checking your setup

```bash
pnpm test        # unit and integration tests (Vitest)
pnpm typecheck   # type checking
pnpm rehearsal   # end-to-end demo rehearsal (Playwright, Chromium)
```

Run the fixed 29-prompt VerifyShield comparison with `pnpm benchmark`. It writes paired verdicts to
`web/benchmark/results/latest.md` and `latest.json`. The [benchmark guide](web/benchmark/README.md)
describes its scripted proposals, starting states and the recorded Sprint 1 demo prompt.

`pnpm rehearsal` starts its own dev server on port 3000 with the fake model, so stop `pnpm dev` first. It resets the demo accounts in the Supabase project that `.env` points at.

To walk the demonstration on the public site instead, run `REHEARSAL_URL=<public URL> pnpm rehearsal:public`. The site has to run the scripted agents. See [deployment](docs/c4/04-deployment.md#rehearsal-against-the-public-url).

To make a production build, run `pnpm build`, then `pnpm preview` to serve it locally.

## Troubleshooting

- **A turn stops and names a field to fix.** `NUXT_MODEL=real` needs the API key, base URL and model name all filled in. Fill in the named field, or set `NUXT_MODEL=fake`.
- **Sign-in fails for the demo accounts.** The Supabase project has not been seeded, or `.env` points at a different project. Check the URL and keys, then apply `supabase/seed.sql`.
- **`/admin` or `/lecturer` refuses you.** Your email is not in `NUXT_ADMIN_EMAILS` or `LECTURER_EMAILS`. Restart `pnpm dev` after editing `.env`.
- **The code editor cannot run Python.** The Python runner downloads Pyodide from `cdn.jsdelivr.net`, so the browser needs internet access.

## Repository layout

| Path | What is there |
|---|---|
| [`web/`](web/) | The Nuxt app: `app/` (pages and components), `server/` (turn, VerifyShield, agents, course, student model), `tests/`, `e2e/` |
| [`supabase/`](supabase/) | Database migrations and the demo seed |
| [`docs/c4/`](docs/c4/README.md) | C4 architecture: context, containers, components, deployment |
| [`docs/adr/`](docs/adr/) | Architecture decision records |
| [`CONTEXT.md`](CONTEXT.md) | The project's domain language |

The `pyproject.toml` at the repo root is for the research tooling (literature search scripts) and is not needed to run the app.

More detail on the web app, including how mastery and the VerifyShield switch work, is in [`web/README.md`](web/README.md).
