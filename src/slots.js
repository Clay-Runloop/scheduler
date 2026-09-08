import { config } from './config.js';

// ---------------------------------------------------------------------------
// Timezone helpers (no external deps). Uses the Intl API to interpret the
// configured BUSINESS hours in the configured timezone regardless of where
// the server runs (handles DST correctly).
// ---------------------------------------------------------------------------

function zoneOffsetMs(timeZone, instant) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  const zoneAsUtc = Date.UTC(
    +map.year,
    +map.month - 1,
    +map.day,
    +map.hour,
    +map.minute,
    +map.second,
  );
  const utcAsUtc = Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
    instant.getUTCSeconds(),
  );
  return zoneAsUtc - utcAsUtc;
}

// Convert a wall-clock time in `timeZone` to a UTC Date.
export function wallToUtc(year, month, day, hour, minute, timeZone) {
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  let offset = zoneOffsetMs(timeZone, new Date(wallAsUtcMs));
  let utc = wallAsUtcMs - offset;
  offset = zoneOffsetMs(timeZone, new Date(utc));
  utc = wallAsUtcMs - offset;
  return new Date(utc);
}

// Wall-clock parts of a UTC instant in the configured timezone.
export function toZoneParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return {
    weekday: map.weekday,
    year: +map.year,
    month: +map.month,
    day: +map.day,
    hour: +map.hour === 24 ? 0 : +map.hour, // handle h23 edge case
    minute: +map.minute,
  };
}

// ---------------------------------------------------------------------------
// Slot generation
// ---------------------------------------------------------------------------

function startOfTodayZone(timeZone) {
  const now = new Date();
  const p = toZoneParts(now, timeZone);
  return wallToUtc(p.year, p.month, p.day, 0, 0, timeZone);
}

// Generate candidate 30-min slot starts across the booking horizon.
// Returns array of { start: Date, end: Date } in UTC.
export function generateCandidates() {
  const {
    businessHoursStart,
    businessHoursEnd,
    businessDays,
    meetingLengthMin,
    bookingHorizonDays,
    timezone,
  } = config;

  const slots = [];
  const startDay = startOfTodayZone(timezone);
  const startMin = businessHoursStart * 60;
  const endMin = businessHoursEnd * 60;
  const step = meetingLengthMin;

  for (let i = 0; i <= bookingHorizonDays; i += 1) {
    const dayStart = new Date(startDay.getTime() + i * 24 * 60 * 60 * 1000);
    const parts = toZoneParts(dayStart, timezone);
    if (!businessDays.includes(zoneWeekdayFromParts(parts))) continue;

    for (let m = startMin; m + step <= endMin + 1e-9; m += step) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const start = wallToUtc(parts.year, parts.month, parts.day, hour, minute, timezone);
      const end = new Date(start.getTime() + step * 60 * 1000);
      slots.push({ start, end });
    }
  }
  return slots;
}

function zoneWeekdayFromParts(parts) {
  // Compute weekday from the date parts (in zone). Use a UTC date from parts.
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return d.getUTCDay();
}

// Filter candidates against busy intervals + lead time + horizon.
export function availableSlots(busyIntervals) {
  const { meetingBufferMin, minLeadHours, timezone } = config;
  const now = new Date();
  const earliest = new Date(now.getTime() + minLeadHours * 60 * 60 * 1000);

  const expanded = busyIntervals.map((b) => {
    const start = b.start instanceof Date ? b.start : new Date(b.start);
    const end = b.end instanceof Date ? b.end : new Date(b.end);
    return {
      start: new Date(start.getTime() - meetingBufferMin * 60 * 1000),
      end: new Date(end.getTime() + meetingBufferMin * 60 * 1000),
    };
  });

  const out = [];
  for (const slot of generateCandidates()) {
    if (slot.start < earliest) continue;
    let conflict = false;
    for (const b of expanded) {
      if (slot.start < b.end && slot.end > b.start) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      out.push(slotToView(slot, timezone));
    }
  }
  return out;
}

export function slotToView(slot, timeZone = config.timezone) {
  const sp = toZoneParts(slot.start, timeZone);
  const ep = toZoneParts(slot.end, timeZone);
  const pad = (n) => String(n).padStart(2, '0');
  const labelDate = `${sp.weekday}, ${sp.year}-${pad(sp.month)}-${pad(sp.day)}`;
  const labelTime = `${pad(sp.hour)}:${pad(sp.minute)}–${pad(ep.hour)}:${pad(ep.minute)}`;
  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    date: labelDate,
    time: labelTime,
  };
}

export function parseSlotStart(iso) {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  // Verify it matches a valid candidate slot during business hours.
  const candidates = generateCandidates();
  const match = candidates.find((c) => c.start.getTime() === start.getTime());
  return match || null;
}
