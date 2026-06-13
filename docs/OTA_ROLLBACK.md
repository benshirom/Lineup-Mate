# OTA Rollback Procedures

## Automatic Rollback (no action needed)

A bundle that does not call `notifyAppReady` within 10 seconds triggers an automatic rollback on the device. The device reverts to the previous bundle and reports a `downloadComplete` event without a matching `appReady` in `app_update_events`.

## Manual Rollback (logical bug in live version)

Run in Supabase SQL Editor:

```sql
-- Step 1: disable the bad version
update app_versions set active = false where version = '<bad-version>';

-- Step 2: confirm what is now being served
select version from app_versions where active = true
order by created_at desc limit 1;
```

From this moment, every device that opens the app will "update" back to the previous active version.

## Re-deploying a fix

Once the bug is fixed:

```bash
npm version patch   # bumps package.json version
git add package.json package-lock.json
git commit -m "fix: <description>"
# merge to main → GitHub Actions builds and deploys the fixed version automatically
```

## Monitoring rollback adoption

Check `app_update_events` to confirm devices are returning to the good version:

```sql
select version, event, count(*) as cnt
from app_update_events
where created_at > now() - interval '1 day'
group by version, event
order by version desc, event;
```

Red flag: `downloadComplete` with no matching `appReady` for the same version = crash loop, automatic rollback active.
