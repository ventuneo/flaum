import { describe } from '../../core/describe.js';
import { foodLog, statsRange } from '../../core/reports.js';
import { addDays, ageLabel, clock, dateLong, dateShort, dur, fromIso, startOfDay } from '../../core/time.js';
import { esc, icon, shareText } from '../dom.js';

const RANGES = [7, 14, 30];
let range = 14;

const avg = (rows, read) => {
  const values = rows.map(read).filter((v) => v > 0);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
};

function collect(ctx) {
  const child = ctx.child;
  const now = ctx.now();
  const entries = ctx.store.entriesFor(child.id);
  const since = addDays(startOfDay(now), -(range - 1));
  const inRange = entries.filter((e) => e.start >= since);
  const rows = statsRange(entries, now, range);
  const summary = [
    ['Schlaf pro Tag', avg(rows, (s) => s.sleep.total), dur],
    ['Davon am Tag', avg(rows, (s) => s.sleep.day), dur],
    ['Nickerchen pro Tag', avg(rows, (s) => s.sleep.naps), (v) => String(Math.round(v * 10) / 10).replace('.', ',')],
    ['Stillen pro Tag', avg(rows, (s) => s.nursing.ms), dur],
    ['Muttermilch aus der Flasche pro Tag', avg(rows, (s) => s.bottle.breast), (v) => `${Math.round(v)} ml`],
    ['Pre-Milch pro Tag', avg(rows, (s) => s.bottle.formula), (v) => `${Math.round(v)} ml`],
    ['Windeln pro Tag', avg(rows, (s) => s.diaper.total), (v) => String(Math.round(v * 10) / 10).replace('.', ',')],
  ].filter(([, v]) => v !== null).map(([k, v, f]) => [k, f(v)]);

  const pick = (type) => inRange.filter((e) => e.type === type).sort((a, b) => b.start - a.start);
  return {
    child,
    now,
    since,
    summary,
    growth: entries.filter((e) => e.type === 'growth').sort((a, b) => b.start - a.start).slice(0, 5),
    temperatures: pick('temperature'),
    medicine: pick('medicine'),
    notes: entries.filter((e) => e.type === 'note' && !e.data.done).sort((a, b) => b.start - a.start),
    reactions: foodLog(entries).filter((f) => f.reaction),
    milestones: pick('milestone'),
    contractions: pick('contraction').slice(0, 15),
    moods: pick('mood').slice(0, 10),
  };
}

function asText(r) {
  const lines = [`${r.child.name}${r.child.birthDate ? `, ${ageLabel(r.child.birthDate, r.now)}` : ''}`, `${dateShort(r.since)} bis ${dateShort(r.now)}`, ''];
  const section = (title, rows) => {
    if (!rows.length) return;
    lines.push(title, ...rows.map((x) => `- ${x}`), '');
  };
  section('Durchschnitt', r.summary.map(([k, v]) => `${k}: ${v}`));
  section('Fragen für den Termin', r.notes.map((e) => e.note ?? ''));
  section('Wachstum', r.growth.map((e) => `${dateShort(e.start)}: ${describe(e).detail}`));
  section('Temperatur', r.temperatures.map((e) => `${dateShort(e.start)} ${clock(e.start)}: ${describe(e).detail}`));
  section('Medizin', r.medicine.map((e) => `${dateShort(e.start)} ${clock(e.start)}: ${describe(e).detail}`));
  section('Reaktionen auf Beikost', r.reactions.map((f) => `${f.food}: ${f.reaction}`));
  section('Meilensteine', r.milestones.map((e) => `${dateShort(e.start)}: ${describe(e).detail}`));
  section('Wehen', r.contractions.map((e) => `${dateShort(e.start)} ${clock(e.start)}: ${describe(e).detail}`));
  return lines.join('\n').trim();
}

const block = (title, rows) => (rows.length ? `
  <h2 class="section-title">${esc(title)}</h2>
  <ul class="plain">${rows.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

export const report = {
  aura: () => 'note',
  render(ctx) {
    const r = collect(ctx);
    const empty = !r.summary.length && !r.notes.length && !r.growth.length && !r.temperatures.length && !r.medicine.length && !r.reactions.length && !r.milestones.length && !r.contractions.length;
    return `
      <section class="screen screen--page">
        <header class="bar no-print">
          <a class="glass" href="#/verlauf" data-back aria-label="Zurück">${icon.back}</a>
          <div class="bar-title"><strong>Für den Arzttermin</strong></div>
          <span></span>
        </header>
        <div class="segmented segmented--top no-print" role="group" aria-label="Zeitraum">
          ${RANGES.map((v) => `<button type="button" data-act="range" data-v="${v}" aria-pressed="${range === v}">${v} Tage</button>`).join('')}
        </div>
        <div class="sheet sheet--fill report">
          <h1 class="report-title">${esc(r.child.name)}</h1>
          <p class="report-sub">${esc(r.child.birthDate ? `${ageLabel(r.child.birthDate, r.now)}, geboren am ${dateLong(fromIso(r.child.birthDate))}` : 'Schwangerschaft')}<br>${esc(dateShort(r.since))} bis ${esc(dateShort(r.now))}</p>
          ${empty ? '<p class="empty">In diesem Zeitraum ist nichts eingetragen. Wähle oben einen längeren Zeitraum.</p>' : ''}
          ${r.summary.length ? `
            <h2 class="section-title">Durchschnitt an Tagen mit Einträgen</h2>
            <dl class="facts facts--list">${r.summary.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
          ${block('Fragen für den Termin', r.notes.map((e) => e.note ?? ''))}
          ${block('Wachstum', r.growth.map((e) => `${dateShort(e.start)}: ${describe(e).detail}`))}
          ${block('Temperatur', r.temperatures.map((e) => `${dateShort(e.start)}, ${clock(e.start)}: ${describe(e).detail}`))}
          ${block('Medizin', r.medicine.map((e) => `${dateShort(e.start)}, ${clock(e.start)}: ${describe(e).detail}`))}
          ${block('Reaktionen auf Beikost', r.reactions.map((f) => `${f.food}: ${f.reaction}`))}
          ${block('Meilensteine', r.milestones.map((e) => `${dateShort(e.start)}: ${describe(e).detail}`))}
          ${block('Wehen', r.contractions.map((e) => `${dateShort(e.start)}, ${clock(e.start)}: ${describe(e).detail}`))}
          <div class="actions no-print">
            <button type="button" class="action" data-act="print">${icon.share}<span>Drucken oder als PDF sichern</span></button>
            <button type="button" class="action" data-act="share">${icon.share}<span>Als Text teilen</span></button>
          </div>
        </div>
      </section>`;
  },
  actions: {
    range(ctx, el) { range = Number(el.dataset.v); ctx.rerender(); },
    print() { window.print(); },
    async share(ctx) {
      const result = await shareText('Bericht', asText(collect(ctx)));
      if (result === 'copied') ctx.toast('Bericht kopiert');
      if (result === 'failed') ctx.toast('Teilen geht in diesem Browser nicht. Nutze «Drucken oder als PDF sichern».', null, { error: true });
    },
  },
};
