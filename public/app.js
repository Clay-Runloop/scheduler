const $ = (sel) => document.querySelector(sel);

let selectedStart = null;
let status = null;

async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get('connected') === '1') {
    showFlash('Calendar connected!');
  }
  await loadStatus();
  await loadSlots();
}

function showFlash(msg) {
  const el = document.createElement('div');
  el.className = 'banner';
  el.style.background = '#ecfdf5';
  el.style.borderColor = '#a7f3d0';
  el.textContent = msg;
  $('.card').insertBefore(el, $('#connect-banner'));
  setTimeout(() => el.remove(), 4000);
}

async function loadStatus() {
  try {
    const r = await fetch('/api/status');
    status = await r.json();
    const bh = status.businessHours;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNames = bh.days.map((d) => days[d]).join(', ');
    $('#subtitle').textContent =
      `${status.meetingLengthMin}-min meetings · ${formatHour(bh.start)}–${formatHour(bh.end)} (${bh.timezone}) · ${dayNames}`;

    if (status.googleEnabled && !status.calendarConnected) {
      $('#connect-banner').classList.remove('hidden');
    }
  } catch {
    $('#subtitle').textContent = 'Could not load scheduler status.';
  }
}

function formatHour(h) {
  const ap = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}

async function loadSlots() {
  const container = $('#slots');
  container.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const r = await fetch('/api/slots');
    const { slots } = await r.json();
    renderSlots(slots);
  } catch {
    container.innerHTML = '<p class="empty">Could not load availability.</p>';
  }
}

function renderSlots(slots) {
  const container = $('#slots');
  if (!slots.length) {
    container.innerHTML = '<p class="empty">No open slots right now. Please check back soon.</p>';
    return;
  }
  const byDate = {};
  for (const s of slots) {
    (byDate[s.date] = byDate[s.date] || []).push(s);
  }
  container.innerHTML = '';
  for (const date of Object.keys(byDate)) {
    const group = document.createElement('div');
    group.className = 'day-group';
    group.innerHTML = `<div class="day-label">${date}</div>`;
    const grid = document.createElement('div');
    grid.className = 'slot-grid';
    for (const s of byDate[date]) {
      const btn = document.createElement('button');
      btn.className = 'slot';
      btn.textContent = s.time;
      btn.dataset.start = s.start;
      btn.addEventListener('click', () => selectSlot(s));
      grid.appendChild(btn);
    }
    group.appendChild(grid);
    container.appendChild(group);
  }
}

function selectSlot(slot) {
  selectedStart = slot.start;
  $('#chosen-slot').textContent = `${slot.date} · ${slot.time}`;
  $('#slots').classList.add('hidden');
  $('#form').classList.remove('hidden');
}

$('#back').addEventListener('click', () => {
  $('#form').classList.add('hidden');
  $('#slots').classList.remove('hidden');
});

$('#booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#form-error');
  err.classList.add('hidden');
  const btn = $('#submit-btn');
  btn.disabled = true;
  btn.textContent = 'Booking…';
  const fd = new FormData(e.target);
  try {
    const r = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: selectedStart,
        name: fd.get('name'),
        email: fd.get('email'),
        note: fd.get('note'),
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Booking failed');
    $('#form').classList.add('hidden');
    $('#confirm-details').textContent = `${data.booking.date} · ${data.booking.time}`;
    $('#confirm-note').textContent =
      status && status.calendarConnected
        ? 'A calendar invite has been sent to your email.'
        : 'Your booking is confirmed.';
    $('#confirmation').classList.remove('hidden');
    e.target.reset();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm booking';
  }
});

$('#book-another').addEventListener('click', () => {
  $('#confirmation').classList.add('hidden');
  $('#slots').classList.remove('hidden');
  loadSlots();
});

init();
