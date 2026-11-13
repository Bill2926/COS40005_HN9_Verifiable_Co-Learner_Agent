update public.messages
set approved_move = regexp_replace(approved_move, '^advance_to_item:', 'advance_to_module:')
where starts_with(approved_move, 'advance_to_item:');

update public.decisions
set proposed_move = regexp_replace(proposed_move, '^advance_to_item:', 'advance_to_module:'),
    ruled_move = regexp_replace(ruled_move, '^advance_to_item:', 'advance_to_module:'),
    reason_code = case
      when reason_code = 'VERIFYSHELD_OFF' then 'VERIFYSHIELD_OFF'
      else reason_code
    end
where starts_with(proposed_move, 'advance_to_item:')
   or starts_with(ruled_move, 'advance_to_item:')
   or reason_code = 'VERIFYSHELD_OFF';
