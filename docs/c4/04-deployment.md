# C4 Deployment

> [C4 index](README.md) / Deployment (supplementary)

The deployed server checks a submission by invoking the sandbox Lambda function in Sydney
(`ap-southeast-2`). A developer machine with no function name still runs the same image locally.
ADR 0011 records the Render service in Frankfurt; `render.yaml` still places that service in
Singapore, and this view follows `render.yaml` for the server.

## Developer machine

`NUXT_SANDBOX_FUNCTION` is blank, so this server runs the `colearner-sandbox` image with Docker.
That is the image the account owner pushes to the registry. Colours: blue is code in this repo,
brown is an external service, teal is a database.

```mermaid
flowchart TB
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef ext fill:#8a5a00,stroke:#5c3c00,color:#ffffff
  classDef db fill:#0f766e,stroke:#0a4f4a,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  subgraph dev["Developer machine (Windows, localhost)"]
    direction LR
    subgraph browser["Web browser (Chrome)"]
      direction TB
      spa["<b>Web app</b><br/>Vue 3, CodeMirror"]:::comp
      pyodide["<b>Python runner</b><br/>Pyodide, Web Worker"]:::comp
    end
    subgraph node["Node.js process: pnpm dev, port 3000"]
      server["<b>Turn and admin server</b><br/>Nuxt Nitro dev server"]:::comp
    end
    sandbox["<b>Sandbox</b><br/>colearner-sandbox image<br/>docker run, no network"]:::comp
  end

  subgraph supa["Supabase cloud project: VerifiableCoLearnerAgents"]
    direction TB
    auth["<b>Supabase Auth</b>"]:::ext
    db[("<b>Postgres database</b><br/>RLS")]:::db
  end

  subgraph llmhost["LLM provider: api.deepseek.com by default"]
    llm["<b>Chat completion API</b><br/>OpenAI-compatible"]:::ext
  end

  subgraph cdnhost["jsDelivr: cdn.jsdelivr.net"]
    cdn["<b>Pyodide files</b><br/>Static files"]:::ext
  end

  spa -->|"Loads pages, calls /turn<br/>HTTP localhost:3000"| server
  spa -->|"Posts code and tests<br/>postMessage"| pyodide
  spa -->|"Signs in and out, HTTPS"| auth
  pyodide -->|"Downloads the runtime, HTTPS"| cdn
  server -->|"Verifies the session, HTTPS"| auth
  server -->|"Reads and appends records<br/>supabase-js, secret key"| db
  server -->|"Requests moves and text, HTTPS"| llm
  server -->|"docker run: code and tests in,<br/>the report out"| sandbox

  style dev fill:none,stroke:#8b949e,stroke-dasharray:5 4
  style browser fill:none,stroke:#8b949e,stroke-dasharray:5 4
  style node fill:none,stroke:#8b949e,stroke-dasharray:5 4
  style supa fill:none,stroke:#8b949e,stroke-dasharray:5 4
  style llmhost fill:none,stroke:#8b949e,stroke-dasharray:5 4
  style cdnhost fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

## Evidence for each node

| Node | Evidence in the repo |
|---|---|
| Developer machine, `pnpm dev` on port 3000 | `web/README.md` ("pnpm dev"), `web/playwright.config.ts` (`baseURL` `http://localhost:3000`, command `pnpm dev --port 3000`) |
| Supabase cloud project | `web/.env.example` points `NUXT_PUBLIC_SUPABASE_URL` at a `*.supabase.co` URL; `web/README.md` says to use the team's Supabase project `VerifiableCoLearnerAgents`; `.mcp.json` points at the same project |
| LLM provider | `nuxt.config.ts` default `modelBaseUrl: https://api.deepseek.com`; the administrator can change the model on `/admin`. In production a saved address other than `https://api.deepseek.com` is refused |
| jsDelivr | `web/app/python/browser-worker.mjs` |
| Sandbox image | `sandbox/Dockerfile`, started by `web/server/sandbox/container.ts` as `colearner-sandbox` (`NUXT_SANDBOX_IMAGE` overrides the name). Build it with `docker build -t colearner-sandbox sandbox` |

## GitHub Actions

Three workflows live in `.github/workflows/`. `check.yml` and `schema-push.yml` do not deploy the server. `deploy.yml` calls the Render deploy hook after Schema push and Check succeed on `main`. The service is described in `render.yaml`.

