import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, MIN, DAY, addDays, ageLabel, ago, atTime, calendarDays, clock, dur, fromIso, isValidIso, isoDate, startOfDay, startOfWeek, stopwatch } from '../src/core/time.js';
import { gestation, isPlausibleDueDate } from '../src/core/pregnancy.js';
import { intervalBefore, summarize } from '../src/core/contractions.js';
import { emptyNursing, isAwake, sideTotals, sleepElapsed, toggleSide, toggleWake } from '../src/core/timers.js';
import { correctedAgeDays, dayPlan, ownWakeWindows, predictNextSleep, quantile, ruleForAge } from '../src/core/sleep.js';
import { dayStats, foodLog, insights, lastByType, lastNursingSide, metricSeries, netSleep } from '../src/core/reports.js';
import { curve, normalCdf, percentile, percentileLabel, valueAtZ, zScore } from '../src/core/growth.js';
import { isDue, reminderToIcs } from '../src/core/ics.js';
import { parseQuick } from '../src/core/parse.js';
import { describe as describeEntry } from '../src/core/describe.js';
import { demoState } from '../src/core/demo.js';
import { STORAGE_KEYS, createStore, emptyState, memoryStorage, mergeStates, sanitize } from '../src/core/store.js';

const at = (iso, h = 12, m = 0) => atTime(fromIso(iso), h, m);
const sleep = (start, end, extra = {}) => ({ id: `s${start}`, childId: 'c', type: 'sleep', start, end, data: { wakes: [] }, ...extra });

// ---------- time ----------
test('day helpers stay correct across daylight saving changes', () => {
  assert.equal(calendarDays(at('2026-03-28'), at('2026-03-30')), 2);
  assert.equal(calendarDays(at('2026-10-24'), at('2026-10-26')), 2);
  assert.equal(addDays(fromIso('2026-03-28'), 2), fromIso('2026-03-30'));
  assert.equal(new Date(addDays(at('2026-10-24', 8), 2)).getHours(), 8);
});

test('formats durations and stopwatch for reading at a glance', () => {
  assert.equal(dur(30_000), 'unter 1 Min');
  assert.equal(dur(5 * MIN), '5 Min');
  assert.equal(dur(2 * HOUR), '2 Std');
  assert.equal(dur(72 * MIN), '1 Std 12 Min');
  assert.equal(stopwatch(65_000), '01:05');
  assert.equal(stopwatch(HOUR + 2 * MIN + 3000), '1:02:03');
  assert.equal(stopwatch(-500), '00:00');
});

test('relative time wording', () => {
  const now = at('2026-11-02', 15, 0);
  assert.equal(ago(now - 20_000, now), 'gerade eben');
  assert.equal(ago(now - 40 * MIN, now), 'vor 40 Min');
  assert.equal(ago(at('2026-11-01', 22, 5), now - 1), ago(at('2026-11-01', 22, 5), now - 1));
  assert.equal(ago(at('2026-11-01', 1, 5), now), 'gestern 01:05');
  assert.equal(ago(at('2026-10-12', 8, 0), now), '12. Okt.');
});

test('week starts on Monday', () => {
  assert.equal(isoDate(startOfWeek(at('2026-11-01'))), '2026-10-26');
  assert.equal(isoDate(startOfWeek(at('2026-11-02'))), '2026-11-02');
});

test('validates calendar dates', () => {
  assert.equal(isValidIso('2026-02-29'), false);
  assert.equal(isValidIso('2028-02-29'), true);
  assert.equal(isValidIso('hallo'), false);
});

test('age wording', () => {
  const now = at('2026-11-02');
  assert.equal(ageLabel('2026-11-02', now), 'Heute geboren');
  assert.equal(ageLabel('2026-10-30', now), '3 Tage');
  assert.equal(ageLabel('2026-10-01', now), '4 Wochen');
  assert.equal(ageLabel('2026-06-01', now), '5 Monate');
  assert.equal(ageLabel('2023-11-02', now), '3 Jahre');
});

// ---------- pregnancy ----------
test('gestational age from the due date', () => {
  const now = at('2026-11-02');
  assert.deepEqual(
    { ...gestation('2026-11-02', now), progress: 1 },
    { weeks: 40, days: 0, label: '40+0', daysLeft: 0, overdue: false, progress: 1 },
  );
  const g = gestation('2026-11-27', now);
  assert.equal(g.label, '36+3');
  assert.equal(g.daysLeft, 25);
  assert.equal(gestation('2026-10-30', now).overdue, true);
  assert.equal(gestation('2026-10-30', now).label, '40+3');
  assert.equal(gestation('2028-01-01', now), null);
});

