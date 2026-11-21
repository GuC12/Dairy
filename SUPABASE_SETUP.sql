-- ============================================================================
-- ATMOS_ // Схема базы данных Supabase для связки с Clerk Auth
-- Скопируйте и выполните этот скрипт в Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. Таблица профилей пользователей (синхронизируется при входе через Clerk)
create table if not exists public.profiles (
  id text primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- 2. Таблица папок дней дневника (хранит полный JSON записи, фото и палитру)
create table if not exists public.diary_entries (
  id text primary key,
  entry_id text not null,
  user_id text not null references public.profiles(id) on delete cascade,
  folder_name text not null,
  entry_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_diary_entries_user_id
  on public.diary_entries(user_id);

-- 3. Разрешаем доступ через публичный anon-ключ для клиентской синхронизации с Clerk ID
alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;

drop policy if exists "Allow public profiles upsert" on public.profiles;
create policy "Allow public profiles upsert"
  on public.profiles for all
  using (true)
  with check (true);

drop policy if exists "Allow public diary_entries access" on public.diary_entries;
create policy "Allow public diary_entries access"
  on public.diary_entries for all
  using (true)
  with check (true);
