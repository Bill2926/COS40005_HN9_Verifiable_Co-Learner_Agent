-- A note gets back one optional image. The file lives in the student's own
-- folder of the student-files bucket, whose policies already let a student
-- read and write only that folder; this column holds its path in the folder.
alter table public.mindmap_notes add column if not exists image_path text;
