import { dayPlan, predictNextSleep } from '../../core/sleep.js';
import { clock, dur } from '../../core/time.js';
import { esc, icon, miniHeader } from '../dom.js';

const shiftText = (min) => {
  if (!min) return 'Wie berechnet';
  return `${Math.abs(min)} Min ${min < 0 ? 'früher' : 'später'}`;
};

function headline(p, ctx) {
  const now = ctx.now();
  if (p.status === 'ok') {
    if (now > p.to) return { word: 'Wenn es müde wirkt', sub: 'Die berechnete Zeit ist vorbei. Richte dich jetzt einfach nach deinem Baby.' };
    return { word: `${clock(p.from)} bis ${clock(p.to)}`, sub: 'Ungefähr dann wird dein Baby wieder müde.' };
  }
  if (p.status === 'asleep') return { word: 'Schläft gerade', sub: 'Der Plan rechnet weiter, sobald das Baby wach ist.' };
  if (p.status === 'young') return { word: 'Noch kein Plan', sub: 'In den ersten acht Wochen gibt es meist noch keinen festen Rhythmus. Deshalb zeigt Flaum noch keine Schlafzeiten.' };
  if (p.status === 'unknown') return { word: 'Noch kein Plan', sub: 'Dafür braucht Flaum das Geburtsdatum.' };
  return { word: 'Noch kein Plan', sub: 'Trag den letzten Schlaf ein, dann rechnet Flaum die nächsten Zeiten.' };
}

function basisText(p) {
  if (p.status !== 'ok') return '';
  if (p.basis === 'own') return `Aus euren letzten ${p.n} Wachphasen: meist ${dur(p.loMin * 60000)} bis ${dur(p.hiMin * 60000)}.`;
  return `Richtwert fürs Alter: ${dur(p.loMin * 60000)} bis ${dur(p.hiMin * 60000)} wach. Ab fünf eigenen Wachphasen rechnet Flaum mit euren Zeiten.`;
}

export const plan = {
  aura: () => 'sleep',
  render(ctx) {
    const child = ctx.child;
    const now = ctx.now();
    const { sleepShiftMin: shiftMin, sleepHints } = ctx.state.settings;
    const sleeps = ctx.store.entriesFor(child.id, ['sleep']);
    const running = !!ctx.store.timerFor(child.id, 'sleep');
    const p = predictNextSleep({ sleeps, child, now, shiftMin, running });
    const day = dayPlan({ sleeps, child, now, shiftMin, running });
    const head = headline(p, ctx);

    const rows = (day.items ?? []).map((item) => {
      const name = item.kind === 'bed' ? 'Schlafenszeit' : 'Nickerchen';
      const time = item.kind === 'bed'
        ? `etwa ${clock(item.start)}`
        : item.done
          ? `${clock(item.start)} bis ${clock(item.end)}`
          : `etwa ${clock(item.start)} bis ${clock(item.end)}`;
      return `
        <li class="row row--static${item.done ? ' is-done' : ''}">
          <span class="row-main"><strong>${name}</strong></span>
          <span class="row-side">${esc(time)}</span>
        </li>`;
    }).join('');

    return `
      <section class="screen screen--page moment">
        ${miniHeader('Tagesplan')}
        <div class="stage stage--low">
          <h1 class="word word--medium">${esc(head.word)}</h1>
          <p class="sub">${esc(head.sub)}</p>
        </div>
        <div class="sheet sheet--fill">
          ${!sleepHints ? '<p class="tip">Die Hinweise auf der Startseite sind ausgeschaltet. Du kannst sie in den Einstellungen wieder einschalten.</p>' : ''}
          ${rows ? `<h2 class="section-title">Heute</h2><ul class="rows">${rows}</ul>` : ''}
          ${day.status === 'nomorning' ? '<p class="tip">Trag ein, wann dein Baby heute aufgewacht ist. Dann plant Flaum den Tag.</p><div class="sheet-end"><a class="chip t-peri" href="#/log/sleep">Schlaf eintragen</a></div>' : ''}
          ${p.status === 'ok' ? `
            <p class="tip">${esc(basisText(p))}</p>
            <h2 class="section-title">Stimmt das für euch?</h2>
            <div class="stepper">
              <button type="button" class="round" data-act="shift" data-v="-15" aria-label="15 Minuten früher">${icon.minus}</button>
              <output>${esc(shiftText(shiftMin))}</output>
              <button type="button" class="round" data-act="shift" data-v="15" aria-label="15 Minuten später">${icon.plus}</button>
            </div>` : ''}
          <p class="fineprint">Das sind Richtwerte, keine Vorgaben. Dein Baby zeigt dir am besten, wann es müde ist.</p>
        </div>
      </section>`;
  },
  actions: {
    shift(ctx, el) {
      const next = ctx.state.settings.sleepShiftMin + Number(el.dataset.v);
      ctx.store.updateSettings({ sleepShiftMin: Math.max(-60, Math.min(60, next)) });
      ctx.rerender();
    },
  },
};
