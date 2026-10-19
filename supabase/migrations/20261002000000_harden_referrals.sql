-- Hardens the referral system. Run once in the Supabase SQL editor
-- (or `supabase db push`) BEFORE deploying the matching server code.

-- Referral codes: direct lookup instead of scanning every auth user.
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
drop policy if exists "Users can view own referral code" on public.referral_codes;
create policy "Users can view own referral code" on public.referral_codes
  for select to authenticated using (auth.uid() = user_id);

-- Backfill existing users with their legacy code (first 8 hex chars of the uuid),
-- so links that were already shared keep working.
insert into public.referral_codes (user_id, code)
select id, left(replace(id::text, '-', ''), 8) from auth.users
on conflict do nothing;

-- One referral per referred user; rewards are granted after their first search, not on insert.
alter table public.referrals alter column rewarded set default false;
alter table public.referrals drop constraint if exists referrals_referred_user_id_key;
alter table public.referrals add constraint referrals_referred_user_id_key unique (referred_user_id);

-- Lock writes down: only the server (service role) may write these tables.
-- The old "Users can upsert own bonus" policy let any signed-in user set their own bonus_count.
drop policy if exists "Users can upsert own bonus" on public.bonus_searches;
drop policy if exists "Users can insert referrals" on public.referrals;
revoke insert, update, delete, truncate on public.bonus_searches, public.referrals, public.referral_codes
  from anon, authenticated;

-- Atomically reward a pending referral once the referred user has run a search.
-- Returns true if the referrer was credited. Referrers stop earning after p_max_rewarded.
create or replace function public.reward_referral(p_referred uuid, p_bonus int, p_max_rewarded int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_rewarded_count int;
begin
  update referrals set rewarded = true
   where referred_user_id = p_referred and rewarded = false
   returning referrer_id into v_referrer;
  if v_referrer is null then
    return false;
  end if;

  -- Serialize concurrent rewards for the same referrer so the cap can't be raced.
  perform pg_advisory_xact_lock(hashtext(v_referrer::text));

  select count(*) into v_rewarded_count
    from referrals where referrer_id = v_referrer and rewarded = true;
  if v_rewarded_count > p_max_rewarded then
    return false;
  end if;

  insert into bonus_searches (user_id, bonus_count, updated_at)
  values (v_referrer, p_bonus, now())
  on conflict (user_id) do update
    set bonus_count = bonus_searches.bonus_count + excluded.bonus_count,
        updated_at = now();
  return true;
end;
$$;
revoke all on function public.reward_referral(uuid, int, int) from public, anon, authenticated;
grant execute on function public.reward_referral(uuid, int, int) to service_role;
