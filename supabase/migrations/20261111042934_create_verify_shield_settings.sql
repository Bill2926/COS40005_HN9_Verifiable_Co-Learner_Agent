create table public.verify_shield_settings (
  id integer primary key default 1,
  enabled boolean not null default true,
  constraint verify_shield_settings_singleton check (id = 1)
);

alter table public.verify_shield_settings enable row level security;

grant select, insert, update, delete on table public.verify_shield_settings to anon, authenticated;
grant all on table public.verify_shield_settings to service_role;

revoke truncate, trigger, references on table public.verify_shield_settings from anon, authenticated;
