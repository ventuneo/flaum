import { TRACKERS } from '../../core/catalog.js';
import { describe } from '../../core/describe.js';
import { percentile, percentileLabel } from '../../core/growth.js';
import { METRICS, dayStats, foodLog, insights, metricSeries } from '../../core/reports.js';
import { correctedAgeDays } from '../../core/sleep.js';
import { addDays, clock, dateShort, dayLabel, dur, startOfDay, startOfWeek, weekdayShort } from '../../core/time.js';
import { barChart, dayLanes, growthChart, legend, weekStrips } from '../charts.js';
import { chip, esc, icon, pillNav } from '../dom.js';

const TABS = [['day', 'Tag'], ['week', 'Woche'], ['list', 'Liste'], ['trend', 'Trends']];
const RANGES = [7, 14, 30, 90];
const GROWTH = [['weight', 'Gewicht', 'kg'], ['length', 'Länge', 'cm'], ['head', 'Kopf', 'cm']];
const PAGE = 40;

const s = {
  tab: 'day',
  day: null,
  week: null,
  filter: 'all',
  metric: 'sleep',
  range: 7,
  growth: 'weight',
  selected: null,
  table: false,
  limit: PAGE,
};

const entryRow = (e) => {
  const info = describe(e);
  return `
    <li>
      <a class="row" href="#/eintrag/${esc(e.id)}">
        <span class="row-time">${esc(clock(e.start))}</span>
        <span class="row-main">
          <strong>${esc(info.title)}</strong>
          ${info.detail ? `<small>${esc(info.detail)}</small>` : ''}
          ${e.note ? `<small class="row-note">${esc(e.note)}</small>` : ''}
        </span>
      </a>
    </li>`;
};

const dayNav = (label, prevAct, nextAct, canNext) => `
  <div class="pager">
    <button type="button" class="round round--quiet" data-act="${prevAct}" data-v="" aria-label="Zurück">${icon.left}</button>
    <h2>${esc(label)}</h2>
    <button type="button" class="round round--quiet" data-act="${nextAct}" data-v="" aria-label="Weiter" ${canNext ? '' : 'disabled'}>${icon.right}</button>
  </div>`;

function dayFacts(stats) {
  const facts = [];
  if (stats.sleep.total) facts.push(['Schlaf', dur(stats.sleep.total)]);
  if (stats.nursing.count) facts.push(['Stillen', `${stats.nursing.count}-mal, ${dur(stats.nursing.ms)}`]);
  if (stats.bottle.count) facts.push(['Flasche', `${stats.bottle.count}-mal, ${stats.bottle.total} ml`]);
  if (stats.diaper.total) facts.push(['Windeln', String(stats.diaper.total)]);
  if (stats.pump.count) facts.push(['Abgepumpt', `${stats.pump.ml} ml`]);
  return facts;
}

