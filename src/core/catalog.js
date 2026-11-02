// Everything the app can record, with its label and colour family.
export const TRACKERS = {
  sleep: { label: 'Schlaf', tint: 'peri', aura: 'sleep' },
  nursing: { label: 'Stillen', tint: 'rose', aura: 'nursing' },
  bottle: { label: 'Flasche', tint: 'sky', aura: 'bottle' },
  diaper: { label: 'Windel', tint: 'butter', aura: 'diaper' },
  pump: { label: 'Abpumpen', tint: 'mint', aura: 'pump' },
  solids: { label: 'Beikost', tint: 'sand', aura: 'solids' },
  growth: { label: 'Wachstum', tint: 'mint', aura: 'growth' },
  milestone: { label: 'Meilenstein', tint: 'butter', aura: 'rest' },
  medicine: { label: 'Medizin', tint: 'lilac', aura: 'medicine' },
  temperature: { label: 'Temperatur', tint: 'coral', aura: 'temperature' },
  activity: { label: 'Aktivität', tint: 'sky', aura: 'activity' },
  mood: { label: 'Befinden', tint: 'rose', aura: 'rest' },
  note: { label: 'Notiz', tint: 'sand', aura: 'note' },
  contraction: { label: 'Wehen', tint: 'coral', aura: 'contraction' },
};

export const HOME_DEFAULT = ['sleep', 'nursing', 'bottle', 'diaper', 'pump', 'solids'];
export const OPTIONAL_TRACKERS = ['sleep', 'nursing', 'bottle', 'diaper', 'pump', 'solids', 'growth', 'milestone', 'medicine', 'temperature', 'activity', 'mood', 'note'];
export const EXPECTING_TRACKERS = ['contraction', 'mood', 'note'];

export const BOTTLE_KINDS = [
  { key: 'breast', label: 'Muttermilch', tint: 'rose' },
  { key: 'formula', label: 'Pre-Milch', tint: 'sky' },
  { key: 'other', label: 'Andere', tint: 'sand' },
];

export const DIAPER_KINDS = [
  { key: 'wet', label: 'Nass', tint: 'sky' },
  { key: 'dirty', label: 'Voll', tint: 'sand' },
  { key: 'both', label: 'Beides', tint: 'butter' },
  { key: 'dry', label: 'Trocken', tint: 'mint' },
];

export const POTTY_KINDS = [
  { key: 'wet', label: 'Pipi', tint: 'sky' },
  { key: 'dirty', label: 'Stuhl', tint: 'sand' },
  { key: 'both', label: 'Beides', tint: 'butter' },
  { key: 'dry', label: 'Nichts', tint: 'mint' },
];

export const STOOL_COLORS = [
  { key: 'gelb', label: 'Gelb', tint: 'butter' },
  { key: 'braun', label: 'Braun', tint: 'sand' },
  { key: 'gruen', label: 'Grün', tint: 'mint' },
  { key: 'schwarz', label: 'Schwarz', tint: 'peri' },
  { key: 'rot', label: 'Rötlich', tint: 'coral' },
  { key: 'hell', label: 'Sehr hell', tint: 'rose' },
];

export const SIDES = [
  { key: 'left', label: 'Links', tint: 'rose' },
  { key: 'right', label: 'Rechts', tint: 'sky' },
  { key: 'both', label: 'Beide', tint: 'mint' },
];

export const INTENSITIES = [
  { key: 'light', label: 'Leicht', tint: 'butter' },
  { key: 'medium', label: 'Mittel', tint: 'sand' },
  { key: 'strong', label: 'Stark', tint: 'coral' },
];

export const ACTIVITIES = ['Bauchzeit', 'Baden', 'Draussen', 'Spielen', 'Vorlesen', 'Schwimmen'];

