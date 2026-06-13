-- 1) Snapshot of last 7 days: event count by version and type
select version, event, count(*) as cnt
from app_update_events
where created_at > now() - interval '7 days'
group by version, event
order by version desc, event;

-- 2) Failure rate by version (downloadFailed + updateFailed as % of all events)
select version,
       count(*) filter (where event in ('downloadFailed','updateFailed')) as failures,
       count(*) filter (where event = 'appReady') as successes,
       round(100.0 * count(*) filter (where event in ('downloadFailed','updateFailed'))
             / greatest(count(*), 1), 1) as failure_pct
from app_update_events
where created_at > now() - interval '7 days'
group by version
order by version desc;

-- 3) Version adoption: how many devices are running the latest version (via appReady)
select version, count(*) as devices_reported
from app_update_events
where event = 'appReady' and created_at > now() - interval '3 days'
group by version
order by version desc;

-- 4) Recent failures with full details
select created_at, event, version, details
from app_update_events
where event in ('downloadFailed','updateFailed','appReadyError')
order by created_at desc
limit 20;
