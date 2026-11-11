alter table public.conversations rename column topic_id to module_id;
alter table public.resume_points rename column topic_id to module_id;

alter table public.conversations
  rename constraint conversations_student_id_topic_id_key to conversations_student_id_module_id_key;
