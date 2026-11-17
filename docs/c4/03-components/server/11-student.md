# Component: student

The student handler answers `POST /api/student`. It is the server side of a student's profile, mindmap and the actions the browser reports: signing in, opening a module, switching mode or layout, and running code. It never reads or writes evidence, so none of these actions change mastery.

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

The handler receives one activity recorder, the same one the turn handler receives. A message, submission or quiz answer is recorded on the turn. A run is recorded here, and the payload never includes the code. Profile changes, notes and mindmap moves are recorded here too. A request marked as a preview writes nothing.

Profile pictures and note images go in the private `student-files` bucket, one folder per student. The browser receives a signed URL. The student number is read with the profile and cannot be changed on this handler.

Notes, links and module positions are stored per student and course. A note, a link or a module position is written on its own, so saving one does not rewrite the others. Linking a note to the same module again changes nothing. Row-level security lets a student read only their own rows. Agents are not given the notes.
