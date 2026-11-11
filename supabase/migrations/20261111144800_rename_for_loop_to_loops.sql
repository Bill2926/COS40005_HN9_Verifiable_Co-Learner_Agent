update public.conversations
set module_id = 'loops'
where module_id = 'for_loop';

update public.resume_points
set module_id = 'loops'
where module_id = 'for_loop';

update public.messages
set approved_move = replace(approved_move, 'for_loop', 'loops')
where approved_move like '%for_loop%';