test('rejects implausible due dates', () => {
  const now = at('2026-11-02');
  assert.equal(isPlausibleDueDate('2027-03-01', now), true);
  assert.equal(isPlausibleDueDate('2028-03-01', now), false);
  assert.equal(isPlausibleDueDate('2026-01-01', now), false);
});

// ---------- contractions ----------
const series = (now, count, gapMin, lengthSec = 60) =>
  Array.from({ length: count }, (_, i) => {
    const start = now - (count - 1 - i) * gapMin * MIN;
    return { id: String(i), start, end: start + lengthSec * 1000, data: {} };
  });

test('interval is measured start to start', () => {
  const now = at('2026-11-02', 20);
  const s = summarize(series(now, 4, 6), now + 2 * MIN);
  assert.equal(s.count, 4);
  assert.equal(s.avgInterval, 6 * MIN);
  assert.equal(s.avgDuration, 60_000);
});

test('call hint appears for regular contractions about five to six minutes apart', () => {
  const now = at('2026-11-02', 20);
  const s = summarize(series(now, 7, 5), now + 2 * MIN);
  assert.equal(s.regular, true);
  assert.equal(s.callHint, true);
});

test('no call hint for too few or too far apart contractions', () => {
  const now = at('2026-11-02', 20);
  assert.equal(summarize(series(now, 4, 5), now).callHint, false);
  assert.equal(summarize(series(now, 7, 9), now).callHint, false);
});

test('no call hint for irregular contractions', () => {
  const now = at('2026-11-02', 20);
  const gaps = [1, 11, 2, 9, 1, 10];
  let t = now - 34 * MIN;
  const list = gaps.map((g, i) => {
    t += g * MIN;
    return { id: String(i), start: t, end: t + 60_000, data: {} };
  });
  list.unshift({ id: 'x', start: now - 34 * MIN, end: now - 34 * MIN + 60_000, data: {} });
  const s = summarize(list, now);
  assert.equal(s.regular, false);
  assert.equal(s.callHint, false);
});

test('call hint disappears once contractions stop for a while', () => {
  const now = at('2026-11-02', 20);
  assert.equal(summarize(series(now, 7, 5), now + 20 * MIN).callHint, false);
});

test('a long gap starts a new measurement and is not an interval', () => {
  const now = at('2026-11-02', 20);
  const early = { id: 'a', start: now - 50 * MIN, end: now - 49 * MIN, data: {} };
  const late = series(now, 3, 5);
  const s = summarize([early, ...late], now);
  assert.equal(s.avgInterval, 5 * MIN);
  assert.equal(intervalBefore([early, ...late], late[0]), null);
  assert.equal(intervalBefore([early, ...late], late[1]), 5 * MIN);
});

test('deleted contractions do not count', () => {
  const now = at('2026-11-02', 20);
  const list = series(now, 7, 5);
  list.slice(0, 3).forEach((c) => { c.deletedAt = now; });
  assert.equal(summarize(list, now).count, 4);
});

// ---------- timers ----------
test('sleep timer subtracts short wakings', () => {
  const start = at('2026-11-02', 20);
  let t = { start, wakes: [] };
  t = toggleWake(t, start + HOUR);
  assert.equal(isAwake(t), true);
  assert.equal(sleepElapsed(t, start + HOUR + 10 * MIN), HOUR);
  t = toggleWake(t, start + HOUR + 20 * MIN);
  assert.equal(isAwake(t), false);
  assert.equal(sleepElapsed(t, start + 2 * HOUR), 100 * MIN);
});

test('nursing timer switches sides and pauses', () => {
  const start = at('2026-11-02', 9);
  let t = emptyNursing();
  t = toggleSide(t, 'left', start);
  t = toggleSide(t, 'right', start + 5 * MIN);
  assert.deepEqual(sideTotals(t, start + 8 * MIN), { left: 5 * MIN, right: 3 * MIN, total: 8 * MIN });
  t = toggleSide(t, 'right', start + 8 * MIN);
  assert.equal(t.active, null);
  assert.deepEqual(sideTotals(t, start + 60 * MIN), { left: 5 * MIN, right: 3 * MIN, total: 8 * MIN });
});

// ---------- sleep window ----------
const baby = (ageDays, now, extra = {}) => ({ birthDate: isoDate(addDays(now, -ageDays)), dueDate: null, ...extra });

test('no sleep window below eight weeks', () => {
  const now = at('2026-11-02');
  assert.equal(ruleForAge(30), null);
  assert.equal(predictNextSleep({ sleeps: [], child: baby(30, now), now }).status, 'young');
});

