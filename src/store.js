import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULTS = {
  bookings: [], // { id, start, end, name, email, note, createdAt }
  googleToken: null, // OAuth token set from Google
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
}

export async function clearGoogleToken() {
  const data = await load();
  data.googleToken = null;
  await save();
}
