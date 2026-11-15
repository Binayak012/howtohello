-- Wayword: one row of saved progress per learner.
-- Paste this into Supabase → SQL Editor → New query, then press Run.

create table if not exists public.learner_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Everything the game saves in the browser (completed chapters, traced letters, market visits…).
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- New tables aren't exposed automatically, so let signed-in learners use this one (and nothing for logged-out visitors).
grant select, insert, update on public.learner_progress to authenticated;
revoke all on public.learner_progress from anon;

-- Row-level security: a learner can only ever see and change their own row.
alter table public.learner_progress enable row level security;

drop policy if exists "Learners read their own progress" on public.learner_progress;
create policy "Learners read their own progress" on public.learner_progress
  for select using (auth.uid() = user_id);

drop policy if exists "Learners create their own progress" on public.learner_progress;
create policy "Learners create their own progress" on public.learner_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "Learners update their own progress" on public.learner_progress;
create policy "Learners update their own progress" on public.learner_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