test('corrected age is used for babies born three weeks early or more', () => {
  const now = at('2026-11-02');
  const child = { birthDate: '2026-08-01', dueDate: '2026-09-15' };
  assert.equal(correctedAgeDays(child, now), 93 - 45);
  assert.equal(correctedAgeDays({ birthDate: '2026-08-01', dueDate: '2026-08-10' }, now), 93);
  assert.equal(predictNextSleep({ sleeps: [], child: { birthDate: '2026-09-01', dueDate: '2026-10-10' }, now }).status, 'young');
});

test('uses age guide values until enough own data exists', () => {
  const now = at('2026-11-02', 12);
  const p = predictNextSleep({ sleeps: [sleep(now - 2 * HOUR, now - HOUR)], child: baby(100, now), now });
  assert.equal(p.status, 'ok');
  assert.equal(p.basis, 'age');
  assert.equal(p.from, now - HOUR + 75 * MIN);
  assert.equal(p.to, now - HOUR + 120 * MIN);
});

test('switches to the own rhythm with five or more wake windows', () => {
  const now = at('2026-11-02', 18);
  const sleeps = [];
  let t = at('2026-11-02', 7);
  for (let i = 0; i < 7; i += 1) {
    sleeps.push(sleep(t, t + 30 * MIN));
    t += 30 * MIN + (150 + i * 2) * MIN;
  }
  const p = predictNextSleep({ sleeps, child: baby(100, now), now: t - 100 * MIN });
  assert.equal(p.basis, 'own');
  assert.equal(p.n, 6);
  assert.ok(p.hiMin - p.loMin >= 20, 'range stays usable');
  assert.ok(p.loMin > 140 && p.hiMin < 170);
});

test('user shift moves the range', () => {
  const now = at('2026-11-02', 12);
  const sleeps = [sleep(now - 2 * HOUR, now - HOUR)];
  const a = predictNextSleep({ sleeps, child: baby(100, now), now });
  const b = predictNextSleep({ sleeps, child: baby(100, now), now, shiftMin: -15 });
  assert.equal(a.from - b.from, 15 * MIN);
});

test('stale data gives no window', () => {
  const now = at('2026-11-02', 22);
  assert.equal(predictNextSleep({ sleeps: [sleep(now - 13 * HOUR, now - 12 * HOUR)], child: baby(100, now), now }).status, 'stale');
});

test('quantile interpolates', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([5], 0.75), 5);
});

test('own windows ignore overnight gaps longer than eight hours', () => {
  const now = at('2026-11-02', 20);
  const sleeps = [sleep(at('2026-11-01', 8), at('2026-11-01', 9)), sleep(at('2026-11-02', 8), at('2026-11-02', 9))];
  assert.deepEqual(ownWakeWindows(sleeps, now), []);
});

test('day plan rebuilds from what really happened', () => {
  const now = at('2026-11-02', 11);
  const child = baby(120, now);
  const night = sleep(at('2026-11-01', 19, 30), at('2026-11-02', 7));
  const nap = sleep(at('2026-11-02', 9), at('2026-11-02', 10));
  const plan = dayPlan({ sleeps: [night, nap], child, now });
  assert.equal(plan.status, 'ok');
  assert.equal(plan.items[0].done, true);
  assert.equal(plan.items[0].start, nap.start);
  assert.equal(plan.items.filter((i) => i.kind === 'nap').length, 4);
  assert.equal(plan.items.at(-1).kind, 'bed');
  const starts = plan.items.map((i) => i.start);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
});

test('day plan asks for the morning first', () => {
  const now = at('2026-11-02', 6);
  assert.equal(dayPlan({ sleeps: [], child: baby(120, now), now }).status, 'nomorning');
});

test('day plan does not schedule naps late in the evening', () => {
  const now = at('2026-11-02', 17, 45);
  const child = baby(120, now);
  const plan = dayPlan({ sleeps: [sleep(at('2026-11-02', 16, 45), at('2026-11-02', 17, 40))], child, now });
  assert.ok(plan.items.filter((i) => i.kind === 'nap' && !i.done).every((i) => new Date(i.start).getHours() < 19));
});

// ---------- reports ----------
test('sleep across midnight is split between days and only counted once', () => {
  const entry = sleep(at('2026-11-01', 20), at('2026-11-02', 6));
  const a = dayStats([entry], fromIso('2026-11-01'));
  const b = dayStats([entry], fromIso('2026-11-02'));
  assert.equal(a.sleep.total, 4 * HOUR);
  assert.equal(b.sleep.total, 6 * HOUR);
  assert.equal(a.sleep.total + b.sleep.total, 10 * HOUR);
});

