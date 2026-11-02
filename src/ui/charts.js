// Small inline SVG charts. Marks use the validated series colours from styles.css,
// text stays in the ink tokens, and every chart has a table next to it.
import { curve } from '../core/growth.js';
import { METRICS } from '../core/reports.js';
import { addDays, clock, dateShort, fromIso, weekdayShort } from '../core/time.js';
import { describe } from '../core/describe.js';
import { esc } from './dom.js';

const W = 340;
const fmt = (n) => Math.round(n * 10) / 10;

const axisHours = (x0, plotW, y1, y2, labels = true) => [0, 6, 12, 18, 24].map((h) => {
  const x = fmt(x0 + (plotW * h) / 24);
  return `<line class="grid" x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"/>${labels ? `<text class="tick" x="${x}" y="${y1 - 6}" text-anchor="middle">${h}</text>` : ''}`;
}).join('');

const LANES = [
  { key: 'sleep', label: 'Schlaf' },
  { key: 'nursing', label: 'Stillen' },
  { key: 'bottle', label: 'Flasche' },
  { key: 'diaper', label: 'Windel' },
  { key: 'pump', label: 'Pumpen' },
];

/** One day, one lane per kind, so identity never rests on colour alone. Every mark opens its entry. */
export function dayLanes(entries, day, now) {
  const x0 = 58;
  const plotW = W - x0 - 8;
  const rowH = 34;
  const top = 22;
  const end = addDays(day, 1);
  const span = end - day;
  const xAt = (t) => x0 + (plotW * (Math.min(end, Math.max(day, t)) - day)) / span;

  const lanes = LANES.map((lane, i) => {
    const y = top + i * rowH;
    const mid = y + rowH / 2;
    const marks = entries.filter((e) => e.type === lane.key).map((e) => {
      const info = describe(e);
      const title = `<title>${esc(`${info.title}, ${clock(e.start)}, ${info.detail}`)}</title>`;
      if (e.end && e.end > day && e.start < end && (lane.key === 'sleep' || lane.key === 'nursing')) {
        const a = xAt(e.start);
        const b = xAt(e.end);
        const w = Math.max(4, b - a);
        return `<g role="button" tabindex="0" data-act="open-entry" data-v="${esc(e.id)}" class="mark" aria-label="${esc(`${info.title}, ${info.detail}`)}">${title}
          <rect class="hit" x="${fmt(a)}" y="${y}" width="${fmt(Math.max(w, 24))}" height="${rowH}"/>
          <rect class="fill c-${lane.key}" x="${fmt(a)}" y="${mid - 7}" width="${fmt(w)}" height="14" rx="4"/></g>`;
      }
      if (e.start < day || e.start >= end) return '';
      const x = xAt(e.start);
      return `<g role="button" tabindex="0" data-act="open-entry" data-v="${esc(e.id)}" class="mark" aria-label="${esc(`${info.title}, ${clock(e.start)}, ${info.detail}`)}">${title}
        <rect class="hit" x="${fmt(x - 12)}" y="${y}" width="24" height="${rowH}"/>
        <circle class="fill c-${lane.key} ring" cx="${fmt(x)}" cy="${mid}" r="5"/></g>`;
    }).join('');
    return `<text class="lane" x="0" y="${mid + 4}">${lane.label}</text>${marks}`;
  }).join('');

  const nowLine = now >= day && now < end ? `<line class="now" x1="${fmt(xAt(now))}" x2="${fmt(xAt(now))}" y1="${top}" y2="${top + rowH * LANES.length}"/>` : '';
  const height = top + rowH * LANES.length + 4;
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="Tagesverlauf von 0 bis 24 Uhr">
    ${axisHours(x0, plotW, top, top + rowH * LANES.length)}${nowLine}${lanes}</svg>`;
}

/** Seven strips, each one day from midnight to midnight. A tap opens that day. */
export function weekStrips(entries, weekStart, now) {
  const x0 = 50;
  const plotW = W - x0 - 8;
  const rowH = 38;
  const top = 22;
  const rows = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(weekStart, i);
    const end = addDays(day, 1);
    const span = end - day;
    const xAt = (t) => x0 + (plotW * (Math.min(end, Math.max(day, t)) - day)) / span;
    const y = top + i * rowH;
    const sleeps = entries.filter((e) => e.type === 'sleep' && e.end && e.end > day && e.start < end).map((e) => {
      const a = xAt(e.start);
      const w = Math.max(2, xAt(e.end) - a);
      return `<rect class="fill c-sleep" x="${fmt(a)}" y="${y + 7}" width="${fmt(w)}" height="12" rx="3"/>`;
    }).join('');
    const feeds = entries.filter((e) => (e.type === 'nursing' || e.type === 'bottle') && e.start >= day && e.start < end).map((e) =>
      `<circle class="fill c-${e.type}" cx="${fmt(xAt(e.start))}" cy="${y + 28}" r="3.5"/>`).join('');
    const future = day > now;
    const name = `${weekdayShort(day)} ${new Date(day).getDate()}.`;
    rows.push(`
      <g role="button" tabindex="0" data-act="open-day" data-v="${day}" class="mark${future ? ' is-future' : ''}" aria-label="${esc(`${dateShort(day)} öffnen`)}">
        <rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}"/>
        <text class="lane${now >= day && now < end ? ' is-today' : ''}" x="0" y="${y + 23}">${name}</text>
        ${sleeps}${feeds}
      </g>`);
  }
  const height = top + 7 * rowH + 4;
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="group" aria-label="Woche, ein Streifen pro Tag">
    ${axisHours(x0, plotW, top, height - 4)}${rows.join('')}</svg>`;
}

