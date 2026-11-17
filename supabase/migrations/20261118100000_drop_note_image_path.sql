-- Notes no longer carry an image. No note ever had one saved, so the column
-- holds only nulls. Profile pictures still use the student-files bucket.
alter table public.mindmap_notes drop column if exists image_path;