test('night wakings reduce sleep in the day they happen', () => {
  const entry = sleep(at('2026-11-01', 22), at('2026-11-02', 6), {
    data: { wakes: [{ from: at('2026-11-02', 2), to: at('2026-11-02', 2, 30) }] },
  });
  assert.equal(netSleep(entry, fromIso('2026-11-02'), fromIso('2026-11-03')), 5.5 * HOUR);
  assert.equal(netSleep(entry, fromIso('2026-11-01'), fromIso('2026-11-02')), 2 * HOUR);
});

test('splits day and night sleep', () => {
  const stats = dayStats([sleep(at('2026-11-02', 13), at('2026-11-02', 14)), sleep(at('2026-11-02', 20), at('2026-11-02', 23))], fromIso('2026-11-02'));
  assert.equal(stats.sleep.day, HOUR);
  assert.equal(stats.sleep.night, 3 * HOUR);
  assert.equal(stats.sleep.naps, 2);
});

test('a day with a clock change still totals correctly', () => {
  const entry = sleep(at('2026-10-24', 22), at('2026-10-25', 8));
  const a = dayStats([entry], fromIso('2026-10-24')).sleep.total;
  const b = dayStats([entry], fromIso('2026-10-25')).sleep.total;
  assert.equal(a + b, entry.end - entry.start);
});

test('counts feeds by kind so breast milk and formula stay apart', () => {
  const day = fromIso('2026-11-02');
  const e = [
    { type: 'bottle', start: day + HOUR, data: { ml: 100, kind: 'breast' } },
    { type: 'bottle', start: day + 2 * HOUR, data: { ml: 80, kind: 'formula' } },
    { type: 'diaper', start: day + 3 * HOUR, data: { kind: 'wet' } },
    { type: 'diaper', start: day + 3 * HOUR, data: { mode: 'potty', kind: 'wet' } },
    { type: 'bottle', start: day + 4 * HOUR, data: { ml: 500, kind: 'breast' }, deletedAt: day },
  ];
  const s = dayStats(e, day);
  assert.deepEqual(s.bottle, { breast: 100, formula: 80, other: 0, total: 180, count: 2 });
  assert.equal(s.diaper.total, 1);
  assert.equal(s.potty, 1);
});

test('the average skips days without any data', () => {
  const now = at('2026-11-02', 20);
  const entries = [
    { type: 'bottle', start: at('2026-11-02', 8), data: { ml: 100, kind: 'breast' } },
    { type: 'bottle', start: at('2026-10-30', 8), data: { ml: 200, kind: 'breast' } },
  ];
  const series = metricSeries(entries, now, 7, 'bottle');
  assert.equal(series.rows.length, 7);
  assert.equal(series.average, 150);
  assert.equal(series.filledDays, 2);
  assert.equal(metricSeries([], now, 7, 'bottle').average, null);
});

test('insights only compare weeks with enough data', () => {
  const now = at('2026-11-02', 20);
  const entries = [];
  for (let i = 0; i < 14; i += 1) {
    const day = addDays(startOfDay(now), -i);
    entries.push({ type: 'bottle', start: day + 8 * HOUR, data: { ml: i < 7 ? 600 : 500, kind: 'breast' } });
  }
  assert.deepEqual(insights(entries, now), ['Flasche: im Schnitt 100 ml mehr pro Tag als in der Woche davor.']);
  assert.deepEqual(insights(entries.slice(0, 3), now), []);
});

test('finds the last entry per type', () => {
  const e = [
    { type: 'bottle', start: 100, data: {} },
    { type: 'bottle', start: 300, data: {} },
    { type: 'bottle', start: 400, data: {}, deletedAt: 500 },
    { type: 'sleep', start: 100, end: 900, data: {} },
  ];
  const last = lastByType(e);
  assert.equal(last.bottle.start, 300);
  assert.equal(last.sleep.end, 900);
});

test('food log tracks first time and reactions', () => {
  const log = foodLog([
    { type: 'solids', start: 100, data: { foods: ['Ei'], liked: 'mag' } },
    { type: 'solids', start: 200, data: { foods: ['Ei', 'Karotte'], reaction: 'Ausschlag' } },
    { type: 'solids', start: 300, data: {} },
  ]);
  const ei = log.find((x) => x.food === 'Ei');
  assert.equal(ei.times, 2);
  assert.equal(ei.first, 100);
  assert.equal(ei.reaction, 'Ausschlag');
  assert.equal(log.length, 2);
});

test('remembers the last nursing side', () => {
  assert.equal(lastNursingSide([
    { type: 'nursing', start: 100, end: 200, data: { lastSide: 'left' } },
    { type: 'nursing', start: 300, end: 400, data: { lastSide: 'right' } },
  ]), 'right');
  assert.equal(lastNursingSide([]), null);
});

