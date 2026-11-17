# A lecturer edits a course draft that is published whole

A lecturer can now change a course in a structured editor, not only by importing a file. The editor works on a course draft, and import and export load into the same draft. Publishing sends the whole draft through the same validation and course history path as an import. This changes ADR 0004's "edit modules one by one: rejected for now". Lecturers found editing raw JSON hard. Publishing whole keeps 0004's guarantees: one validated spec, one history entry per change, and nothing half-applied that a student could see.

## Considered Options

- **Keep import-only**: rejected. A lecturer has to hand-edit JSON to fix one hint.
- **Save each field as it is edited**: rejected. Students would see half-edited modules, every field would need its own rules for partial states, and course history would fill with tiny entries.

## Consequences

For the MVP, publishing does not yet protect modules students have worked on. A published draft may delete, rename or reorder modules that already have evidence or unlocks. Before real students use the app, publishing (and import) should reject that: module ids are fixed once published, and a module with evidence loses its content and stays closed as not available instead of being deleted.

The draft never reaches students. Preview and validation run against the draft. The spec stays the one format for export, import and storage.
