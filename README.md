# Scheduler

A calendar-connected booking tool that lets prospects book **30-minute meetings during your business hours**. It shows only your open slots, and (optionally) syncs bookings straight to your **Google Calendar**.

## Features

- Public booking page listing open 30-min slots within your business hours/weekdays/timezone.
- Connects to Google Calendar via OAuth — pulls **free/busy** so booked slots disappear, and creates a **calendar event** (with attendee + invite email) when someone books.
- Works in **local-only mode** (no Google setup) for testing: bookings are stored in `data/store.json`.
- Configurable: business hours, business days, timezone, meeting length, lead time, booking horizon, buffer between meetings.
- Timezone-correct (handles DST) — slots are generated in your configured timezone regardless of server location.

## Quick start

```bash
cd scheduler
cp .env.example .env      # then edit values
npm install
npm start
```

Open http://localhost:3000 — you can book immediately in local mode.

## Connecting your Google Calendar

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project, enable the **Google Calendar API**.
3. Create an **OAuth client ID** of type *Web application*.
4. Add your redirect URI: `http://localhost:3000/oauth/callback` (or your `PUBLIC_URL` + `/oauth/callback`).
5. Put the client ID and secret into `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   PUBLIC_URL=http://localhost:3000
   ```
6. Restart the server and visit http://localhost:3000/oauth/start to authorize. Your free/busy is now respected and new bookings appear on your calendar.

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `PUBLIC_URL` | `http://localhost:PORT` | Public base URL (OAuth redirect + shareable link) |
| `BUSINESS_HOURS_START` | `9` | Start hour (24h) |
| `BUSINESS_HOURS_END` | `17` | End hour (24h) |
| `BUSINESS_DAYS` | `1,2,3,4,5` | Weekdays open (0=Sun … 6=Sat) |
| `TIMEZONE` | `America/New_York` | IANA timezone for business hours |
| `MEETING_LENGTH_MIN` | `30` | Meeting duration |
| `MEETING_BUFFER_MIN` | `0` | Gap kept around each meeting |
| `BOOKING_HORIZON_DAYS` | `30` | How far ahead slots are offered |
| `MIN_LEAD_HOURS` | `2` | Earliest a booking can be made |
| `GOOGLE_CLIENT_ID` | — | OAuth client ID (enables calendar sync) |
| `GOOGLE_CLIENT_SECRET` | — | OAuth client secret |

## API

- `GET /api/status` — config + whether calendar is connected
- `GET /api/slots` — open slots (merges Google free/busy + local bookings)
- `POST /api/book` — `{ start, name, email, note }` books a slot
- `GET /oauth/start` — begin Google OAuth
- `GET /oauth/callback` — OAuth redirect target
- `POST /api/disconnect` — revoke stored token

## How it works

1. `src/slots.js` generates contiguous 30-min slots within business hours, in your timezone, across the booking horizon.
2. `src/calendar.js` queries Google free/busy across all writable calendars and creates events on your primary calendar.
3. `src/store.js` persists bookings and the OAuth token to `data/store.json`.
4. `server.js` ties it together with a tiny Express app + the static booking page in `public/`.