// ---------- growth ----------
test('median WHO weight at birth is the 50th percentile', () => {
  assert.equal(percentile('weight', 'm', 0, 3.3464), 50);
  assert.equal(percentile('weight', 'f', 0, 3.2322), 50);
});

test('LMS formula and inverse agree', () => {
  const v = valueAtZ(1.5, 0.3487, 3.3464, 0.14602);
  assert.ok(Math.abs(zScore(v, 0.3487, 3.3464, 0.14602) - 1.5) < 1e-9);
  assert.ok(Math.abs(valueAtZ(1, 0, 10, 0.1) - 10 * Math.exp(0.1)) < 1e-9);
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
});

test('known WHO values at one year', () => {
  // WHO boys, weight-for-age, 12 months: median about 9.6 kg, 3rd percentile about 7.8 kg
  assert.ok(Math.abs(percentile('weight', 'm', 365, 9.6) - 50) < 3);
  assert.ok(Math.abs(percentile('weight', 'm', 365, 7.8) - 3) < 2);
  // WHO girls, length-for-age, 12 months: median about 74 cm
  assert.ok(Math.abs(percentile('length', 'f', 365, 74) - 50) < 3);
  // WHO boys, head circumference, 12 months: median about 46 cm
  assert.ok(Math.abs(percentile('head', 'm', 365, 46.1) - 50) < 4);
});

test('no percentile without sex or beyond two years', () => {
  assert.equal(percentile('weight', null, 100, 6), null);
  assert.equal(percentile('weight', 'm', 900, 12), null);
  assert.equal(percentile('weight', 'm', 100, 0), null);
});

test('curves grow with age and labels stay plain', () => {
  const c = curve('weight', 'f', 0);
  assert.ok(c.length > 40);
  assert.ok(c.at(-1)[1] > c[0][1]);
  assert.equal(percentileLabel(50.2), '50. Perzentile');
  assert.equal(percentileLabel(0.4), 'unter der 1. Perzentile');
  assert.equal(percentileLabel(null), null);
});

// ---------- reminders ----------
test('calendar file has an alert, repeats daily and escapes text', () => {
  const now = at('2026-11-02', 20);
  const ics = reminderToIcs({ id: 'r1', title: 'Vitamin D, täglich; bitte', hour: 8, minute: 30, repeat: 'daily' }, now);
  assert.match(ics, /DTSTART:20261103T083000/);
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /SUMMARY:Vitamin D\\, täglich\\; bitte/);
  assert.ok(ics.includes('\r\n'));
});

test('one-time calendar file uses its own time and does not repeat', () => {
  const now = at('2026-11-02', 20);
  const ics = reminderToIcs({ id: 'r2', title: 'Dafalgan', at: at('2026-11-03', 2, 15), repeat: 'once' }, now);
  assert.match(ics, /DTSTART:20261103T021500/);
  assert.doesNotMatch(ics, /RRULE/);
});

test('reminders fire once per occurrence', () => {
  const now = at('2026-11-02', 9);
  const daily = { hour: 8, minute: 0, repeat: 'daily' };
  assert.equal(isDue(daily, now), true);
  assert.equal(isDue({ ...daily, firedAt: at('2026-11-02', 8) }, now), false);
  assert.equal(isDue({ ...daily, firedAt: at('2026-11-01', 8) }, now), true);
  assert.equal(isDue({ ...daily, hour: 10 }, now), false);
  assert.equal(isDue({ ...daily, enabled: false }, now), false);
  assert.equal(isDue({ at: now - 1 }, now), true);
  assert.equal(isDue({ at: now - 1, firedAt: now }, now), false);
});

// ---------- quick entry ----------
const NOW = at('2026-11-02', 15, 0);
test('reads a bottle with amount, kind and relative time', () => {
  const p = parseQuick('120 ml Flasche Muttermilch vor 20 Minuten', NOW);
  assert.equal(p.type, 'bottle');
  assert.deepEqual(p.data, { ml: 120, kind: 'breast' });
  assert.equal(p.start, NOW - 20 * MIN);
});

test('understands the Swiss word Schoppen and a clock time', () => {
  const p = parseQuick('Schoppen 90 Pre um 14:30', NOW);
  assert.deepEqual(p.data, { ml: 90, kind: 'formula' });
  assert.equal(clock(p.start), '14:30');
});

test('reads a nap with a time range', () => {
  const p = parseQuick('Nickerchen von 13:00 bis 14:10', NOW);
  assert.equal(p.type, 'sleep');
  assert.equal(clock(p.start), '13:00');
  assert.equal(clock(p.end), '14:10');
});

