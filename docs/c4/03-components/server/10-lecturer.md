# Component: lecturer

`POST /api/lecturer` saves an owned course’s mastery threshold between 0.5 and 0.99. The Supabase function locks the course row and writes the change and history entry in the same transaction. History records the previous and new values, lecturer and time.

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

`GET /api/lecturer` verifies the Supabase session and passes its email to `handleLecturer`. The handler checks the lecturer allowlist and returns 401 for a missing session or 403 for an email outside the list.

The handler reads through `LecturerStore`. The Supabase adapter selects course IDs and titles by owner email, counts enrollments in Postgres and reads course history with the server key. The page receives the count, history, title and ID for each owned course.

The migration assigns the seeded Python course to the demo lecturer, records its first history entry, backfills enrollments and adds a trigger for new students. Supabase grants access to both tables to the server role. The handler tests use the memory store.

`GET /api/lecturer/spec` downloads the owned Python course's stored JSON spec. `POST /api/lecturer/spec` validates a complete spec and records the import with the lecturer and timestamp in the same transaction as the replacement. The next student turn reads the stored course again. The download is private to the owning lecturer and includes the hints, quiz answers and reference solutions.
