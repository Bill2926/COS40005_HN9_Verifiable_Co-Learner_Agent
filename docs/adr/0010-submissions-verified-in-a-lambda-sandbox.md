---
status: accepted
supersedes: 0002
---

# Submissions are verified in an isolated AWS Lambda sandbox, and only its result is evidence

ADR 0002 let the server trust the test counts the student's browser reported, so anyone calling the turn endpoint directly could master modules they had not passed. Now every submission's code is run again, with the exercise's tests, in a sandbox on AWS Lambda, and only that result is written to the evidence ledger. Runs stay in the browser under Pyodide: they produce no evidence and endanger only the student's own machine.

The sandbox is a Lambda function built from a container image holding CPython and nothing else the student may use. The security boundary is what the code can reach, not which imports it writes: the function has an IAM role with no AWS permissions beyond its own logs, sits in private subnets with no NAT so it has no network, and runs each submission in a fresh child process with an empty environment, limits on CPU time, memory, file size and new processes, its own temporary folder deleted afterwards, and any process left over killed before it replies. Limits per submission: 10 seconds for all tests, 512 MB, 64 KB of output, each with a plain message to the student. Only approved libraries can be imported: a check of the imports before the run gives a clear refusal, and an import hook in the child enforces the same list, but these are course policy, not the boundary. The first list is `math`, `random`, `string`, `itertools`, `collections`, `datetime`, `re`, `statistics` and `functools`; the development team changes it only by a reviewed pull request that rebuilds the image.

## Considered Options

- **Pyodide on Node, in the Nuxt server or in Lambda**: rejected. Python reaching `ctypes` and Emscripten's exported `emscripten_run_script` gets full Node access; this was shown in 2026 across seven products with four CVEs, and import deny-lists did not stop it. It would also need the same OS-level isolation, while starting a fresh instance takes seconds.
- **Run the sandbox inside the Render server**: rejected. Untrusted code would run beside the Supabase secret key and the model key.
- **Restrict imports and call it a sandbox**: rejected. `__import__`, `importlib`, introspection and `ctypes` all bypass it.

## Consequences

The AWS account our university provides allows Lambda, ECR, VPC and S3 only in `ap-southeast-2` (Sydney): an organisation policy denies every other region. So the sandbox runs in Sydney even though the server and database are in Europe, which adds roughly 300 ms to each submission. The function receives code and tests and stores nothing, and its logs never contain code. The account allows 5 concurrent Lambda executions in total, so the server allows at most 5 submissions in flight and gives a "try again in a moment" reply beyond that, until a quota increase is granted. Lambda reuses warm environments between students, which is why the per-run child process and clean-up are mandatory, not optional. The browser and the sandbox use the same Python minor version so results agree; when they disagree, the sandbox wins.
