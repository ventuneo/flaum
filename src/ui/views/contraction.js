import { INTENSITIES, label } from '../../core/catalog.js';
import { intervalBefore, summarize } from '../../core/contractions.js';
import { clock, dayWord, dur, durSeconds, stopwatch, weekday } from '../../core/time.js';
import { chips, esc, icon, sanitizePhone, shareText } from '../dom.js';

let lastId = null;
let showAll = false;

const VISIBLE = 6;

function summaryText(ctx, list, s) {
  const child = ctx.child;
  const lines = [`Wehen von ${child.name}, ${dayWord(ctx.now(), ctx.now())} ${clock(ctx.now())}`];
  if (s.count) {
    lines.push(`Letzte Stunde: ${s.count} Wehen`);
    if (s.avgInterval) lines.push(`Abstand im Schnitt: ${dur(s.avgInterval)}`);
    lines.push(`Dauer im Schnitt: ${durSeconds(s.avgDuration)}`);
  }
  lines.push('');
  [...list].sort((a, b) => b.start - a.start).slice(0, 12).forEach((c) => {
    const intensity = label(INTENSITIES, c.data.intensity);
    lines.push(`${clock(c.start)}, ${durSeconds(c.end - c.start)}${intensity ? `, ${intensity.toLowerCase()}` : ''}`);
  });
  return lines.join('\n');
}

