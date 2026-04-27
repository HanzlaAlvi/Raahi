# Active Drivers List UI Fix - AssignSection Popup

Status: In Progress

## Steps:

## Auto-Yes Cron Fix Complete

**Previous**: Drivers/Assign UI fixed

**New**: Changed auto-yes timing from 10 PM → 9:45 PM (9:30-9:59 PM window)

- Polls auto-close + passenger auto-yes at 9:45 PM
- Driver availability auto-yes at 9:45 PM
- Last reminder at 9 PM says "FINAL"

**Files**: backend/corn/alarmCron.js (timing updated)

**Backend restart**: `cd backend && node server.js` (cron reschedules)

Test tomorrow 9 PM or manually trigger cron functions.
