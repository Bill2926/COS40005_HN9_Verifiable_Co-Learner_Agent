# Component: lecturer

`POST /api/lecturer` saves an owned course’s mastery threshold between 0.5 and 0.99. The Supabase function locks the course row and writes the change and history entry in the same transaction. History records the previous and new values, lecturer and time.

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

`GET /api/lecturer` verifies the Supabase session and passes its email to `handleLecturer`. The handler checks the lecturer allowlist and returns 401 for a missing session or 403 for an email outside the list.

The handler reads through `LecturerStore`. The Supabase adapter selects course IDs and titles by owner email, counts enrollments in Postgres and reads course history with the server key. The page receives the count, history, title and ID for each owned course.

The course also carries its enrolled students: display name, student number, email and enrollment date. The Supabase adapter reads the course's enrollments and resolves each student through the `student_directory` view, which joins the student profile to the account email. It never reads code, conversations, mastery or activity, and staff have no student number so they never appear.

The migration assigns the seeded Python course to the demo lecturer, records its first history entry, backfills enrollments and adds a trigger for new students. Supabase grants access to both tables to the server role. The handler tests use the memory store.

`GET /api/lecturer/spec` downloads the owned Python course's published JSON spec. `?draft=1` returns the course draft (or `null`), and `?draft=1&download=1` downloads it as a file (404 when there is none). `POST /api/lecturer/spec` with a course spec JSON saves it as the course draft and does not change what students see. Publish sends that draft through `import_course_spec`, which validates it and records one course history entry, then clears the draft; publishing with no draft is a 400 and writes no history. `POST` with `{event: 'save', spec}` saves the editor's draft through the same validation, and `{event: 'discard'}` clears it. Every action returns 401 without a session and 403 for an email outside the lecturer allowlist, before the store is touched. The `draft` column of `courses` is, like `spec`, not readable or writable by `anon` or `authenticated` (courses boundary test). `?preview=1` returns the draft as a student would see it, with teacher-only fields marked, and writes nothing. The download is private to the owning lecturer and includes the hints, quiz answers and reference solutions.
