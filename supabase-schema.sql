-- Run this whole script in Supabase Dashboard > SQL Editor.
-- Idempotent: safe to run multiple times.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  preferred_currency text not null default 'COP' check (preferred_currency in ('COP', 'USD', 'EUR', 'MXN')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  category text not null check (char_length(category) <= 80),
  description text not null check (char_length(description) <= 200),
  date timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  creditor text not null default '' check (char_length(creditor) <= 100),
  total_amount numeric(14, 2) not null check (total_amount > 0),
  remaining_amount numeric(14, 2) not null check (remaining_amount >= 0),
  interest_rate numeric(5, 2) not null default 0 check (interest_rate >= 0),
  minimum_payment numeric(14, 2) not null check (minimum_payment > 0),
  due_day integer not null default 1 check (due_day between 1 and 31),
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'paid', 'paused')),
  created_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  payment_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.savings_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  deadline date,
  months integer check (months > 0 and months <= 120),
  color text not null default 'violet' check (color in ('violet', 'blue', 'teal', 'rose', 'amber')),
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz not null default now()
);

-- For existing databases: add months column if missing
do $$ begin
  alter table public.savings_plans add column months integer check (months > 0 and months <= 120);
exception when duplicate_column then null;
end $$;

create table if not exists public.savings_deposits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.savings_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  deposit_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.savings_plans enable row level security;
alter table public.savings_deposits enable row level security;

-- profiles
drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update their profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- transactions
drop policy if exists "Users can read own transactions" on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can read own transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.transactions for delete using (auth.uid() = user_id);

-- debts
drop policy if exists "Users can read own debts" on public.debts;
drop policy if exists "Users can insert own debts" on public.debts;
drop policy if exists "Users can update own debts" on public.debts;
drop policy if exists "Users can delete own debts" on public.debts;
create policy "Users can read own debts" on public.debts for select using (auth.uid() = user_id);
create policy "Users can insert own debts" on public.debts for insert with check (auth.uid() = user_id);
create policy "Users can update own debts" on public.debts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own debts" on public.debts for delete using (auth.uid() = user_id);

-- debt_payments
drop policy if exists "Users can read own debt payments" on public.debt_payments;
drop policy if exists "Users can insert own debt payments" on public.debt_payments;
drop policy if exists "Users can delete own debt payments" on public.debt_payments;
create policy "Users can read own debt payments" on public.debt_payments for select using (auth.uid() = user_id);
create policy "Users can insert own debt payments" on public.debt_payments for insert with check (auth.uid() = user_id);
create policy "Users can delete own debt payments" on public.debt_payments for delete using (auth.uid() = user_id);

-- savings_plans
drop policy if exists "Users can read own savings plans" on public.savings_plans;
drop policy if exists "Users can insert own savings plans" on public.savings_plans;
drop policy if exists "Users can update own savings plans" on public.savings_plans;
drop policy if exists "Users can delete own savings plans" on public.savings_plans;
create policy "Users can read own savings plans" on public.savings_plans for select using (auth.uid() = user_id);
create policy "Users can insert own savings plans" on public.savings_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own savings plans" on public.savings_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own savings plans" on public.savings_plans for delete using (auth.uid() = user_id);

-- savings_deposits
drop policy if exists "Users can read own savings deposits" on public.savings_deposits;
drop policy if exists "Users can insert own savings deposits" on public.savings_deposits;
drop policy if exists "Users can delete own savings deposits" on public.savings_deposits;
create policy "Users can read own savings deposits" on public.savings_deposits for select using (auth.uid() = user_id);
create policy "Users can insert own savings deposits" on public.savings_deposits for insert with check (auth.uid() = user_id);
create policy "Users can delete own savings deposits" on public.savings_deposits for delete using (auth.uid() = user_id);

-- trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
