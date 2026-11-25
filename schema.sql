create table if not exists public.santa_state (id integer primary key check(id=1), version integer not null default 0, data jsonb not null);
alter table public.santa_state enable row level security;
revoke all on public.santa_state from anon, authenticated;
insert into public.santa_state(id,data) values(1,'{"people":[{"name":"Мария","pair":1},{"name":"Александр","pair":1},{"name":"Алина","pair":2},{"name":"Михаил","pair":2},{"name":"Карина","pair":3},{"name":"Ильхам","pair":3}],"date":null,"budget":"","draw":null,"notified":[]}') on conflict do nothing;
