-- Local test data only. Fake clients, never real ones.
-- Staff rows are allowlist entries; auth_user_id links on first login.

insert into public.staff (email, name, role, permissions)
values
  ('tom@clickstocloses.com', 'Tom Pacheco', 'owner', '{}'::jsonb),
  (
    'team@example.com',
    'Test Team Member',
    'team',
    '{
      "view_clients": true,
      "run_generators": true,
      "edit_outputs": true,
      "share_outputs": true,
      "manage_usage_limits": false,
      "manage_staff": false,
      "manage_integrations": false,
      "delete": false
    }'::jsonb
  );

insert into public.clients (ghl_location_id, name, niche, practice_model, status, timezone, website_url)
values
  ('loc_fake_northside', 'Northside Physio', 'health', 'hybrid', 'onboarding_not_started', 'America/New_York', 'https://example.com/northside'),
  ('loc_fake_brightline', 'Brightline Painting', 'service', null, 'onboarding_in_progress', 'America/Chicago', 'https://example.com/brightline');

insert into public.client_users (client_id, ghl_user_id, name, email, role)
select id, 'user_fake_northside_owner', 'Pat Northside', 'pat@example.com', 'admin'
from public.clients where ghl_location_id = 'loc_fake_northside';