function renderDay(ctx, entries) {
  const now = ctx.now();
  const day = s.day ?? startOfDay(now);
  const end = addDays(day, 1);
  const stats = dayStats(entries, day);
  const onDay = entries
    .filter((e) => e.start >= day && e.start < end)
    .sort((a, b) => b.start - a.start);
  // A night that began yesterday still appears on the chart, but is listed once, on the day it began.
  const facts = dayFacts(stats);
  return `
    ${dayNav(dayLabel(day, now), 'day-prev', 'day-next', end <= now)}
    ${dayLanes(entries, day, now)}
    ${facts.length ? `<dl class="facts facts--list">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${onDay.length
      ? `<ul class="rows">${onDay.map(entryRow).join('')}</ul>`
      : `<p class="empty">${day === startOfDay(now) ? 'Heute ist noch nichts eingetragen.' : 'An diesem Tag ist nichts eingetragen.'}</p>`}`;
}

function renderWeek(ctx, entries) {
  const now = ctx.now();
  const week = s.week ?? startOfWeek(now);
  const next = addDays(week, 7);
  return `
    ${dayNav(`${dateShort(week)} bis ${dateShort(addDays(week, 6))}`, 'week-prev', 'week-next', next <= now)}
    ${weekStrips(entries, week, now)}
    <ul class="legend">
      <li><i class="swatch c-sleep"></i>Schlaf</li>
      <li><i class="swatch swatch--dot c-nursing"></i>Stillen</li>
      <li><i class="swatch swatch--dot c-bottle"></i>Flasche</li>
    </ul>
    <p class="fineprint">Tippe auf einen Tag, um alle Einträge zu sehen und zu ändern.</p>`;
}

function renderList(ctx, entries) {
  const now = ctx.now();
  const used = [...new Set(entries.map((e) => e.type))];
  const list = (s.filter === 'all' ? entries : entries.filter((e) => e.type === s.filter)).sort((a, b) => b.start - a.start);
  const page = list.slice(0, s.limit);
  const groups = new Map();
  for (const e of page) {
    const key = startOfDay(e.start);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return `
    <div class="chips chips--small chips--scroll">
      ${chip('Alle', { act: 'filter', value: 'all', tint: 'sand', pressed: s.filter === 'all' })}
      ${used.map((t) => chip(TRACKERS[t].label, { act: 'filter', value: t, tint: TRACKERS[t].tint, pressed: s.filter === t })).join('')}
    </div>
    ${page.length ? [...groups.entries()].map(([day, rows]) => `
      <h2 class="section-title">${esc(dayLabel(day, now))}</h2>
      <ul class="rows">${rows.map(entryRow).join('')}</ul>`).join('') : '<p class="empty">Noch nichts festgehalten. Tippe unter «Heute» an, was gerade war.</p>'}
    ${list.length > page.length ? '<button type="button" class="link" data-act="more-rows">Ältere anzeigen</button>' : ''}`;
}

function renderTable(rows, metric) {
  return `
    <table class="table">
      <thead><tr><th scope="col">Tag</th>${metric.parts.length > 1 ? metric.parts.map((p) => `<th scope="col">${esc(p.label)}</th>`).join('') : ''}<th scope="col">Total</th></tr></thead>
      <tbody>
        ${[...rows].reverse().map((r) => `
          <tr>
            <th scope="row">${esc(weekdayShort(r.day))} ${esc(dateShort(r.day))}</th>
            ${metric.parts.length > 1 ? metric.parts.map((p) => `<td>${r.values[p.key] ? esc(metric.format(r.values[p.key])) : '–'}</td>`).join('') : ''}
            <td>${r.total ? esc(metric.format(r.total)) : '–'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderGrowth(ctx, entries) {
  const child = ctx.child;
  const [key, name, unit] = GROWTH.find(([k]) => k === s.growth);
  const points = entries
    .filter((e) => e.type === 'growth' && e.data[key])
    .map((e) => ({ id: e.id, start: e.start, value: e.data[key] }))
    .sort((a, b) => b.start - a.start);
  const latest = points[0];
  const corrected = latest ? correctedAgeDays(child, latest.start) : null;
  const pct = latest && corrected !== null ? percentile(key, child.sex, corrected, latest.value) : null;
  return `
    <div class="chips chips--small">${GROWTH.map(([k, t]) => chip(t, { act: 'growth', value: k, tint: 'mint', pressed: s.growth === k })).join('')}</div>
    ${latest ? `
      <p class="headline">${esc(String(latest.value).replace('.', ','))} ${esc(unit)}</p>
      <p class="headline-sub">${esc(dateShort(latest.start))}${pct !== null ? `, ${esc(percentileLabel(pct))}` : ''}</p>
      ${child.birthDate ? growthChart(points, key, child.sex, child.birthDate) : ''}
      ${child.sex ? '<p class="fineprint">Die drei Linien zeigen die WHO-Werte für die 3., 50. und 97. Perzentile. Jede davon ist normal, wichtig ist der Verlauf.</p>' : '<p class="fineprint">Trag in den Einstellungen das Geschlecht ein, wenn du die WHO-Linien sehen möchtest.</p>'}
      <table class="table"><thead><tr><th scope="col">Datum</th><th scope="col">${esc(name)}</th></tr></thead>
      <tbody>${points.map((p) => `<tr><th scope="row">${esc(dateShort(p.start))}</th><td>${esc(String(p.value).replace('.', ','))} ${esc(unit)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="empty">Noch keine Werte für ${esc(name)}.</p>`}
    <div class="sheet-end"><a class="chip t-mint" href="#/log/growth">Wert eintragen</a></div>`;
}

function renderFoods(entries) {
  const log = foodLog(entries);
  if (!log.length) return '<p class="empty">Noch keine Lebensmittel eingetragen.</p>';
  return `
    <h2 class="section-title">Schon probiert</h2>
    <ul class="rows">
      ${log.map((f) => `
        <li class="row row--static">
          <span class="row-main">
            <strong>${esc(f.food)}</strong>
            <small>${f.times}-mal, zuerst am ${esc(dateShort(f.first))}${f.reaction ? `, Reaktion: ${esc(f.reaction)}` : ''}</small>
          </span>
        </li>`).join('')}
    </ul>`;
}

function renderTrend(ctx, entries) {
  const now = ctx.now();
  const keys = Object.keys(METRICS);
  const notes = insights(entries, now);
  const pills = `
    <div class="chips chips--grid">
      ${keys.map((k) => chip(METRICS[k].label, { act: 'metric', value: k, tint: TRACKERS[k]?.tint ?? 'mint', pressed: s.metric === k })).join('')}
      ${chip('Wachstum', { act: 'metric', value: 'growth', tint: 'mint', pressed: s.metric === 'growth' })}
      ${chip('Beikost', { act: 'metric', value: 'foods', tint: 'sand', pressed: s.metric === 'foods' })}
    </div>`;

  let body;
  if (s.metric === 'growth') {
    body = renderGrowth(ctx, entries);
  } else if (s.metric === 'foods') {
    body = renderFoods(entries);
  } else {
    const series = metricSeries(entries, now, s.range, s.metric);
    const metric = METRICS[s.metric];
    const picked = s.selected !== null ? series.rows[s.selected] : null;
    const value = picked ? metric.format(picked.total) : series.average !== null ? metric.format(series.average) : '–';
    const caption = picked
      ? `${weekdayShort(picked.day)} ${dateShort(picked.day)}`
      : series.average !== null
        ? `Im Schnitt pro Tag, an ${series.filledDays} ${series.filledDays === 1 ? 'Tag' : 'Tagen'} mit Einträgen`
        : 'In diesem Zeitraum ist nichts eingetragen.';
    const partsText = picked && metric.parts.length > 1
      ? metric.parts.filter((p) => picked.values[p.key]).map((p) => `${p.label} ${metric.format(picked.values[p.key])}`).join(', ')
      : '';
    body = `
      <div class="segmented" role="group" aria-label="Zeitraum">
        ${RANGES.map((r) => `<button type="button" data-act="range" data-v="${r}" aria-pressed="${s.range === r}">${r} Tage</button>`).join('')}
      </div>
      <p class="headline">${esc(value)}</p>
      <p class="headline-sub">${esc(caption)}${partsText ? `<br>${esc(partsText)}` : ''}</p>
      ${barChart(series, s.metric, s.selected)}
      ${legend(s.metric)}
      <button type="button" class="link" data-act="table">${s.table ? 'Tabelle ausblenden' : 'Als Tabelle anzeigen'}</button>
      ${s.table ? renderTable(series.rows, metric) : ''}`;
  }

  return `
    ${notes.length ? `<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${pills}
    ${body}
    <a class="row row--plain" href="#/bericht">Bericht für den Arzttermin</a>`;
}

export const history = {
  aura: () => 'rest',
  render(ctx) {
    const child = ctx.child;
    const entries = ctx.store.entriesFor(child.id);
    const renderers = { day: renderDay, week: renderWeek, list: renderList, trend: renderTrend };
    // During pregnancy only the list makes sense: the other views chart baby data.
    const expecting = child.phase === 'expecting';
    const tab = expecting ? 'list' : s.tab;
    return `
      <section class="screen screen--page">
        <header class="bar">
          <a class="glass glass--text" href="#/kinder" aria-label="${esc(child.name)}, wechseln oder bearbeiten">${esc(child.name.charAt(0).toUpperCase())}</a>
          <div class="bar-title"><h1>Verlauf</h1></div>
          <a class="glass" href="#/einstellungen" aria-label="Einstellungen">${icon.gear}</a>
        </header>
        ${expecting ? '' : `
        <div class="segmented segmented--top" role="group" aria-label="Ansicht">
          ${TABS.map(([k, t]) => `<button type="button" data-act="tab" data-v="${k}" aria-pressed="${s.tab === k}">${t}</button>`).join('')}
        </div>`}
        <div class="sheet sheet--fill">
          ${renderers[tab](ctx, entries)}
          ${pillNav('verlauf')}
        </div>
      </section>`;
  },
  actions: {
    tab(ctx, el) { s.tab = el.dataset.v; s.selected = null; ctx.rerender(); },
    'day-prev'(ctx) { s.day = addDays(s.day ?? startOfDay(ctx.now()), -1); ctx.rerender(); },
    'day-next'(ctx) { s.day = addDays(s.day ?? startOfDay(ctx.now()), 1); ctx.rerender(); },
    'week-prev'(ctx) { s.week = addDays(s.week ?? startOfWeek(ctx.now()), -7); ctx.rerender(); },
    'week-next'(ctx) { s.week = addDays(s.week ?? startOfWeek(ctx.now()), 7); ctx.rerender(); },
    'open-day'(ctx, el) {
      const day = Number(el.dataset.v);
      if (day > ctx.now()) return;
      s.day = day;
      s.tab = 'day';
      ctx.rerender();
    },
    'open-entry'(ctx, el) { ctx.nav(`#/eintrag/${el.dataset.v}`); },
    filter(ctx, el) { s.filter = el.dataset.v; s.limit = PAGE; ctx.rerender(); },
    'more-rows'(ctx) { s.limit += PAGE; ctx.rerender(); },
    metric(ctx, el) { s.metric = el.dataset.v; s.selected = null; ctx.rerender(); },
    range(ctx, el) { s.range = Number(el.dataset.v); s.selected = null; ctx.rerender(); },
    growth(ctx, el) { s.growth = el.dataset.v; ctx.rerender(); },
    'select-bar'(ctx, el) {
      const i = Number(el.dataset.v);
      s.selected = s.selected === i ? null : i;
      ctx.rerender();
    },
    table(ctx) { s.table = !s.table; ctx.rerender(); },
  },
};