export const MOODS = [
  { key: 'froehlich', label: 'Fröhlich', tint: 'butter', aura: 'sunny' },
  { key: 'gluecklich', label: 'Glücklich', tint: 'sand', aura: 'sunny' },
  { key: 'hoffnungsvoll', label: 'Hoffnungsvoll', tint: 'mint', aura: 'fresh' },
  { key: 'aufgeregt', label: 'Aufgeregt', tint: 'rose', aura: 'bloom' },
  { key: 'traurig', label: 'Traurig', tint: 'peri', aura: 'dusk' },
  { key: 'wuetend', label: 'Wütend', tint: 'coral', aura: 'ember' },
  { key: 'aengstlich', label: 'Ängstlich', tint: 'clay', aura: 'clay' },
  { key: 'ruhig', label: 'Ruhig', tint: 'sky', aura: 'still' },
  { key: 'zufrieden', label: 'Zufrieden', tint: 'mint', aura: 'fresh' },
  { key: 'muede', label: 'Müde', tint: 'lilac', aura: 'haze' },
  { key: 'einsam', label: 'Einsam', tint: 'peri', aura: 'dusk' },
  { key: 'nervoes', label: 'Nervös', tint: 'butter', aura: 'clay' },
];

export const REACTIONS = ['Ausschlag', 'Bauchweh', 'Erbrechen', 'Durchfall', 'Atemprobleme', 'Anderes'];

export const LIKES = [
  { key: 'mag', label: 'Mag es', tint: 'mint' },
  { key: 'geht', label: 'Geht so', tint: 'butter' },
  { key: 'mag-nicht', label: 'Mag es nicht', tint: 'coral' },
];

export const FOODS = [
  { name: 'Karotte' }, { name: 'Kürbis' }, { name: 'Pastinake' }, { name: 'Süsskartoffel' },
  { name: 'Kartoffel' }, { name: 'Zucchini' }, { name: 'Brokkoli' }, { name: 'Erbsen' },
  { name: 'Avocado' }, { name: 'Tomate' }, { name: 'Banane' }, { name: 'Birne' },
  { name: 'Apfel', tip: 'Roh nur fein gerieben, sonst weich gekocht.' },
  { name: 'Pfirsich' }, { name: 'Mango' }, { name: 'Beeren', tip: 'Grosse Beeren zerdrücken oder klein schneiden.' },
  { name: 'Trauben', tip: 'Immer längs vierteln, ganze Trauben können im Hals stecken bleiben.' },
  { name: 'Hafer', allergen: 'Gluten' },
  { name: 'Hirse' }, { name: 'Reis' }, { name: 'Brot', allergen: 'Gluten' },
  { name: 'Teigwaren', allergen: 'Gluten' },
  { name: 'Joghurt', allergen: 'Kuhmilch' }, { name: 'Käse', allergen: 'Kuhmilch', tip: 'Nur aus pasteurisierter Milch.' },
  { name: 'Ei', allergen: 'Ei', tip: 'Gut durchgaren.' },
  { name: 'Erdnussmus', allergen: 'Erdnuss', tip: 'Nur als dünnes Mus, in Brei gerührt. Keine ganzen Nüsse.' },
  { name: 'Mandelmus', allergen: 'Nüsse', tip: 'Nur als dünnes Mus, in Brei gerührt. Keine ganzen Nüsse.' },
  { name: 'Tahin', allergen: 'Sesam' }, { name: 'Tofu', allergen: 'Soja' },
  { name: 'Lachs', allergen: 'Fisch', tip: 'Gut durchgaren und Gräten entfernen.' },
  { name: 'Poulet', tip: 'Gut durchgaren und fein zerkleinern.' }, { name: 'Rind', tip: 'Gut durchgaren und fein zerkleinern.' },
  { name: 'Linsen' },
  { name: 'Honig', tip: 'Erst ab 12 Monaten geben.' },
];

export const MILESTONES = [
  'Erstes Lächeln', 'Hebt den Kopf', 'Lacht laut', 'Greift nach Dingen', 'Dreht sich',
  'Sitzt allein', 'Erster Zahn', 'Isst den ersten Brei', 'Krabbelt', 'Zieht sich hoch',
  'Winkt', 'Erstes Wort', 'Erste Schritte',
];

export const label = (list, key) => list.find((x) => x.key === key)?.label ?? '';