function niceStep(max, base) {
  let step = base;
  while (max / step > 4) step *= 2;
  return step;
}

const roundedTop = (x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h);
  return `M${fmt(x)} ${fmt(y + h)}V${fmt(y + rr)}Q${fmt(x)} ${fmt(y)} ${fmt(x + rr)} ${fmt(y)}H${fmt(x + w - rr)}Q${fmt(x + w)} ${fmt(y)} ${fmt(x + w)} ${fmt(y + rr)}V${fmt(y + h)}Z`;
};

/** Daily columns. Tapping a column selects it, the text above the chart then shows its values. */
export function barChart(series, metricKey, selected) {
  const metric = METRICS[metricKey];
  const { rows, max } = series;
  const H = 196;
  const x0 = 44;
  const y0 = 8;
  const plotW = W - x0 - 4;
  const plotH = H - y0 - 24;
  const step = niceStep(max || metric.step, metric.step);
  const top = Math.max(step, Math.ceil((max || step) / step) * step);
  const yAt = (v) => y0 + plotH - (plotH * v) / top;
  const band = plotW / rows.length;
  const barW = Math.min(24, Math.max(2, band * 0.68));
  const baseline = y0 + plotH;

  const ticks = [];
  for (let v = 0; v <= top + 1e-6; v += step) {
    ticks.push(`<line class="grid" x1="${x0}" x2="${W}" y1="${fmt(yAt(v))}" y2="${fmt(yAt(v))}"/><text class="tick" x="${x0 - 6}" y="${fmt(yAt(v) + 4)}" text-anchor="end">${esc(metric.axis(v))}</text>`);
  }

  const labelEvery = rows.length <= 7 ? 1 : rows.length <= 14 ? 2 : rows.length <= 30 ? 7 : 21;
  const bars = rows.map((row, i) => {
    const cx = x0 + band * (i + 0.5);
    const x = cx - barW / 2;
    const parts = metric.parts.filter((p) => row.values[p.key] > 0);
    let cursor = baseline;
    const gap = parts.length > 1 ? 2 : 0;
    const shapes = parts.map((p, index) => {
      const h = Math.max(1.5, (plotH * row.values[p.key]) / top - (index < parts.length - 1 ? gap : 0));
      const y = cursor - h;
      cursor = y - gap;
      const cls = `fill c-${metric.color}${p.shade > 1 ? `-${p.shade}` : ''}`;
      if (index === parts.length - 1) return `<path class="${cls}" d="${roundedTop(x, y, barW, h, 4)}"/>`;
      return `<rect class="${cls}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(barW)}" height="${fmt(h)}"/>`;
    }).join('');
    const showLabel = (rows.length - 1 - i) % labelEvery === 0;
    const text = rows.length <= 7 ? weekdayShort(row.day) : dateShort(row.day);
    const dim = selected !== null && selected !== i ? ' is-dim' : '';
    return `
      <g role="button" tabindex="0" class="mark${dim}" data-act="select-bar" data-v="${i}" aria-label="${esc(`${dateShort(row.day)}, ${metric.format(row.total)}`)}">
        <title>${esc(`${dateShort(row.day)}: ${metric.format(row.total)}`)}</title>
        <rect class="hit" x="${fmt(x0 + band * i)}" y="${y0}" width="${fmt(band)}" height="${plotH + 22}"/>
        ${shapes}
        ${showLabel ? `<text class="tick" x="${fmt(cx)}" y="${H - 6}" text-anchor="middle">${esc(text)}</text>` : ''}
      </g>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(metric.label)} pro Tag">${ticks.join('')}<line class="axis" x1="${x0}" x2="${W}" y1="${baseline}" y2="${baseline}"/>${bars}</svg>`;
}

export function legend(metricKey) {
  const metric = METRICS[metricKey];
  if (metric.parts.length < 2) return '';
  return `<ul class="legend">${metric.parts.map((p) => `<li><i class="swatch c-${metric.color}${p.shade > 1 ? `-${p.shade}` : ''}"></i>${esc(p.label)}</li>`).join('')}</ul>`;
}

const GROWTH_UNITS = { weight: 'kg', length: 'cm', head: 'cm' };

/** Own measurements against the WHO 3rd, 50th and 97th percentile. */
export function growthChart(points, metric, sex, birthIso) {
  const birth = fromIso(birthIso);
  const ages = points.map((p) => (p.start - birth) / 86_400_000);
  const maxAge = Math.min(730, Math.max(180, ...ages.map((a) => a + 30)));
  const H = 232;
  const x0 = 34;
  const y0 = 10;
  const right = W - 24;
  const plotW = right - x0;
  const plotH = H - y0 - 40;
  const z = [[-1.881, '3'], [0, '50'], [1.881, '97']];
  const curves = sex ? z.map(([value, name]) => ({ name, values: curve(metric, sex, value).filter(([a]) => a <= maxAge) })) : [];
  const all = [...curves.flatMap((c) => c.values.map(([, v]) => v)), ...points.map((p) => p.value)];
  const lo = Math.floor(Math.min(...all));
  const hi = Math.ceil(Math.max(...all));
  const xAt = (a) => x0 + (plotW * a) / maxAge;
  const yAt = (v) => y0 + plotH - (plotH * (v - lo)) / Math.max(1, hi - lo);

  const stepY = Math.max(1, Math.ceil((hi - lo) / 4));
  const grid = [];
  for (let v = lo; v <= hi; v += stepY) {
    grid.push(`<line class="grid" x1="${x0}" x2="${right}" y1="${fmt(yAt(v))}" y2="${fmt(yAt(v))}"/><text class="tick" x="${x0 - 6}" y="${fmt(yAt(v) + 4)}" text-anchor="end">${v}</text>`);
  }
  const monthStep = maxAge > 400 ? 6 : maxAge > 200 ? 3 : 2;
  for (let m = 0; m * 30.44 <= maxAge; m += monthStep) {
    grid.push(`<text class="tick" x="${fmt(xAt(m * 30.44))}" y="${H - 22}" text-anchor="middle">${m}</text>`);
  }

  const lines = curves.map((c) => {
    if (!c.values.length) return '';
    const d = c.values.map(([a, v], i) => `${i ? 'L' : 'M'}${fmt(xAt(a))} ${fmt(yAt(v))}`).join('');
    const last = c.values[c.values.length - 1];
    return `<path class="ref" d="${d}"/><text class="tick" x="${right + 4}" y="${fmt(yAt(last[1]) + 4)}">${c.name}</text>`;
  }).join('');

  const ordered = [...points].sort((a, b) => a.start - b.start);
  const own = ordered.map((p, i) => `${i ? 'L' : 'M'}${fmt(xAt((p.start - birth) / 86_400_000))} ${fmt(yAt(p.value))}`).join('');
  const dots = ordered.map((p) => {
    const cx = fmt(xAt((p.start - birth) / 86_400_000));
    const cy = fmt(yAt(p.value));
    const text = `${dateShort(p.start)}: ${String(p.value).replace('.', ',')} ${GROWTH_UNITS[metric]}`;
    return `<g role="button" tabindex="0" class="mark" data-act="open-entry" data-v="${esc(p.id)}" aria-label="${esc(text)}"><title>${esc(text)}</title>
      <rect class="hit" x="${cx - 12}" y="${cy - 12}" width="24" height="24"/><circle class="fill c-pump ring" cx="${cx}" cy="${cy}" r="4.5"/></g>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="Wachstumskurve">
    ${grid.join('')}<line class="axis" x1="${x0}" x2="${right}" y1="${y0 + plotH}" y2="${y0 + plotH}"/>
    ${lines}<path class="own c-pump-line" d="${own}"/>${dots}
    <text class="tick" x="${(x0 + right) / 2}" y="${H - 4}" text-anchor="middle">Alter in Monaten</text></svg>`;
}

