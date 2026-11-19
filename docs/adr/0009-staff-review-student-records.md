---
status: accepted
---

# Lecturers and administrators may review a student's code, conversations and activity

Until now no member of staff saw a student's code, conversations or mastery, and no screen showed the activity log. That changes: a lecturer may review the submissions (with their code), attempts, activity log, conversations, learning pattern and review signals of the students enrolled in a course they own, and an administrator may review those of any student. Our supervisor asked for this so staff can supervise learning and look into possible academic misconduct with the evidence in front of them. A student still never sees another student's anything, and never sees review signals or the raw activity log.

Three rules keep this from becoming surveillance by default. Every time staff open a student's records, the staff access log records who, which student, what and when, and only administrators can read that log. Review signals ("a large paste", "a full solution with no runs before it") are prompts for a person to look, never a verdict, and never change mastery. Students are told plainly, on Home and the profile, that their activity, submitted code and conversations are recorded and that their lecturers and administrators can review them.

## Considered Options

- **Keep staff out of student work** (the previous rule): rejected. Staff could not tell genuine engagement from copied solutions, which the supervisor requires.
- **Show staff only aggregates or automatic misconduct scores**: rejected. An aggregate hides the evidence a fair review needs, and an automatic score would be read as an accusation.
- **Let staff read through RLS policies in the database**: rejected for now. Staff roles come from the server's email allow-lists, which the database cannot see. Staff reads go through one server component that checks the role and course ownership and writes the staff access log. Students' own reads are what RLS enforces.

## Consequences

Submission code is now stored; it was never stored before. The lecturer and administrator descriptions in `CONTEXT.md` changed, and "product owner" is now "administrator". Records are kept until the end of the teaching period plus one review period, and an administrator can delete one student's records completely, but never edit a single ledger row. A staff role must come from a confirmed email that the student cannot set: sign-up is disabled and email changes need confirmation from both addresses, so a student cannot turn themselves into staff.

The hosted project's Auth rules are not managed by Terraform. This repository has no Terraform configuration and no imported Supabase Auth state, so there is no plan to compare. The account owner sets the rules in the Supabase dashboard for `VerifiableCoLearnerAgents`: sign-up off, email confirmation on, an email change confirmed by both the old and the new address, anonymous sign-in off, and manual account linking off. `supabase/config.toml` records the same rules for a local stack. The demo staff passwords are not in the README or the seed. The account owner sets new ones in the team password manager and in the GitHub Actions secrets `DEMO_OWNER_PASSWORD` and `DEMO_LECTURER_PASSWORD`, then changes the live `owner@example.com` and `lecturer@example.com` accounts to those passwords. The previous passwords remain in git history until that change.
