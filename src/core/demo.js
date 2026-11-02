import { HOUR, MIN, addDays, atTime, isoDate, startOfDay } from './time.js';
import { emptyState } from './store.js';

// Sample data so the screens can be judged with content. Clearly flagged in the app.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function demoState(now) {
  const state = emptyState();
  state.demo = true;
  const today = startOfDay(now);
  const baby = { id: 'demo-mia', name: 'Mia', phase: 'born', birthDate: isoDate(addDays(today, -158)), dueDate: isoDate(addDays(today, -160)), sex: 'f', updatedAt: now };
  const bump = { id: 'demo-bauch', name: 'Bauchzwerg', phase: 'expecting', birthDate: null, dueDate: isoDate(addDays(today, 25)), sex: null, updatedAt: now };
  state.children = [baby, bump];
  state.settings.activeChildId = baby.id;

  const r = rng(21);
  const jitter = (range) => (r() - 0.5) * range;
  let n = 0;
  const add = (childId, type, start, end, data, note) => {
    if (start > now || (end && end > now)) return;
    n += 1;
    const e = { id: `demo-${n}`, childId, type, start, data, createdAt: start, updatedAt: start };
    if (end) e.end = end;
    if (note) e.note = note;
    state.entries.push(e);
  };

  const foods = [['Karotte'], ['Banane'], ['Kürbis', 'Hafer'], ['Birne'], ['Avocado'], ['Ei'], ['Erdnussmus']];

  for (let i = 27; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const prevEvening = atTime(addDays(day, -1), 19, 20) + jitter(30 * MIN);
    const morning = atTime(day, 6, 50) + jitter(40 * MIN);
    const wakeAt = atTime(day, 2, 10) + jitter(60 * MIN);
    add(baby.id, 'sleep', prevEvening, morning, { wakes: [{ from: wakeAt, to: wakeAt + 18 * MIN }] });

    let cursor = morning;
    for (let nap = 0; nap < 3; nap += 1) {
      cursor += (2 * HOUR + 10 * MIN) + jitter(35 * MIN);
      const length = (nap === 1 ? 95 : 50) * MIN + jitter(20 * MIN);
      add(baby.id, 'sleep', cursor, cursor + length, { wakes: [] });
      cursor += length;
    }

    const feeds = [7, 10.5, 14, 17.5, 21];
    feeds.forEach((hour, index) => {
      const t = day + hour * HOUR + jitter(40 * MIN);
      if (index % 2 === 0) {
        const left = (7 + r() * 6) * MIN;
        const right = (6 + r() * 6) * MIN;
        add(baby.id, 'nursing', t, t + left + right, { left, right, lastSide: index % 4 === 0 ? 'right' : 'left' });
      } else {
        add(baby.id, 'bottle', t, undefined, { ml: 90 + Math.round(r() * 8) * 10, kind: r() > 0.45 ? 'breast' : 'formula' });
      }
    });

    for (let w = 0; w < 6; w += 1) {
      const t = day + (6.5 + w * 2.6) * HOUR + jitter(30 * MIN);
      add(baby.id, 'diaper', t, undefined, { mode: 'diaper', kind: w % 3 === 2 ? 'both' : 'wet' });
    }

    if (i % 2 === 0) {
      const t = day + 13 * HOUR + jitter(HOUR);
      add(baby.id, 'pump', t, undefined, { ml: 70 + Math.round(r() * 6) * 10, side: 'both', ms: 18 * MIN });
    }
    const tummy = day + 9.5 * HOUR + jitter(HOUR);
    add(baby.id, 'activity', tummy, undefined, { kind: 'Bauchzeit', ms: (8 + r() * 10) * MIN });

    if (i < foods.length) {
      const t = day + 11.5 * HOUR + jitter(30 * MIN);
      add(baby.id, 'solids', t, undefined, { foods: foods[i], liked: i % 3 === 0 ? 'mag' : 'geht' }, i === 3 ? 'Erst skeptisch, dann drei Löffel gegessen.' : undefined);
    }
  }

  // At night the sample baby is asleep, so the screens look the same at any hour.
  const tonight = atTime(today, 19, 20);
  const lastNight = atTime(addDays(today, -1), 19, 20);
  const morning = atTime(today, 6, 50);
  if (now >= tonight || now < morning) {
    state.timers.push({ id: 'demo-timer', childId: baby.id, type: 'sleep', start: now >= tonight ? tonight : lastNight, wakes: [] });
  }

  [[0, 3.1, 49.5, 34], [30, 4.2, 54, 37], [61, 5.3, 58, 38.8], [92, 6.1, 61.2, 40], [122, 6.7, 63.5, 41], [152, 7.2, 65.5, 42]].forEach(([age, weight, length, head]) => {
    add(baby.id, 'growth', addDays(today, -158 + age) + 10 * HOUR, undefined, { weight, length, head });
  });
  add(baby.id, 'milestone', addDays(today, -110) + 9 * HOUR, undefined, { name: 'Erstes Lächeln' });
  add(baby.id, 'milestone', addDays(today, -24) + 16 * HOUR, undefined, { name: 'Dreht sich' });
  add(baby.id, 'note', addDays(today, -2) + 20 * HOUR, undefined, { done: false }, 'Fragen, ab wann Wasser in der Flasche sinnvoll ist.');
  add(baby.id, 'temperature', addDays(today, -6) + 8 * HOUR, undefined, { celsius: 37.4 });

  // Pregnancy: one finished, regular series so the contraction screen has content.
  let contraction = now - 37 * MIN;
  for (let i = 0; i < 7; i += 1) {
    add(bump.id, 'contraction', contraction, contraction + 52_000 + r() * 16_000, { intensity: i > 3 ? 'medium' : 'light' });
    contraction += 5.5 * MIN + jitter(40_000);
  }
  add(bump.id, 'mood', now - 20 * HOUR, undefined, { mood: 'hoffnungsvoll' });
  add(bump.id, 'note', now - 30 * HOUR, undefined, { done: false }, 'Fragen, wann wir mit dem Spital telefonieren sollen.');

  return state;
}
