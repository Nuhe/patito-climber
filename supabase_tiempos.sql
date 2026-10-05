-- Ejecutar una vez en Supabase > SQL Editor, sobre el mismo proyecto.
-- Conserva las puntuaciones anteriores, pero el nuevo ranking muestra solo tiempos.
alter table public.patito_scores
  add column if not exists time_ms integer check (time_ms between 1 and 3600000);

create index if not exists patito_scores_fastest_idx
  on public.patito_scores (time_ms asc, created_at asc)
  where time_ms is not null;

alter table public.patito_scores enable row level security;
revoke all on table public.patito_scores from anon, authenticated;
grant select (name, time_ms, created_at), insert (name, score, time_ms)
  on public.patito_scores to anon, authenticated;

drop policy if exists "Cualquiera puede registrar puntuaciones" on public.patito_scores;
drop policy if exists "Cualquiera puede registrar tiempos completados" on public.patito_scores;
create policy "Cualquiera puede registrar tiempos completados"
  on public.patito_scores for insert to anon, authenticated
  with check (
    name ~ '^[A-Z]{1,3}$'
    and score = 0
    and time_ms between 1 and 3600000
  );

notify pgrst, 'reload schema';

select 'supabase_tiempos.sql' as migration,
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'patito_scores'
           and column_name = 'time_ms'
       ) as time_ms_created;
