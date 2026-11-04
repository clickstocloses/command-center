-- Agency-level installs.
-- When an agency admin installs the app and picks sub-accounts, HighLevel returns
-- ONE agency (company) token plus the list of approved locations. Location tokens
-- are then minted from it with POST /oauth/locationToken and carry no refresh token.
-- So: store the agency token here, and let an installation row hold no refresh token.

create table public.ghl_agency_tokens (
  ghl_company_id text primary key,
  ghl_user_id text,
  -- Encrypted in application code with GHL_TOKEN_ENCRYPTION_KEY before insert.
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  installed_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  last_refresh_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ghl_agency_tokens is 'HighLevel agency OAuth tokens, encrypted at rest. No RLS policies on purpose: only the secret key reads this.';

create trigger ghl_agency_tokens_set_updated_at
  before update on public.ghl_agency_tokens
  for each row execute function public.set_updated_at();

-- RLS on with no policies means deny all for anon, authenticated and client sessions.
alter table public.ghl_agency_tokens enable row level security;

-- A location token minted from the agency token has no refresh token of its own.
alter table public.ghl_installations
  alter column refresh_token_encrypted drop not null;

alter table public.ghl_installations
  add column token_source text not null default 'location'
  check (token_source in ('location', 'agency'));

comment on column public.ghl_installations.token_source is
  'location: the sub-account installed directly and holds its own refresh token. agency: minted from ghl_agency_tokens and re-minted when it expires.';
