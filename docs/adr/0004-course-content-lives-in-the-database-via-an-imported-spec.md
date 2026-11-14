# Course content lives in the database, put there by importing a course spec

Course content (parts, modules, materials, quizzes, exercises, hint ladders, misconception responses and out-of-course keywords) moves out of the TypeScript in `web/server/course/modules/` into the database, and the only way to change it is for a lecturer to import a whole course spec. This lets a lecturer add or change a course without a code change and a deploy, while one declarative file keeps the course reviewable and exportable as a unit. The Introduction to Programming with Python course becomes the first spec and is seeded from it.

## Considered Options

- **Keep content in the repo as code**: rejected. Every course change would need a developer and a deploy, and a lecturer could never own a course.
- **Edit modules one by one in a lecturer UI**: rejected for now. It needs per-field forms and partial-state rules; a whole-file import is far smaller, and export-edit-reimport covers the same need.

## Consequences

Teacher-only content (hint ladder, misconception responses, reference solutions, the correct quiz choice) now sits in a table, so it must be readable only by the server and by the lecturer exporting the spec, never by `anon` or `authenticated`. A spec carries a `specVersion` so the format can change later without breaking stored courses.
