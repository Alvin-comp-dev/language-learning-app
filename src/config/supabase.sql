-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- User progress table
create table if not exists user_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  total_xp integer default 0,
  current_level text not null check (current_level in ('BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED')),
  completed_lessons text[] default array[]::text[],
  lesson_progress jsonb default '{}'::jsonb,
  streak_days integer default 0,
  last_practice_date timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id)
);

-- Lesson results table
create table if not exists lesson_results (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  lesson_id text not null,
  completed boolean default false,
  score integer not null check (score >= 0 and score <= 100),
  pronunciation_score integer check (pronunciation_score >= 0 and pronunciation_score <= 100),
  grammar_score integer check (grammar_score >= 0 and grammar_score <= 100),
  vocabulary_score integer check (vocabulary_score >= 0 and vocabulary_score <= 100),
  duration integer not null, -- in seconds
  mistakes jsonb default '[]'::jsonb,
  feedback jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index if not exists idx_user_progress_user_id on user_progress(user_id);
create index if not exists idx_lesson_results_user_id on lesson_results(user_id);
create index if not exists idx_lesson_results_lesson_id on lesson_results(lesson_id);
create index if not exists idx_lesson_results_created_at on lesson_results(created_at);

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger update_user_progress_updated_at
  before update on user_progress
  for each row
  execute function update_updated_at_column();

-- Row Level Security (RLS) policies
alter table user_progress enable row level security;
alter table lesson_results enable row level security;

-- Users can only read and update their own progress
create policy "Users can view own progress"
  on user_progress for select
  using (auth.uid() = user_id);

create policy "Users can update own progress"
  on user_progress for update
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on user_progress for insert
  with check (auth.uid() = user_id);

-- Users can only read and create their own lesson results
create policy "Users can view own lesson results"
  on lesson_results for select
  using (auth.uid() = user_id);

create policy "Users can create own lesson results"
  on lesson_results for insert
  with check (auth.uid() = user_id);

-- Function to get user statistics
create or replace function get_user_statistics(p_user_id uuid)
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_lessons_completed', (
      select array_length(completed_lessons, 1)
      from user_progress
      where user_id = p_user_id
    ),
    'average_score', (
      select round(avg(score))
      from lesson_results
      where user_id = p_user_id
    ),
    'total_practice_time', (
      select sum(duration)
      from lesson_results
      where user_id = p_user_id
    ),
    'current_streak', (
      select streak_days
      from user_progress
      where user_id = p_user_id
    ),
    'lessons_by_difficulty', (
      select jsonb_object_agg(
        difficulty,
        count(*)
      )
      from (
        select 
          case
            when score >= 90 then 'mastered'
            when score >= 70 then 'completed'
            else 'in_progress'
          end as difficulty,
          count(*)
        from lesson_results
        where user_id = p_user_id
        group by difficulty
      ) t
    )
  ) into result;
  
  return result;
end;
$$ language plpgsql security definer; 