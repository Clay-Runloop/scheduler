import { google } from 'googleapis';
import { config, googleEnabled } from './config.js';
import { getGoogleToken, setGoogleToken, clearGoogleToken } from './store.js';
const REDIRECT_PATH = '/oauth/callback';
function buildOAuth2Client(redirect) {
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, redirect || `${config.publicUrl}${REDIRECT_PATH}`);
}
export function isConnected() { return googleEnabled; }
export function getAuthUrl(reqOrigin) {
  const redirect = reqOrigin ? `${reqOrigin}${REDIRECT_PATH}` : `${config.publicUrl}${REDIRECT_PATH}`;
  return buildOAuth2Client(redirect).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'] });
}
async function getAuthenticatedClient() {
  if (!googleEnabled) return null;
  const token = await getGoogleToken(); if (!token) return null;
  const client = buildOAuth2Client(token.redirect_uri);
  client.setCredentials(token); client.on('tokens', async (t) => { await setGoogleToken({ ...token, ...t }); }); return client;
}
export async function handleOAuthCallback(code, reqOrigin) {
  const redirect = reqOrigin ? `${reqOrigin}${REDIRECT_PATH}` : `${config.publicUrl}${REDIRECT_PATH}`;
  const client = buildOAuth2Client(redirect);
  const { tokens } = await client.getToken(code);
  await setGoogleToken({ ...tokens, redirect_uri: redirect });
  return tokens;
}
export async function disconnect() { await clearGoogleToken(); }
export async function isCalendarConnected() { return Boolean(await getGoogleToken()); }
export async function getBusyIntervals(start, end) {
  const client = await getAuthenticatedClient(); if (!client) return [];
  const calendar = google.calendar({ version: 'v3', auth: client });
  const { data } = await calendar.calendarList.list({ minAccessRole: 'writer' });
  const calendarIds = (data.items || []).map((c) => c.id); if (!calendarIds.length) return [];
  const fb = await calendar.freebusy.query({ requestBody: { timeMin: start.toISOString(), timeMax: end.toISOString(), items: calendarIds.map((id) => ({ id })) } });
  const cal = fb.data.calendars || {}; const intervals = [];
  for (const id of Object.keys(cal)) for (const busy of cal[id].busy || []) intervals.push({ start: new Date(busy.start), end: new Date(busy.end) });
  return intervals;
}
export async function createBookingEvent(slot, details) {
  const client = await getAuthenticatedClient(); if (!client) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const event = {
    summary: `Meeting with ${details.name}`,
    description: [`Booked via scheduler.`, `Email: ${details.email}`, details.note ? `Note: ${details.note}` : ''].filter(Boolean).join('\n'),
    start: { dateTime: slot.start.toISOString(), timeZone: config.timezone },
    end: { dateTime: slot.end.toISOString(), timeZone: config.timezone },
    attendees: [{ email: details.email }],
  };
  return (await calendar.events.insert({ calendarId: 'primary', requestBody: event, sendUpdates: 'all' })).data;
}