export const contraction = {
  enter() { lastId = null; showAll = false; },
  aura: () => 'contraction',
  render(ctx) {
    const now = ctx.now();
    const child = ctx.child;
    const list = ctx.store.entriesFor(child.id, ['contraction']);
    const timer = ctx.store.timerFor(child.id, 'contraction');
    const s = summarize(list, now);
    const sorted = [...list].sort((a, b) => b.start - a.start);
    const shown = showAll ? sorted : sorted.slice(0, VISIBLE);
    const { phone, phoneLabel } = ctx.state.settings;
    const number = sanitizePhone(phone);
    const lastEntry = lastId ? ctx.store.entry(lastId) : null;
    const since = s.lastStart;

    return `
      <section class="screen moment contractions">
        <header class="bar">
          <a class="glass" href="#/heute" data-back aria-label="Zurück">${icon.back}</a>
          <div class="bar-title"><strong>Wehen</strong><span>${esc(weekday(now))}, <span data-live-clock></span></span></div>
          <span></span>
        </header>
        <div class="stage stage--breath">
          <button type="button" class="breath${timer ? ' is-running' : ''}" data-act="toggle" aria-pressed="${!!timer}">
            <span class="breath-glow" aria-hidden="true"></span>
            <h1 class="word word--clock" ${timer ? `data-sw-since="${timer.start}"` : ''}>${timer ? stopwatch(now - timer.start) : 'Wehe beginnt'}</h1>
            <small>${timer ? 'Tippen, wenn sie endet' : since ? `Letzte Wehe <span data-ago="${since}"></span>` : 'Einmal tippen zum Starten'}</small>
          </button>
          ${timer ? '<p class="sub breath-cue">Atme mit dem Kreis, langsam ein und aus.</p>' : ''}
        </div>
        <div class="sheet">
          ${s.callHint ? `
            <div class="callout" role="status">
              <p>Deine Wehen kommen regelmässig, etwa alle ${esc(dur(s.avgInterval))}. Ruf jetzt dein Spital oder deine Hebamme an.</p>
            </div>` : ''}

          ${lastEntry && !timer ? `
            <p class="ask ask--small">Wie stark war die Wehe? Das ist freiwillig.</p>
            ${chips(INTENSITIES, { act: 'intensity', selected: lastEntry.data.intensity })}` : ''}

          <dl class="facts">
            <div><dt>Abstand</dt><dd>${s.avgInterval ? esc(dur(s.avgInterval)) : '–'}</dd></div>
            <div><dt>Dauer</dt><dd>${s.avgDuration ? esc(durSeconds(s.avgDuration)) : '–'}</dd></div>
            <div><dt>Letzte Stunde</dt><dd>${s.count}</dd></div>
          </dl>

          <div class="actions">
            ${number
              ? `<a class="action" href="tel:${esc(number)}">${icon.phone}<span>${esc(phoneLabel || 'Spital')} anrufen</span></a>`
              : `<a class="action" href="#/einstellungen">${icon.phone}<span>Nummer eintragen</span></a>`}
            ${list.length ? `<button type="button" class="action" data-act="share">${icon.share}<span>Verlauf teilen</span></button>` : ''}
          </div>

          <details class="fold">
            <summary>Wann soll ich anrufen?</summary>
            <p>Der Abstand zählt von Beginn zu Beginn. Dein Spital oder deine Hebamme sagt dir, was für dich gilt. Viele Schweizer Spitäler bitten um einen Anruf, sobald die Wehen regelmässig etwa alle 5 bis 6 Minuten kommen.</p>
            <p>Ruf auch sofort an bei Fruchtwasserabgang, Blutung, unklaren Bauchbeschwerden, deutlich weniger Kindsbewegungen oder wenn du unsicher bist. Du musst dafür nicht warten, bis die Wehen regelmässig sind.</p>
            <p>Im Notfall: <a href="tel:144">144</a></p>
          </details>

          ${shown.length ? `
            <h2 class="section-title">Bisher</h2>
            <ul class="rows">
              ${shown.map((c) => {
                const gap = intervalBefore(list, c);
                const intensity = label(INTENSITIES, c.data.intensity);
                return `
                  <li>
                    <a class="row" href="#/eintrag/${esc(c.id)}">
                      <span class="row-time">${esc(clock(c.start))}</span>
                      <span class="row-main"><strong>${esc(durSeconds(c.end - c.start))}</strong>${intensity ? `<small>${esc(intensity)}</small>` : ''}</span>
                      <span class="row-side">${gap ? `alle ${esc(dur(gap))}` : 'Beginn'}</span>
                    </a>
                  </li>`;
              }).join('')}
            </ul>
            ${sorted.length > VISIBLE && !showAll ? '<button type="button" class="link" data-act="all">Alle anzeigen</button>' : ''}` : ''}
        </div>
      </section>`;
  },
  actions: {
    toggle(ctx) {
      const child = ctx.child;
      const timer = ctx.store.timerFor(child.id, 'contraction');
      if (!timer) {
        ctx.store.startTimer(child.id, 'contraction');
        lastId = null;
        ctx.rerender();
        return;
      }
      const now = ctx.now();
      const entry = ctx.store.addEntry({ childId: child.id, type: 'contraction', start: timer.start, end: now, data: {} });
      ctx.store.removeTimer(timer.id);
      lastId = entry.id;
      ctx.toast(`Wehe gespeichert: ${durSeconds(now - timer.start)}`, () => {
        ctx.store.deleteEntry(entry.id);
        ctx.store.restoreTimer(timer);
        lastId = null;
      });
      ctx.rerender();
    },
    intensity(ctx, el) {
      const entry = ctx.store.entry(lastId);
      if (!entry) return;
      const next = entry.data.intensity === el.dataset.v ? undefined : el.dataset.v;
      const data = { ...entry.data };
      if (next) data.intensity = next;
      else delete data.intensity;
      ctx.store.updateEntry(lastId, { data });
      ctx.rerender();
    },
    all(ctx) { showAll = true; ctx.rerender(); },
    async share(ctx) {
      const list = ctx.store.entriesFor(ctx.child.id, ['contraction']);
      const s = summarize(list, ctx.now());
      const result = await shareText('Wehen', summaryText(ctx, list, s));
      if (result === 'copied') ctx.toast('Verlauf kopiert');
      if (result === 'failed') ctx.toast('Teilen geht in diesem Browser nicht.', null, { error: true });
    },
  },
};
