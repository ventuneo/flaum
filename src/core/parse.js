import { HOUR, MIN, addDays, atTime, startOfDay } from './time.js';

const num = (text) => Number(String(text).replace(',', '.'));

function readClock(hh, mm) {
  const h = Number(hh);
  const m = mm === undefined ? 0 : Number(mm);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

const CLOCK = String.raw`(\d{1,2})(?:[:.h](\d{2}))?`;

function readTimes(text, now) {
  const baseDay = /\bgestern\b/.test(text) ? addDays(startOfDay(now), -1) : startOfDay(now);
  const range = text.match(new RegExp(`(?:von\\s+)?\\b${CLOCK}(?:\\s*uhr)?\\s*(?:bis|-|–)\\s*${CLOCK}\\b`));
  if (range) {
    const a = readClock(range[1], range[2]);
    const b = readClock(range[3], range[4]);
    if (a && b) {
      const start = atTime(baseDay, a.h, a.m);
      let end = atTime(baseDay, b.h, b.m);
      if (end <= start) end = addDays(end, 1);
      return { start, end };
    }
  }
  const ago = text.match(/\bvor\s+(\d+(?:[.,]\d+)?)\s*(min|minuten|std|stunden?|h)\b/);
  if (ago) {
    const unit = ago[2].startsWith('min') ? MIN : HOUR;
    return { start: now - num(ago[1]) * unit };
  }
  const at = text.match(new RegExp(`\\bum\\s+${CLOCK}(?:\\s*uhr)?\\b`)) ?? text.match(/\b(\d{1,2})[:.](\d{2})(?:\s*uhr)?\b/);
  if (at) {
    const c = readClock(at[1], at[2]);
    if (c) return { start: atTime(baseDay, c.h, c.m) };
  }
  return { start: baseDay === startOfDay(now) ? now : atTime(baseDay, new Date(now).getHours(), new Date(now).getMinutes()) };
}

const readMinutes = (text) => {
  const m = text.match(/\b(\d+)\s*(?:min|minuten)\b(?!\s*(?:her))/);
  if (m && !/\bvor\s+\d+\s*(?:min|minuten)\b/.test(text)) return Number(m[1]);
  const all = [...text.matchAll(/(vor\s+)?\b(\d+)\s*(?:min|minuten)\b/g)].filter((x) => !x[1]);
  return all.length ? Number(all[0][2]) : null;
};

const readMl = (text) => {
  const m = text.match(/\b(\d{1,4})\s*ml\b/);
  return m ? Number(m[1]) : null;
};

const RULES = [
  {
    match: /\b(flasche|schoppen|fläschchen)\b/,
    build(text) {
      const ml = readMl(text) ?? (text.match(/\b(\d{2,3})\b(?!\s*[:.]\d)/) ? Number(text.match(/\b(\d{2,3})\b(?!\s*[:.]\d)/)[1]) : null);
      if (!ml) return null;
      let kind = 'other';
      if (/muttermilch|\bmm\b/.test(text)) kind = 'breast';
      else if (/\bpre\b|pre-milch|pulver|säuglingsmilch|formula/.test(text)) kind = 'formula';
      return { type: 'bottle', data: { ml, kind } };
    },
  },
  {
    match: /(abgepumpt|abpumpen|gepumpt|\bpumpe)/,
    build(text) {
      const side = /links/.test(text) ? 'left' : /rechts/.test(text) ? 'right' : /beide/.test(text) ? 'both' : null;
      const minutes = readMinutes(text);
      return { type: 'pump', data: { ml: readMl(text) ?? 0, side, ms: minutes ? minutes * MIN : 0 } };
    },
  },
  {
    match: /(gestillt|stillen|\bbrust\b)/,
    build(text) {
      const minutes = readMinutes(text);
      if (!minutes) return null;
      const ms = minutes * MIN;
      if (/rechts/.test(text)) return { type: 'nursing', data: { left: 0, right: ms, lastSide: 'right' }, length: ms };
      return { type: 'nursing', data: { left: ms, right: 0, lastSide: 'left' }, length: ms };
    },
  },
  {
    match: /(windel|gewickelt)/,
    build(text) {
      let kind = 'wet';
      if (/beides|nass und voll|voll und nass/.test(text)) kind = 'both';
      else if (/voll|stuhl|kacka/.test(text)) kind = 'dirty';
      else if (/trocken/.test(text)) kind = 'dry';
      return { type: 'diaper', data: { mode: 'diaper', kind } };
    },
  },
  {
    match: /(schlaf|geschlafen|nickerchen|eingeschlafen)/,
    build(text, times) {
      if (times.end) return { type: 'sleep', data: { wakes: [] } };
      const minutes = readMinutes(text);
      if (!minutes) return null;
      return { type: 'sleep', data: { wakes: [] }, length: minutes * MIN, endsAtStart: true };
    },
  },
  {
    match: /(temperatur|fieber)/,
    build(text) {
      const m = text.match(/\b(3\d|4[0-2])(?:[.,](\d))?\b/);
      if (!m) return null;
      return { type: 'temperature', data: { celsius: Number(`${m[1]}.${m[2] ?? 0}`) } };
    },
  },
  {
    match: /(bauchzeit)/,
    build(text) {
      const minutes = readMinutes(text);
      return { type: 'activity', data: { kind: 'Bauchzeit', ms: minutes ? minutes * MIN : 0 } };
    },
  },
  {
    match: /\b(gebadet|baden)\b/,
    build: (text) => ({ type: 'activity', data: { kind: 'Baden', ms: (readMinutes(text) ?? 0) * MIN } }),
  },
  {
    match: /\b(medizin|medikament|paracetamol|ibuprofen|dafalgan|algifor|vitamin d|zäpfchen)\b/,
    build(text) {
      const name = text.match(/\b(paracetamol|ibuprofen|dafalgan|algifor|vitamin d|zäpfchen)\b/)?.[1];
      const dose = text.match(/\b(\d+(?:[.,]\d+)?\s*(?:ml|mg|tropfen))\b/)?.[1] ?? '';
      if (!name) return null;
      return { type: 'medicine', data: { name: name.charAt(0).toUpperCase() + name.slice(1), dose } };
    },
  },
];

/**
 * Reads a typed or dictated sentence with fixed rules. No AI and no network.
 * The result is always shown before saving. It returns null rather than guess.
 */
export function parseQuick(input, now) {
  const text = String(input ?? '').toLowerCase().trim();
  if (!text) return null;
  const times = readTimes(text, now);
  for (const rule of RULES) {
    if (!rule.match.test(text)) continue;
    const built = rule.build(text, times);
    if (!built) return null;
    let { start, end } = times;
    if (built.length && built.endsAtStart) {
      end = start;
      start = end - built.length;
    } else if (built.length && !end) {
      end = start + built.length;
    }
    if (start > now + MIN) start = addDays(start, -1);
    if (end && end > now + MIN) {
      start = addDays(start, -1);
      end = addDays(end, -1);
    }
    const out = { type: built.type, start, data: built.data };
    if (end) out.end = end;
    return out;
  }
  return null;
}
