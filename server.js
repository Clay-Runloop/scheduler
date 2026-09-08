import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { config, googleEnabled } from './src/config.js';
import { availableSlots, parseSlotStart, slotToView } from './src/slots.js';
import { getBookings, addBooking, findBooking } from './src/store.js';
import * as cal from './src/calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function origin(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

app.get('/api/status', async (req, res) => {
  res.json({
    googleEnabled,
    calendarConnected: googleEnabled ? await cal.isCalendarConnected() : false,
    businessHours: { start: config.businessHoursStart, end: config.businessHoursEnd, days: config.businessDays, timezone: config.timezone },
    meetingLengthMin: config.meetingLengthMin,
    bookingHorizonDays: config.bookingHorizonDays,
    publicBookingUrl: `${origin(req)}/`,
  });
});

app.get('/api/slots', async (req, res) => {
  try {
    const bookings = await getBookings();
    const localBusy = bookings.map((b) => ({ start: b.start, end: b.end }));
    let googleBusy = [];
    if (googleEnabled && (await cal.isCalendarConnected())) {
      const horizon = config.bookingHorizonDays;
      const start = new Date();
      const end = new Date(start.getTime() + (horizon + 1) * 24 * 60 * 60 * 1000);
      googleBusy = await cal.getBusyIntervals(start, end).catch(() => []);
    }
    res.json({ slots: availableSlots([...localBusy, ...googleBusy]) });
  } catch (e) { res.status(500).json({ error: 'Could not load slots' }); }
});

app.post('/api/book', async (req, res) => {
  try {
    const { start, name, email, note } = req.body || {};
    if (!start || !name || !email) return res.status(400).json({ error: 'start, name, and email are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    const slot = parseSlotStart(start);
    if (!slot) return res.status(400).json({ error: 'That slot is no longer available' });
    if (await findBooking(start)) return res.status(409).json({ error: 'That slot was just booked. Please pick another.' });
    const booking = {
      id: crypto.randomUUID(), start: slot.start.toISOString(), end: slot.end.toISOString(),
      name: String(name).slice(0, 100), email: String(email).slice(0, 200),
      note: note ? String(note).slice(0, 1000) : '', createdAt: new Date().toISOString(),
    };
    await addBooking(booking);
    if (googleEnabled && (await cal.isCalendarConnected())) {
      try { await cal.createBookingEvent(slot, { name: booking.name, email: booking.email, note: booking.note }); } catch (e) { console.error('event creation failed:', e.message); }
    }
    res.json({ ok: true, booking: slotToView(slot) });
  } catch (e) { res.status(500).json({ error: 'Booking failed' }); }
});

app.get('/oauth/start', (req, res) => {
  if (!googleEnabled) return res.status(400).send('Google credentials not configured.');
  res.redirect(cal.getAuthUrl(origin(req)));
});
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code; if (!code) return res.status(400).send('Missing code');
  try { await cal.handleOAuthCallback(String(code), origin(req)); res.redirect('/?connected=1'); } catch (e) { console.error(e); res.redirect('/?connected=0'); }
});
app.post('/api/disconnect', async (req, res) => { await cal.disconnect(); res.json({ ok: true }); });

app.listen(config.port, '0.0.0.0', () => { console.log(`Scheduler running on port ${config.port}`); });
