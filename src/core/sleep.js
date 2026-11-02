import { HOUR, MIN, addDays, atTime, calendarDays, fromIso, startOfDay } from './time.js';

// General guide values, used only until a child has enough of its own data.
// No window is shown below eight weeks: young babies have no stable rhythm yet.
const RULES = [
  { fromWeeks: 8, min: 60, max: 90, naps: 4, napMin: 60 },
  { fromWeeks: 12, min: 75, max: 120, naps: 4, napMin: 60 },
  { fromWeeks: 20, min: 120, max: 180, naps: 3, napMin: 60 },
  { fromWeeks: 32, min: 150, max: 210, naps: 2, napMin: 75 },
  { fromWeeks: 44, min: 180, max: 240, naps: 2, napMin: 75 },
  { fromWeeks: 60, min: 240, max: 300, naps: 1, napMin: 90 },
  { fromWeeks: 78, min: 300, max: 360, naps: 1, napMin: 120 },
];

const OWN_DATA_DAYS = 14;
const OWN_DATA_MIN = 5;
const MAX_WINDOW = 8 * HOUR;
const MIN_WINDOW = 15 * MIN;
const NIGHT_LENGTH = 4 * HOUR;
const STALE = 10 * HOUR;
const LATEST_NAP_START_HOUR = 18;

export function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + (pos - base) * (next - sorted[base]);
}

/** Age in days, measured from the due date for babies born three weeks or more early. */
export function correctedAgeDays(child, now) {
  if (!child?.birthDate) return null;
  const age = calendarDays(fromIso(child.birthDate), now);
  if (!child.dueDate) return age;
  const early = calendarDays(fromIso(child.birthDate), fromIso(child.dueDate));
  return early >= 21 ? Math.max(0, age - early) : age;
}

export function ruleForAge(ageDays) {
  const weeks = ageDays / 7;
  return [...RULES].reverse().find((r) => weeks >= r.fromWeeks) ?? null;
}

const finished = (sleeps) =>
  sleeps.filter((s) => s.end && !s.deletedAt).sort((a, b) => a.start - b.start);

export function ownWakeWindows(sleeps, now, days = OWN_DATA_DAYS) {
  const since = addDays(now, -days);
  const list = finished(sleeps).filter((s) => s.end >= since);
  const windows = [];
  for (let i = 1; i < list.length; i += 1) {
    const gap = list[i].start - list[i - 1].end;
    if (gap >= MIN_WINDOW && gap <= MAX_WINDOW) windows.push(gap);
  }
  return windows;
}

function windowRange(sleeps, rule, now) {
  const own = ownWakeWindows(sleeps, now);
  if (own.length >= OWN_DATA_MIN) {
    let lo = quantile(own, 0.25) / MIN;
    let hi = quantile(own, 0.75) / MIN;
    const mid = (lo + hi) / 2;
    if (hi - lo < 20) { lo = mid - 10; hi = mid + 10; }
    if (hi - lo > 60) { lo = mid - 30; hi = mid + 30; }
    return { lo, hi, basis: 'own', n: own.length };
  }
  return { lo: rule.min, hi: rule.max, basis: 'age', n: own.length };
}

/** A range, never a single minute, with the data it came from. */
export function predictNextSleep({ sleeps, child, now, shiftMin = 0, running = false }) {
  const age = correctedAgeDays(child, now);
  if (age === null) return { status: 'unknown' };
  const rule = ruleForAge(age);
  if (!rule) return { status: 'young' };
  if (running) return { status: 'asleep' };
  const list = finished(sleeps);
  const last = list[list.length - 1];
  if (!last) return { status: 'nodata' };
  if (now - last.end > STALE) return { status: 'stale' };
  const range = windowRange(sleeps, rule, now);
  return {
    status: 'ok',
    from: last.end + (range.lo + shiftMin) * MIN,
    to: last.end + (range.hi + shiftMin) * MIN,
    lastWake: last.end,
    loMin: Math.round(range.lo),
    hiMin: Math.round(range.hi),
    basis: range.basis,
    n: range.n,
  };
}

function ownBedtimeMinutes(sleeps, now) {
  const since = addDays(now, -OWN_DATA_DAYS);
  const minutes = finished(sleeps)
    .filter((s) => s.start >= since && s.end - s.start >= NIGHT_LENGTH && new Date(s.start).getHours() >= 17)
    .map((s) => {
      const d = new Date(s.start);
      return d.getHours() * 60 + d.getMinutes();
    });
  return minutes.length >= 3 ? quantile(minutes, 0.5) : null;
}

function ownNapLength(sleeps, now) {
  const since = addDays(now, -OWN_DATA_DAYS);
  const naps = finished(sleeps)
    .filter((s) => s.start >= since && s.end - s.start < NIGHT_LENGTH)
    .map((s) => s.end - s.start);
  return naps.length >= OWN_DATA_MIN ? quantile(naps, 0.5) : null;
}

/** Plan for the rest of today. It is rebuilt from what really happened on every call. */
export function dayPlan({ sleeps, child, now, shiftMin = 0, running = false }) {
  const age = correctedAgeDays(child, now);
  if (age === null) return { status: 'unknown' };
  const rule = ruleForAge(age);
  if (!rule) return { status: 'young' };

  const today = startOfDay(now);
  const list = finished(sleeps);
  const endedToday = list.filter((s) => s.end >= today && s.end <= now);
  if (!endedToday.length) return { status: 'nomorning', rule };

  const isNap = (s) => s.start >= today && s.end - s.start < NIGHT_LENGTH;
  const naps = endedToday.filter(isNap);
  const range = windowRange(sleeps, rule, now);
  const midWindow = ((range.lo + range.hi) / 2 + shiftMin) * MIN;
  const hiWindow = (range.hi + shiftMin) * MIN;
  const loWindow = (range.lo + shiftMin) * MIN;
  const napLength = ownNapLength(sleeps, now) ?? rule.napMin * MIN;

  const items = naps.map((s) => ({ kind: 'nap', start: s.start, end: s.end, done: true }));
  let cursor = endedToday[endedToday.length - 1].end;
  const latestNap = atTime(today, LATEST_NAP_START_HOUR, 0);
  let planned = naps.length;

  if (running) return { status: 'asleep', items, rule, basis: range.basis, n: range.n };

  while (planned < rule.naps) {
    const start = cursor + midWindow;
    if (start > latestNap) break;
    const end = start + napLength;
    items.push({ kind: 'nap', start, end, done: false });
    cursor = end;
    planned += 1;
  }

  const earliestBed = cursor + loWindow;
  const own = ownBedtimeMinutes(sleeps, now);
  const ownBed = own === null ? null : today + own * MIN;
  const bed = ownBed !== null && ownBed >= earliestBed && ownBed <= cursor + hiWindow + HOUR
    ? ownBed
    : cursor + hiWindow;
  items.push({ kind: 'bed', start: bed, done: false });

  return { status: 'ok', items, rule, basis: range.basis, n: range.n };
}
