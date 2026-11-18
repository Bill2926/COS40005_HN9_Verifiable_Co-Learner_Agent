-- Each Teacher decision keeps the tools the agent called before its move: the tool's name, the
-- input the model gave and a short summary of the result. Rows recorded before this change keep
-- null, which the product owner's decision review reads as "not recorded" rather than "none".

alter table public.decisions
  add column if not exists tool_trace jsonb;

alter table public.decisions
  drop constraint if exists decisions_tool_trace_array;

alter table public.decisions
  add constraint decisions_tool_trace_array
  check (tool_trace is null or jsonb_typeof(tool_trace) = 'array');