test('a night range that crosses midnight ends on the next day', () => {
  const p = parseQuick('gestern geschlafen von 22:00 bis 6:30', NOW);
  assert.equal(isoDate(p.start), '2026-11-01');
  assert.equal(isoDate(p.end), '2026-11-02');
});

test('reads diapers', () => {
  assert.equal(parseQuick('Windel voll', NOW).data.kind, 'dirty');
  assert.equal(parseQuick('windel nass vor 1 stunde', NOW).start, NOW - HOUR);
  assert.equal(parseQuick('gewickelt, beides', NOW).data.kind, 'both');
});

test('reads nursing per side', () => {
  const p = parseQuick('rechts gestillt 12 min', NOW);
  assert.equal(p.data.right, 12 * MIN);
  assert.equal(p.end - p.start, 12 * MIN);
});

test('reads temperature with a comma', () => {
  assert.equal(parseQuick('Fieber 38,2', NOW).data.celsius, 38.2);
});

test('reads medicine, pumping and tummy time', () => {
  assert.deepEqual(parseQuick('Dafalgan 2.5 ml', NOW).data, { name: 'Dafalgan', dose: '2.5 ml' });
  assert.equal(parseQuick('abgepumpt 80 ml beide', NOW).data.side, 'both');
  assert.equal(parseQuick('15 min bauchzeit', NOW).data.ms, 15 * MIN);
});

test('returns nothing rather than guess', () => {
  assert.equal(parseQuick('schöner Tag heute', NOW), null);
  assert.equal(parseQuick('Flasche', NOW), null);
  assert.equal(parseQuick('', NOW), null);
  assert.equal(parseQuick('Temperatur hoch', NOW), null);
});

test('a time later today is taken as yesterday, never the future', () => {
  const p = parseQuick('Flasche 100 ml um 18:00', NOW);
  assert.equal(isoDate(p.start), '2026-11-01');
});

// ---------- describe ----------
test('describes entries in plain words', () => {
  const start = at('2026-11-02', 13);
  assert.equal(describeEntry({ type: 'bottle', start, data: { ml: 120, kind: 'formula' } }).detail, '120 ml Pre-Milch');
  assert.equal(describeEntry({ type: 'sleep', start, end: start + HOUR, data: { wakes: [{ from: start + 5 * MIN, to: start + 15 * MIN }] } }).detail, '13:00 bis 14:00, 50 Min, 1-mal kurz wach');
  assert.equal(describeEntry({ type: 'nursing', start, data: { left: 5 * MIN, right: 7 * MIN } }).detail, 'Links 5 Min, rechts 7 Min');
  assert.equal(describeEntry({ type: 'solids', start, data: {} }).detail, 'Ohne Details');
  assert.equal(describeEntry({ type: 'temperature', start, data: { celsius: 38.2 } }).detail, '38,2 °C');
});

// ---------- store ----------
const clockFn = () => { let t = at('2026-11-02', 10); return () => (t += 1000); };
const ids = () => { let i = 0; return () => `id${(i += 1)}`; };
const makeStore = (storage = memoryStorage()) => createStore({ storage, now: clockFn(), id: ids() });

test('every save is on disk immediately', () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  const child = store.addChild({ name: 'Mia', phase: 'born', birthDate: '2026-06-01' });
  store.addEntry({ childId: child.id, type: 'bottle', start: 5, data: { ml: 100 } });
  const again = makeStore(storage);
  assert.equal(again.state.entries.length, 1);
  assert.equal(again.activeChild().name, 'Mia');
});

test('a running timer survives an app restart', () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  const child = store.addChild({ name: 'Mia' });
  const timer = store.startTimer(child.id, 'sleep', { wakes: [] });
  const again = makeStore(storage);
  assert.equal(again.timerFor(child.id, 'sleep').start, timer.start);
});

test('starting a timer twice keeps the first start', () => {
  const store = makeStore();
  const child = store.addChild({ name: 'Mia' });
  const first = store.startTimer(child.id, 'sleep');
  const second = store.startTimer(child.id, 'sleep');
  assert.equal(first.id, second.id);
  assert.equal(store.state.timers.length, 1);
});

test('delete and undo restore an entry', () => {
  const store = makeStore();
  const child = store.addChild({ name: 'Mia' });
  const entry = store.addEntry({ childId: child.id, type: 'diaper', start: 5, data: { kind: 'wet' } });
  store.deleteEntry(entry.id);
  assert.equal(store.entriesFor(child.id).length, 0);
  store.restoreEntry(entry);
  assert.equal(store.entriesFor(child.id).length, 1);
  assert.equal(store.entry(entry.id).deletedAt, undefined);
});

