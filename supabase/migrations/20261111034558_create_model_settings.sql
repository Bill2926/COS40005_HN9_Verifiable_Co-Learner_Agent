create table public.model_settings (
  id integer primary key default 1,
  provider text not null,
  api_key text not null default '',
  base_url text not null default '',
  model_name text not null default '',
  constraint model_settings_singleton check (id = 1),
  constraint model_settings_provider check (provider in ('real', 'fake'))
);

alter table public.model_settings enable row level security;

grant select, insert, update, delete on table public.model_settings to anon, authenticated;
grant all on table public.model_settings to service_role;

revoke truncate, trigger, references on table public.model_settings from anon, authenticated;
