import dotenv from 'dotenv';

dotenv.config();

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

function envList(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

const port = envInt('PORT', 3000);

export const config = {
  port,
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  businessHoursStart: envInt('BUSINESS_HOURS_START', 9),
  businessHoursEnd: envInt('BUSINESS_HOURS_END', 17),
  businessDays: envList('BUSINESS_DAYS', [1, 2, 3, 4, 5]),
  timezone: process.env.TIMEZONE || 'UTC',
  meetingLengthMin: envInt('MEETING_LENGTH_MIN', 30),
  meetingBufferMin: envInt('MEETING_BUFFER_MIN', 0),
  bookingHorizonDays: envInt('BOOKING_HORIZON_DAYS', 30),
  minLeadHours: envInt('MIN_LEAD_HOURS', 2),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  partner: {
    name: process.env.PARTNER_NAME || '',
    calendarId: process.env.PARTNER_CALENDAR_ID || '',
    email: process.env.PARTNER_EMAIL || '',
  },
};

export const googleEnabled = Boolean(config.google.clientId && config.google.clientSecret);
export const partnerEnabled = Boolean(config.partner.calendarId || config.partner.email);
