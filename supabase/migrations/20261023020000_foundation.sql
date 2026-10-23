-- Phase 0 foundation: the six tables every later feature builds on.
-- See plans/2026-10-22-phase-0-part-b-database.md for the trust model.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Keeps updated_at honest without every write remembering to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The client a session is scoped to. Part E mints a JWT with this claim after
-- the HighLevel SSO payload is verified. Never comes from the URL or browser.
create or replace function public.current_client_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'client_id', '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- staff: the allowlist of people who may use the admin app
-- ---------------------------------------------------------------------------

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique check (email = lower(email)),
  name text not null,
  role text not null check (role in ('owner', 'team')),
  -- A checklist, so new permissions are a config change not a migration.
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff is 'Owner and team allowlist for the admin app. auth_user_id links on first OTP login.';

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- These read public.staff, so SQL-language functions must be created after the table exists.
-- A signed-in Supabase Auth user who has an active staff row.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff
    where staff.auth_user_id = auth.uid()
      and staff.active
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff
    where staff.auth_user_id = auth.uid()
      and staff.active
      and staff.role = 'owner'
  );
$$;

revoke execute on function public.is_staff() from anon;
revoke execute on function public.is_owner() from anon;


-- ---------------------------------------------------------------------------
-- clients: one per HighLevel location
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  ghl_location_id text not null unique,
  ghl_company_id text,
  name text not null,
  niche text check (niche in ('health', 'service')),
  practice_model text check (practice_model in ('brick_and_mortar', 'hybrid', 'online')),
  status text not null default 'onboarding_not_started'
    check (status in ('onboarding_not_started', 'onboarding_in_progress', 'onboarding_complete', 'active', 'paused', 'churned')),
  -- What HighLevel reports for the SaaS subscription. Exact field is PRD open question 2.
  saas_status text,
  stripe_customer_id text,
  timezone text,
  website_url text,
  monthly_budget_usd numeric(10, 2) not null default 50.00 check (monthly_budget_usd >= 0),
  alert_threshold numeric(3, 2) not null default 0.80 check (alert_threshold > 0 and alert_threshold <= 1),
  hard_stop_threshold numeric(3, 2) not null default 1.00 check (hard_stop_threshold > 0 and hard_stop_threshold <= 1),
  -- HighLevel write-back is off until Tom turns it on per client.
  write_back_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clients is 'One row per HighLevel sub-account that has the app installed.';

create index clients_status_idx on public.clients (status);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ghl_installations: OAuth tokens per location. Secret key only.
-- ---------------------------------------------------------------------------

create table public.ghl_installations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ghl_location_id text not null unique,
  ghl_company_id text,
  ghl_user_id text,
  -- Encrypted in application code with GHL_TOKEN_ENCRYPTION_KEY before insert.
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  last_refreshed_at timestamptz,
  last_refresh_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ghl_installations is 'HighLevel OAuth tokens, encrypted at rest. No RLS policies on purpose: only the secret key reads this.';

create index ghl_installations_client_id_idx on public.ghl_installations (client_id);
create index ghl_installations_expiry_idx on public.ghl_installations (token_expires_at) where uninstalled_at is null;

create trigger ghl_installations_set_updated_at
  before update on public.ghl_installations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_users: HighLevel users who have opened the app
-- ---------------------------------------------------------------------------

create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ghl_user_id text not null,
  name text,
  email text,
  role text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, ghl_user_id)
);

create trigger client_users_set_updated_at
  before update on public.client_users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- usage_events: every AI call and what it cost
-- ---------------------------------------------------------------------------

create table public.usage_events (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients (id) on delete set null,
  run_id uuid,
  step_key text,
  purpose text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

comment on table public.usage_events is 'Append-only. Budget checks sum cost_usd per client per calendar month.';

create index usage_events_client_month_idx on public.usage_events (client_id, created_at);

-- ---------------------------------------------------------------------------
-- audit_log: who changed what
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_type text not null check (actor_type in ('staff', 'client_user', 'system')),
  actor_id text,
  client_id uuid references public.clients (id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is 'Append-only. Written by server code for every staff write.';

create index audit_log_client_idx on public.audit_log (client_id, created_at);

-- ---------------------------------------------------------------------------
-- Row-level security. Every table, no exceptions.
-- ---------------------------------------------------------------------------

alter table public.staff enable row level security;
alter table public.clients enable row level security;
alter table public.ghl_installations enable row level security;
alter table public.client_users enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_log enable row level security;

-- staff
create policy "staff can see the team"
  on public.staff for select
  to authenticated
  using (public.is_staff());

create policy "owner manages staff"
  on public.staff for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- clients
create policy "staff read clients"
  on public.clients for select
  to authenticated
  using (public.is_staff());

create policy "staff update clients"
  on public.clients for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "owner creates clients"
  on public.clients for insert
  to authenticated
  with check (public.is_owner());

create policy "owner deletes clients"
  on public.clients for delete
  to authenticated
  using (public.is_owner());

create policy "client reads own row"
  on public.clients for select
  to authenticated
  using (id = public.current_client_id());

-- ghl_installations: no policies. RLS on with no policies means deny all
-- for anon and authenticated. The secret key bypasses RLS.

-- client_users
create policy "staff read client users"
  on public.client_users for select
  to authenticated
  using (public.is_staff());

create policy "client reads own users"
  on public.client_users for select
  to authenticated
  using (client_id = public.current_client_id());

-- usage_events
create policy "staff read usage"
  on public.usage_events for select
  to authenticated
  using (public.is_staff());

-- audit_log
create policy "staff read audit log"
  on public.audit_log for select
  to authenticated
  using (public.is_staff());
