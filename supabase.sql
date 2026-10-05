-- Ejecutar una sola vez en Supabase > SQL Editor.
create table if not exists public.patito_scores (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[A-Z]{1,3}$'),
  score integer not null check (score between 0 and 9999999),
  created_at timestamptz not null default now()
);

create index if not exists patito_scores_top_idx
  on public.patito_scores (score desc, created_at asc);

alter table public.patito_scores enable row level security;

drop policy if exists "Cualquiera puede ver puntuaciones" on public.patito_scores;
create policy "Cualquiera puede ver puntuaciones"
  on public.patito_scores for select to anon, authenticated
  using (true);

drop policy if exists "Cualquiera puede registrar puntuaciones" on public.patito_scores;
create policy "Cualquiera puede registrar puntuaciones"
  on public.patito_scores for insert to anon, authenticated
  with check (name ~ '^[A-Z]{1,3}$' and score between 0 and 9999999);

grant usage on schema public to anon, authenticated;
grant select (name, score, created_at), insert (name, score)
  on public.patito_scores to anon, authenticated;
grant usage on sequence public.patito_scores_id_seq to anon, authenticated;
