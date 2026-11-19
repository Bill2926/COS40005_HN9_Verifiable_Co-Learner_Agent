---
status: accepted
---

# Where student data is stored and processed

Student data is stored in the Supabase project in `eu-west-1` (Ireland), which is where it already is. The Nuxt server moves from Render's Singapore region to Frankfurt, so the many database queries in each turn stay within Europe instead of crossing to Ireland and back from Asia. The only AWS workload is the submission sandbox (ADR 0010), in `ap-southeast-2` (Sydney), because the university's AWS organisation allows compute nowhere else; it keeps no data. The agents keep using the university-provided DeepSeek API (`api.deepseek.com`, model `deepseek-flash`), which costs us nothing extra and already works with the move proposals and streamed replies.

This is a capstone project for demonstration and assessment: every student account, submission, conversation and activity record is simulated, and no real student's academic record is processed. That is why the DeepSeek API is acceptable, although it is the weakest point for privacy. DeepSeek's Open Platform privacy policy (published 4 November 2026) says data is stored in the People's Republic of China, kept for as long as necessary with no fixed period, and that inputs and outputs may be used, de-identified, to train its models unless there is a separate written agreement. We limit what reaches it: prompts carry course content, the current module's conversation, the student's code and test results, and the Teacher's learning pattern, but never a name, email or student number. Each request carries a pseudonymous per-student `user_id`, which DeepSeek uses to keep one student's cached context apart from another's. The production model settings accept only the allowed provider address, so an administrator account cannot redirect students' prompts elsewhere. Students are told that their conversations are processed by DeepSeek.

## Considered Options

- **Amazon Bedrock with Claude through the EU profile** (data stays in the EU, no retention, about $20–45 per 1,000 turns): not adopted, because the university API meets the functional needs at no cost and the data is simulated. The organisation's policy does allow Bedrock calls from `eu-central-1`, so it is the path to take if the system is ever piloted with real students.
- **AWS in the EU next to the server and database**: not possible; the organisation policy denies Lambda, ECR, VPC and S3 outside Sydney.
- **Move Supabase to Asia**: rejected. It means a new project and moving the data, and Europe already holds everything else.

## Consequences

A pilot with real students would reopen this decision before it starts, together with the learner-approval risk (R2) in the Sprint 1 report. This supersedes the "AWS stays undesigned" line in ADR 0008. The deployment diagram gains Frankfurt for Render and Sydney for the sandbox. If the provider changes to Bedrock later, the language-model layer gains a provider, the production allow-list changes, and this ADR is replaced.