| Workflow | When | What it runs | Credentials |
|---|---|---|---|
| `check.yml` | every pull request, and every push to `main` | In `web/`: `pnpm typecheck`, and `pnpm test` with `CHECK_SKIP_LIVE_SUPABASE=1`. Also `supabase db push --dry-run` against project ref `nopyjjyimtmvuucsirxb`, which does not write | `SUPABASE_ACCESS_TOKEN` for the dry-run only |
| `schema-push.yml` | every push to `main`, queued, not cancelled mid-run | `supabase db push` for project ref `nopyjjyimtmvuucsirxb` (`VerifiableCoLearnerAgents`), without `--include-seed`. The CLI opens a temporary login role from the access token | `SUPABASE_ACCESS_TOKEN` |
| `deploy.yml` | after Schema push succeeds on `main`, and only if Check for that commit also succeeded | Calls the Render deploy hook. A commit that is no longer the tip of `main` does not deploy | `RENDER_DEPLOY_HOOK` |

`check.yml` skips the Vitest files that sign in to the shared project (`*boundary*.test.ts` and `conversation-storage.test.ts`). Those still run from `pnpm test` on a machine that has `web/.env`. Playwright rehearsal is not in either workflow. A red Check does not block a merge until someone with admin marks the `typecheck`, `test`, and `migrations` jobs as required status checks. See ADR 0007. The Vitest migration files replay SQL in PGlite from an empty database. The dry-run is the check against the migration history of the shared project.

## Not part of the current setup

- **Local Supabase stack.** `supabase/config.toml` records the local Auth rules: sign-up off, email confirmation on, an email change confirmed by both addresses, anonymous sign-in off, and manual linking off. No code or env file points the running app at this stack.
- **Playwright rehearsal.** `pnpm rehearsal` starts its own dev server on :3000 with `NUXT_MODEL=fake`
  and resets demo accounts in the same cloud project using the secret key.

## Deployed: the sandbox in Sydney

The Render service in `render.yaml` sets `NUXT_SANDBOX_FUNCTION=colearner-sandbox` and
`NUXT_SANDBOX_REGION=ap-southeast-2`. `createSubmissionSandbox` then invokes that function and
uses the payload as the sandbox result. The function runs the image in `sandbox/`, in private
subnets with no outbound route. Its role can write its own log group (kept for seven days) and
the network interfaces Lambda needs to place it there. The server's access key is the IAM user
`colearner-server`, which can only invoke that function. At most five submissions run at once;
the sixth is told to try again in a moment and records no evidence. Terraform in `infra/sandbox`
describes this, with state in an S3 bucket in Sydney (`infra/terraform-state`) and a budget
alert at $50 a month. The account owner reviews and applies the plan. Nothing in preparing this
change is applied to the account.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef ext fill:#8a5a00,stroke:#5c3c00,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  subgraph render["Render web service: verifiable-co-learner"]
    server["<b>Turn and admin server</b><br/>Nuxt, region in render.yaml"]:::comp
  end

  subgraph sydney["AWS ap-southeast-2 (Sydney)"]
    direction TB
    registry["<b>Registry</b><br/>colearner-sandbox image"]:::ext
    sandbox["<b>Sandbox</b><br/>Lambda colearner-sandbox<br/>private subnets, no outbound route"]:::ext
  end

  server -->|"InvokeFunction: code and tests in,<br/>the report out"| sandbox
  registry -->|"Image"| sandbox

  style render fill:none,stroke:#8b949e,stroke-dasharray:5 4
  style sydney fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

| Node | Evidence in the repo |
|---|---|
| Render web service | `render.yaml` (`verifiable-co-learner`), `.github/workflows/deploy.yml` |
| Sandbox function in Sydney | `infra/sandbox` (`ap-southeast-2`, `colearner-sandbox`), `web/server/sandbox/lambda.ts`, `render.yaml` (`NUXT_SANDBOX_FUNCTION`, `NUXT_SANDBOX_REGION`) |
| Registry | `infra/sandbox` `aws_ecr_repository.sandbox`, image built from `sandbox/Dockerfile` |

## Open questions that remain

- Which Nitro preset the Render service uses. `nuxt.config.ts` sets none; `pnpm build` produces
  the Node server `render.yaml` starts.
- Whether Supabase stays as the managed cloud service or moves to AWS-hosted Postgres and auth.
  Moving off Supabase would change `web/server/storage/*`, `web/shared/student-id.ts`, the sign-in page
  and the RLS-based migrations, so it is a larger change than moving the server.
- Where the server secrets live (`NUXT_SUPABASE_SECRET_KEY`, `NUXT_MODEL_API_KEY`).
- Whether Pyodide stays on the public CDN or is self-hosted (matters for restricted networks).
