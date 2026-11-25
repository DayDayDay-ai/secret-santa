-- Run before deploying v2. Safe to run again; preserves an existing draw.
begin;
create table if not exists public.santa_first_draw (
 id integer primary key check(id=1),
 distribution jsonb not null,
 participants jsonb not null,
 reveal_at jsonb not null,
 saved_at timestamptz not null default now()
);
alter table public.santa_first_draw enable row level security;
revoke all on public.santa_first_draw from public, anon, authenticated, service_role;
grant select on public.santa_first_draw to service_role;
create or replace function public.santa_preserve_draw() returns trigger
language plpgsql security definer set search_path = '' as $$
declare archived public.santa_first_draw%rowtype; roster jsonb;
begin
  select jsonb_agg(jsonb_build_object('name',p->'name','pair',p->'pair') order by ord)
    into roster from jsonb_array_elements(new.data->'people') with ordinality as x(p,ord);
  select * into archived from public.santa_first_draw where id=1;
  if found then
    if roster is distinct from archived.participants then raise exception 'First draw roster is locked'; end if;
    new.data := jsonb_set(jsonb_set(new.data,'{draw}',archived.distribution),'{date}',archived.reveal_at);
  elsif jsonb_typeof(new.data->'draw')='array' then
    insert into public.santa_first_draw(id,distribution,participants,reveal_at)
      values(1,new.data->'draw',roster,coalesce(new.data->'date','null'::jsonb));
  end if;
  return new;
end; $$;
drop trigger if exists santa_preserve_draw on public.santa_state;
create trigger santa_preserve_draw before insert or update on public.santa_state
for each row execute function public.santa_preserve_draw();
update public.santa_state set data=data where id=1;
revoke delete, truncate on public.santa_state from service_role;
commit;
