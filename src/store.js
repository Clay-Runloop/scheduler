import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// The Google OAuth token is stored in the GOOGLE_TOKEN env var so it survives
// Render's ephemeral filesystem across deploys. Bookings are kept on disk (and
// rebuilt from the calendar anyway).
const TOKEN_ENV = 'GOOGLE_TOKEN';

const DEFAULTS = {
  bookings: [],
  googleToken: null,
};

let cache = null;

async function ensure() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function load() {
  if (cache) return cache;
  await ensure();
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cache = { ...DEFAULTS };
  }
  // Prefer the env-var token (authoritative across deploys) over the file copy.
  const envToken = process.env[TOKEN_ENV];
  if (envToken) {
    try {
      cache.googleToken = JSON.parse(envToken);
    } catch {
      cache.googleToken = null;
    }
  }
  return cache;
}

async function save() {
  if (!cache) return;
  await ensure();
  await fs.writeFile(STORE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

export async function getBookings() {
  const data = await load();
  return data.bookings;
}

export async function addBooking(booking) {
  const data = await load();
  data.bookings.push(booking);
  await save();
  return booking;
}

export async function findBooking(startIso) {
  const data = await load();
  return data.bookings.find((b) => b.start === startIso);
}

export async function getGoogleToken() {
  const data = await load();
  return data.googleToken;
}

export async function setGoogleToken(token) {
  const data = await load();
  data.googleToken = token;
  await save();
  // Print the token so you can copy it into Render's env once.
  console.log('\n========================================');
  console.log('  GOOGLE TOKEN (paste into Render env var');
  console.log('  GOOGLE_TOKEN):');
  console.log('========================================');
  console.log(JSON.stringify(token));
  console.log('========================================\n');
}

export async function clearGoogleToken() {
  const data = await load();
  data.googleToken = null;
  await save();
  console.log('GOOGLE_TOKEN cleared. Remove the env var on Render to fully disconnect.');
}