test('editing returns the previous version for undo', () => {
  const store = makeStore();
  const child = store.addChild({ name: 'Mia' });
  const entry = store.addEntry({ childId: child.id, type: 'bottle', start: 5, data: { ml: 100 }, note: 'hallo' });
  const before = store.updateEntry(entry.id, { data: { ml: 120 }, note: '' });
  assert.equal(store.entry(entry.id).data.ml, 120);
  assert.equal(store.entry(entry.id).note, undefined);
  store.restoreEntry(before);
  assert.equal(store.entry(entry.id).data.ml, 100);
  assert.equal(store.entry(entry.id).note, 'hallo');
});

test('a damaged save falls back to the safety copy', () => {
  const good = JSON.stringify({ ...emptyState(), children: [{ id: 'a', name: 'Mia', updatedAt: 5 }] });
  const store = makeStore(memoryStorage({ [STORAGE_KEYS.KEY]: '{kaputt', [STORAGE_KEYS.BACKUP_KEY]: good }));
  assert.equal(store.recovered, true);
  assert.equal(store.liveChildren()[0].name, 'Mia');
});

test('damage without a safety copy starts empty and does not crash', () => {
  const store = makeStore(memoryStorage({ [STORAGE_KEYS.KEY]: '{kaputt' }));
  assert.deepEqual(store.state.entries, []);
});

test('full storage gives up the safety copy first, then reports the error', () => {
  const data = memoryStorage();
  let full = false;
  const storage = {
    ...data,
    setItem(k, v) {
      if (full && k === STORAGE_KEYS.BACKUP_KEY) throw new Error('quota');
      if (full === 'all') throw new Error('quota');
      data.setItem(k, v);
    },
  };
  const errors = [];
  const store = createStore({ storage, now: clockFn(), id: ids(), onError: (e) => errors.push(e) });
  store.addChild({ name: 'Mia' });
  full = true;
  store.state.backupAt = 0;
  assert.equal(store.updateSettings({ theme: 'dark' }), true);
  assert.equal(errors.length, 0);
  full = 'all';
  assert.equal(store.updateSettings({ theme: 'light' }), false);
  assert.equal(errors.length, 1);
});

test('backup round trip restores everything on an empty device', () => {
  const a = makeStore();
  const child = a.addChild({ name: 'Mia', birthDate: '2026-06-01' });
  a.addEntry({ childId: child.id, type: 'bottle', start: 5, data: { ml: 100 } });
  a.updateSettings({ home: ['sleep'] });
  const b = createStore({ storage: memoryStorage(), now: clockFn(), id: () => 'other' });
  const result = b.importBackup(a.exportBackup());
  assert.equal(result.added, 1);
  assert.equal(b.activeChild().name, 'Mia');
  assert.deepEqual(b.state.settings.home, ['sleep']);
});

test('importing rejects foreign files with a clear message', () => {
  const store = makeStore();
  assert.throws(() => store.importBackup('kein json'), /lässt sich nicht lesen/);
  assert.throws(() => store.importBackup('{"foo":1}'), /keine Flaum-Sicherung/);
});

test('import ignores malformed and unknown entries', () => {
  const clean = sanitize({
    entries: [
      { id: 'ok', childId: 'c', type: 'bottle', start: 5, data: {} },
      { id: 'bad-type', childId: 'c', type: 'hack', start: 5 },
      { id: 'bad-time', childId: 'c', type: 'bottle', start: 'gestern' },
      'unsinn',
    ],
    settings: { theme: '<script>', home: ['sleep', 'hack'] },
  });
  assert.deepEqual(clean.entries.map((e) => e.id), ['ok']);
  assert.equal(clean.settings.theme, 'auto');
  assert.deepEqual(clean.settings.home, ['sleep']);
});

test('merge keeps the newest change and carries deletions across', () => {
  const entry = { id: 'e1', childId: 'c', type: 'bottle', start: 5, data: { ml: 100 }, updatedAt: 10 };
  const mine = { ...emptyState(), children: [{ id: 'c', name: 'Mia', updatedAt: 1 }], entries: [entry] };
  const newer = { ...emptyState(), entries: [{ ...entry, data: { ml: 150 }, updatedAt: 20 }] };
  const older = { ...emptyState(), entries: [{ ...entry, data: { ml: 80 }, updatedAt: 5 }] };
  const deleted = { ...emptyState(), entries: [{ ...entry, deletedAt: 30, updatedAt: 30 }] };
  assert.equal(mergeStates(mine, newer).state.entries[0].data.ml, 150);
  assert.equal(mergeStates(mine, older).state.entries[0].data.ml, 100);
  assert.equal(mergeStates(mine, deleted).state.entries[0].deletedAt, 30);
});

