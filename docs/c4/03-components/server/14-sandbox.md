# Component: sandbox

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

Re-runs a submission with the exercise's tests. The evidence ledger records only that report.
A run in the browser is not evidence. `web/server/sandbox/` calls the container image in `sandbox/`.
Part of [server/00-overview.md](00-overview.md).

Legend: solid = runtime import, dashed = type-only import, thick = a process started with no import.
Blue = this component, grey = another part of this repo.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  turnRoute["<b>routes/turn.post.ts</b>"]:::near
  turn["<b>turn/handle-turn.ts</b>"]:::near
  image["<b>sandbox/</b><br/>Dockerfile, runner.py, child.py"]:::near

  subgraph box["sandbox"]
    direction TB
    iface["<b>index.ts</b><br/>Sandbox, createFakeSandbox"]:::comp
    messages["<b>messages.ts</b><br/>approved libraries, plain messages"]:::comp
    container["<b>container.ts</b><br/>createContainerSandbox"]:::comp
  end

  turnRoute -->|"createContainerSandbox"| iface
  turn -->|"couldNotCheck"| iface
  turn -.->|"type: Sandbox, SandboxReport"| iface
  iface --> messages
  iface --> container
  container --> messages
  container ==>|"docker run"| image

  style box fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

## Files

| File | Responsibility |
|---|---|
| `index.ts` | The `Sandbox` interface: `check({ code, tests })` returns `checked` with one result per test, or `refused` with a plain message. `createFakeSandbox` is what the turn tests use. |
| `messages.ts` | The approved libraries (`math`, `random`, `string`, `itertools`, `collections`, `datetime`, `re`, `statistics`, `functools`) and the plain messages for a library, for 10 seconds, for 512 MB and for 64 KB. |
| `container.ts` | Runs the image `colearner-sandbox` (or `runtimeConfig.sandboxImage`) with no network, a read-only root, a 512 MB memory cap and a process cap. A killed container is the memory message. Anything that is not a report is "This submission could not be checked." |
| `sandbox/runner.py` | The image entrypoint. Refuses a disallowed import by name before it runs. Starts `child.py` with the interpreter that is already running, an empty environment and a 10 second limit, then deletes the jail's temporary directory. |
| `sandbox/child.py` | Inside the image, enters the jail and drops privileges, then starts a further process for the student code. That process returns each test's actual value and does not receive the expected value. This process decides `passed` by comparing them, so a document the student writes on the output channel is not a pass. The same import list is enforced again around the student code. Output past 64 KB, and a memory error, come back as a refusal. |
| `sandbox/guard.py` | The approved list and the scan of `import`, `from` and a literal `__import__` or `import_module`. |
| `sandbox/Dockerfile` | CPython 3.12 and a jail that holds the interpreter and the standard library, and not the rest of the image. |

## What a report means

| Report | What the turn does |
|---|---|
| `checked` | Appends one evidence row from those results, stores the code, the per-test results and `passed` or `failed`, then the agents answer. The counts in the request are not read. |
| `refused` | Stores the code, no per-test results, and the message. Appends no evidence row, so mastery does not move. The student sees the message. The agents are not called. |

The owning student reads a stored submission through `POST /api/submission`. Another student is refused.

## Verified imports

- `index.ts` re-exports `messages.ts` and `container.ts`. `container.ts` imports `messages.ts` and spawns `docker`. It does not import the turn.
- Runtime importers: `routes/turn.post.ts` (`createContainerSandbox`), `turn/handle-turn.ts` (`couldNotCheck`).
- Type-only: `turn/handle-turn.ts` (`Sandbox`, `SandboxReport`).
- Tests: `sandbox-submission.test.ts` and `sandbox-runner.test.ts` (`createFakeSandbox` and the messages), `sandbox-image.test.ts` (the docker arguments and `interpretSandboxOutput`), `python-runner.test.ts` (the same refusal on Run and on the browser check).

## Notes

- Run stays in the browser. Submit is checked again here. When the two disagree, this report is the one that is stored (ADR 0010).
- The turn tests pass a fake sandbox and do not need an AWS account or a running image.
- The image tests in `sandbox-image.test.ts` build `sandbox/` and run it locally. They show that student code cannot reach the network, the environment or the file system, cannot spawn processes without a limit, and cannot see a file left by an earlier run in the same container. They are skipped when the Docker daemon is not running.
