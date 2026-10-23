# HighLevel facts

Live-tested behavior of HighLevel, its API and its developer portal. Read before touching HighLevel code. Add a dated line when you learn something. Newest at the top of each section.

## Marketplace developer portal (marketplace.gohighlevel.com)

- 2026-10-23: **Command Center app** is app id `6adbaef517cfbe55659d0934`, private, target Sub-Account, install "Agency only", white-label listing. Custom page id `6adbb028b2f372a738f49bf1`. Settings live at `/app-settings/<appId>/version/<appId>/...`; client keys and the shared secret at `/app-settings/<appId>/secrets`.
- 2026-10-23: A redirect URL containing the letters `ghl` is rejected with "The redirect uri contains a Highlevel reference". So the OAuth callback route is `/api/oauth/callback`, not `/api/ghl/...`. The same filter applies to logos and websites that mention HighLevel for white-label apps.
- 2026-10-23: `http://localhost:3000/...` is accepted as a redirect URL and as a Custom Page "Testing URL". The Custom Page "Live URL" must be https.
- 2026-10-23: Custom Page placement options are "App details page" and "Left menu navigation". Left menu adds "Visible on" (sub-account, agency, or both) and a required icon from HighLevel's icon set (`i-cursor` is in it). Microphone and camera permissions are per-page switches, both off for now; turn microphone on when voice interviews ship.
- 2026-10-23: The client secret and the shared secret are shown once, in a dialog, when generated. They were copied straight into `.env.local` (`GHL_CLIENT_SECRET`, `GHL_SHARED_SECRET`). If lost, generate new ones in Secrets; the old ones stop working.
- 2026-10-23: Scopes granted to Command Center (13): `locations.readonly`, `locations/customValues.readonly`, `locations/customValues.write`, `locations/customFields.readonly`, `locations/customFields.write`, `users.readonly`, `calendars.readonly`, `calendars/events.readonly`, `contacts.readonly`, `conversations.readonly`, `conversations/message.readonly`, `saas/location.read`, `oauth.readonly`. Changing scopes means every location must reinstall.
- 2026-10-23: The install link the portal shows is the plain OAuth authorize URL: `https://marketplace.gohighlevel.com/v2/oauth/chooselocation?response_type=code&redirect_uri=<callback>&client_id=<client id>&scope=<scopes joined by +>&version_id=<app id>`. The client id has the shape `<app id>-<suffix>`. A draft private app can be installed on the developer's own agency through this link; no publish step needed for that.
- 2026-10-23: Private apps are limited to 5 external agencies before HighLevel blocks new installs. All Clicks to Closes clients are sub-accounts of Tom's own agency, so this doesn't apply.

## API behavior

- 2026-10-23: `saas/location.read` is the scope for the SaaS status of a location (PRD open question 2). The exact field is still to be confirmed against a paused account.
- (Imported lessons from the Prompt Creator and RF Funnels projects still need porting here. See `docs/skill-inventory.md`, "HighLevel API knowledge".)

## Custom Page SSO

- (To fill in during Phase 0 Part E: exact decrypt scheme and payload shape, confirmed against HighLevel's marketplace app template.)