test('a deleted entry does not come back from an older partner file', () => {
  const entry = { id: 'e1', childId: 'c', type: 'bottle', start: 5, data: {}, updatedAt: 10 };
  const mine = { ...emptyState(), entries: [{ ...entry, deletedAt: 30, updatedAt: 30 }] };
  const theirs = { ...emptyState(), entries: [entry] };
  assert.equal(mergeStates(mine, theirs).state.entries[0].deletedAt, 30);
});

test('two phones with the same child end up with one child', () => {
  const mine = { ...emptyState(), children: [{ id: 'mine', name: 'Mia', birthDate: '2026-06-01', updatedAt: 1 }] };
  const theirs = {
    ...emptyState(),
    children: [{ id: 'theirs', name: 'mia ', birthDate: '2026-06-01', updatedAt: 1 }],
    entries: [{ id: 'e', childId: 'theirs', type: 'diaper', start: 5, data: {}, updatedAt: 5 }],
    timers: [{ id: 't', childId: 'theirs', type: 'sleep', start: 5 }],
  };
  const { state } = mergeStates(mine, theirs);
  assert.equal(state.children.length, 1);
  assert.equal(state.entries[0].childId, 'mine');
  assert.equal(state.timers[0].childId, 'mine');
});

test('deleting a child removes its entries and timers', () => {
  const store = makeStore();
  const a = store.addChild({ name: 'A' });
  const b = store.addChild({ name: 'B' });
  store.addEntry({ childId: a.id, type: 'diaper', start: 5, data: {} });
  store.startTimer(a.id, 'sleep');
  store.deleteChild(a.id);
  assert.equal(store.entriesFor(a.id).length, 0);
  assert.equal(store.timersFor(a.id).length, 0);
  assert.equal(store.activeChild().id, b.id);
});

// ---------- demo ----------
test('sample data is valid, flagged and survives sanitizing', () => {
  const now = at('2026-11-02', 15);
  const raw = demoState(now);
  const clean = sanitize(JSON.parse(JSON.stringify(raw)));
  assert.equal(clean.demo, true);
  assert.equal(clean.entries.length, raw.entries.length);
  assert.ok(clean.entries.every((e) => e.start <= now && (!e.end || e.end <= now)));
  assert.equal(clean.children.length, 2);
  assert.ok(clean.entries.length > 400);
});

test('days are 24 hours apart outside clock changes', () => {
  assert.equal(addDays(fromIso('2026-11-02'), 1) - fromIso('2026-11-02'), DAY);
});

// ---------- untrusted files ----------
test('entry details from a file are reduced to plain numbers and short text', () => {
  const clean = sanitize({
    entries: [{
      id: 'x', childId: 'c', type: 'bottle', start: 5,
      data: {
        ml: '<img src=x onerror=alert(1)>',
        kind: 'x'.repeat(500),
        wakes: [{ from: 1, to: 2 }, { from: 'a' }],
        foods: ['Ei', { evil: true }],
        nested: { a: 1 },
        celsius: 38.5,
      },
    }],
  });
  const { data } = clean.entries[0];
  assert.equal(data.ml, undefined);
  assert.equal(data.kind.length, 200);
  assert.deepEqual(data.wakes, [{ from: 1, to: 2 }]);
  assert.deepEqual(data.foods, ['Ei']);
  assert.equal(data.nested, undefined);
  assert.equal(data.celsius, 38.5);
});

test('timers from a file keep only known fields', () => {
  const clean = sanitize({ timers: [{ id: 't', childId: 'c', type: 'nursing', start: 5, sides: { left: 'x', right: 2 }, active: 'left', since: 'y', evil: 'z' }] });
  assert.deepEqual(clean.timers[0], { id: 't', childId: 'c', type: 'nursing', start: 5, sides: { left: 0, right: 2 }, active: null, since: null });
});

test('contraction durations stay exact in seconds', async () => {
  const { durSeconds } = await import('../src/core/time.js');
  assert.equal(durSeconds(52_000), '52 Sek');
  assert.equal(durSeconds(60_000), '1 Min');
  assert.equal(durSeconds(75_000), '1 Min 15 Sek');
  assert.equal(durSeconds(150_000), '3 Min');
  const start = at('2026-11-02', 13);
  assert.equal(describeEntry({ type: 'contraction', start, end: start + 48_000, data: { intensity: 'strong' } }).detail, '48 Sek, Stark');
});
