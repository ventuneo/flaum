import { BOTTLE_KINDS, DIAPER_KINDS, INTENSITIES, LIKES, MOODS, POTTY_KINDS, SIDES, STOOL_COLORS, TRACKERS, label } from './catalog.js';
import { clock, dur, durSeconds } from './time.js';

const decimal = (value) => String(value).replace('.', ',');
const sideText = (ms, name) => (ms ? `${name} ${dur(ms)}` : '');

/** One plain sentence per entry. Used by the lists, the toast and the report, so wording stays the same. */
export function describe(entry) {
  const d = entry.data ?? {};
  const title = TRACKERS[entry.type]?.label ?? entry.type;
  switch (entry.type) {
    case 'sleep': {
      const wakes = d.wakes?.length ?? 0;
      const span = `${clock(entry.start)} bis ${clock(entry.end)}`;
      const netMs = entry.end - entry.start - (d.wakes ?? []).reduce((s, w) => s + (w.to - w.from), 0);
      const wakeText = wakes ? `, ${wakes}-mal kurz wach` : '';
      return { title, detail: `${span}, ${dur(netMs)}${wakeText}`, short: dur(netMs) };
    }
    case 'nursing': {
      const parts = [sideText(d.left, 'Links'), sideText(d.right, 'rechts')].filter(Boolean);
      const total = (d.left ?? 0) + (d.right ?? 0);
      return { title, detail: parts.join(', ') || 'Ohne Zeit', short: dur(total) };
    }
    case 'bottle': {
      const kind = label(BOTTLE_KINDS, d.kind);
      return { title, detail: `${d.ml} ml${kind ? ` ${kind}` : ''}`, short: `${d.ml} ml` };
    }
    case 'diaper': {
      const potty = d.mode === 'potty';
      const kind = label(potty ? POTTY_KINDS : DIAPER_KINDS, d.kind);
      const color = label(STOOL_COLORS, d.color);
      return { title: potty ? 'Töpfchen' : title, detail: [kind, color].filter(Boolean).join(', '), short: kind };
    }
    case 'pump': {
      const side = label(SIDES, d.side);
      const time = d.ms ? dur(d.ms) : '';
      return { title, detail: [`${d.ml ?? 0} ml`, side, time].filter(Boolean).join(', '), short: `${d.ml ?? 0} ml` };
    }
    case 'solids': {
      const foods = (d.foods ?? []).join(', ');
      const like = label(LIKES, d.liked);
      const reaction = d.reaction ? `Reaktion: ${d.reaction}` : '';
      return { title, detail: [foods || 'Ohne Details', like, reaction].filter(Boolean).join(', '), short: foods || 'Gegessen' };
    }
    case 'growth': {
      const parts = [
        d.weight ? `${decimal(d.weight)} kg` : '',
        d.length ? `${decimal(d.length)} cm lang` : '',
        d.head ? `${decimal(d.head)} cm Kopf` : '',
      ].filter(Boolean);
      return { title, detail: parts.join(', '), short: parts[0] ?? '' };
    }
    case 'milestone':
      return { title, detail: d.name ?? '', short: d.name ?? '' };
    case 'medicine':
      return { title, detail: [d.name, d.dose].filter(Boolean).join(', '), short: d.name ?? '' };
    case 'temperature':
      return { title, detail: `${decimal(d.celsius)} °C`, short: `${decimal(d.celsius)} °C` };
    case 'activity':
      return { title: d.kind || title, detail: d.ms ? dur(d.ms) : 'Ohne Zeit', short: d.ms ? dur(d.ms) : '' };
    case 'mood': {
      const mood = label(MOODS, d.mood);
      return { title, detail: mood, short: mood };
    }
    case 'note':
      return { title, detail: d.done ? 'Erledigt' : 'Offen', short: '' };
    case 'contraction': {
      const length = durSeconds(entry.end - entry.start);
      const intensity = label(INTENSITIES, d.intensity);
      return { title: 'Wehe', detail: [length, intensity].filter(Boolean).join(', '), short: length };
    }
    default:
      return { title, detail: '', short: '' };
  }
}
