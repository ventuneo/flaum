import { WHO } from './who-data.js';

function rowAt(table, ageDays) {
  if (ageDays < table[0][0] || ageDays > table[table.length - 1][0]) return null;
  let i = 0;
  while (i < table.length - 1 && table[i + 1][0] <= ageDays) i += 1;
  const a = table[i];
  const b = table[i + 1];
  if (!b || a[0] === ageDays) return a.slice(1);
  const t = (ageDays - a[0]) / (b[0] - a[0]);
  return [1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * t);
}

// Abramowitz & Stegun 26.2.17, accurate to about seven decimals.
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function zScore(value, l, m, s) {
  if (l === 0) return Math.log(value / m) / s;
  return ((value / m) ** l - 1) / (l * s);
}

export function valueAtZ(z, l, m, s) {
  if (l === 0) return m * Math.exp(s * z);
  return m * (1 + l * s * z) ** (1 / l);
}

/** WHO percentile for 0 to 24 months. Returns null outside that range or without a sex. */
export function percentile(metric, sex, ageDays, value) {
  const table = WHO[metric]?.[sex];
  if (!table || !(value > 0)) return null;
  const row = rowAt(table, ageDays);
  if (!row) return null;
  return Math.round(normalCdf(zScore(value, ...row)) * 1000) / 10;
}

export function curve(metric, sex, z, step = 14) {
  const table = WHO[metric]?.[sex];
  if (!table) return [];
  const out = [];
  const maxAge = table[table.length - 1][0];
  for (let age = 0; age <= maxAge; age += step) {
    const row = rowAt(table, age);
    if (row) out.push([age, valueAtZ(z, ...row)]);
  }
  return out;
}

export function percentileLabel(p) {
  if (p === null) return null;
  if (p < 1) return 'unter der 1. Perzentile';
  if (p > 99) return 'über der 99. Perzentile';
  return `${Math.round(p)}. Perzentile`;
}
