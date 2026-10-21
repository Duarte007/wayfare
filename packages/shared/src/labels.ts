import type { DocumentLabel } from './schemas.js';

/**
 * Suggests a document label from its file name (and optionally its first-page text), on the
 * device, in all five app languages regardless of the UI language.
 */

type Keyword = string | RegExp;
type WeightedKeyword = [Keyword, number];

// Keywords are matched against the normalised text (lowercase, no accents). Weight 1 = decisive.
const KEYWORDS: Record<Exclude<DocumentLabel, 'other'>, WeightedKeyword[]> = {
  passport: [
    ['passport', 1],
    ['passaporte', 1],
    ['pasaporte', 1],
    ['护照', 1],
    ['パスポート', 1],
    ['旅券', 1],
  ],
  visa: [
    [/\bvisa\b/, 1],
    [/\bvisto\b/, 1],
    ['签证', 1],
    ['ビザ', 1],
    ['査証', 1],
    ['arrival card', 0.8],
    ['entry permit', 0.8],
    // Electronic travel authorisations (USA ESTA, Canada eTA, EU ETIAS, UK ETA, e-visas)
    [/\besta\b/, 0.9],
    [/\be ?ta\b/, 0.8],
    ['etias', 1],
    ['evisa', 1],
    ['e visa', 1],
    ['travel authori', 0.9],
  ],
  flight: [
    ['boarding pass', 1],
    ['boardingpass', 1],
    ['cartao de embarque', 1],
    ['tarjeta de embarque', 1],
    ['pase de abordar', 1],
    ['登机牌', 1],
    ['搭乗券', 1],
    ['e ticket', 0.6],
    ['eticket', 0.6],
    [/\betkt\b/, 0.8],
    ['itinerary receipt', 0.8],
    ['flight', 0.8],
    [/\bvoo\b/, 0.8],
    [/\bvuelo\b/, 0.8],
    ['机票', 1],
    ['航班', 0.8],
    ['航空券', 1],
    ['airline', 0.5],
    ['airways', 0.5],
    ['aereo', 0.6],
    // IATA flight number like "CA1234" or "LA 8084" (normalised to lowercase)
    [/\b[a-z][a-z0-9]\s?\d{3,4}\b/, 0.5],
  ],
  train: [
    ['12306', 1],
    ['火车票', 1],
    ['高铁', 1],
    ['动车', 0.8],
    ['列车', 0.8],
    ['新幹線', 1],
    ['乗車券', 1],
    ['特急券', 1],
    ['train', 0.8],
    ['trem', 0.8],
    ['tren', 0.8],
    ['rail', 0.6],
    ['zug', 0.8],
    ['treno', 0.8],
    ['jr pass', 1],
    // Operators and passes around the world
    ['eurostar', 1],
    ['sncf', 1],
    ['ouigo', 1],
    ['trenitalia', 1],
    ['italo', 0.8],
    ['renfe', 1],
    ['deutsche bahn', 1],
    [/\bdb\b/, 0.5],
    ['amtrak', 1],
    ['via rail', 1],
    ['comboios', 1],
    ['eurail', 1],
    ['interrail', 1],
    ['ktx', 1],
    // Train numbers such as China's "G1234"/"D312" or Europe's "ICE 123"
    [/\b[gdcktz]\d{1,4}\b/, 0.4],
    [/\b(?:ice|tgv|ave|ic)\s?\d{2,4}\b/, 0.6],
  ],
  bus_ferry: [
    [/\bbus\b/, 0.8],
    ['onibus', 0.8],
    ['autobus', 0.8],
    ['flixbus', 1],
    ['greyhound', 1],
    ['ferry', 0.8],
    ['balsa', 0.6],
    ['巴士', 0.8],
    ['大巴', 0.8],
    ['渡轮', 0.8],
    ['バス', 0.8],
    ['フェリー', 0.8],
  ],
  stay: [
    ['hotel', 0.8],
    ['hostel', 0.8],
    ['hospedagem', 0.8],
    ['alojamiento', 0.8],
    ['hospedaje', 0.8],
    ['airbnb', 1],
    ['booking.com', 1],
    ['booking confirmation', 0.8],
    ['voucher', 0.6],
    // "reserva"/"reservation" alone is ambiguous (museum, restaurant…), so it only tips the balance.
    ['reserva', 0.4],
    ['reservation', 0.4],
    ['check in', 0.4],
    ['guesthouse', 0.8],
    ['guest house', 0.8],
    ['pousada', 0.8],
    ['bed and breakfast', 0.8],
    ['b&b', 0.8],
    ['ryokan', 1],
    ['motel', 0.8],
    ['resort', 0.6],
    // "Book and Bed", "Bed & Breakfast", "bed 4 nights"…
    [/\bbed\b/, 0.6],
    ['酒店', 1],
    ['宾馆', 1],
    ['民宿', 1],
    ['ホテル', 1],
    ['旅館', 1],
    ['宿泊', 1],
    ['予約確認', 0.6],
  ],
  insurance: [
    ['insurance', 1],
    ['seguro', 1],
    ['apolice', 1],
    ['poliza', 1],
    ['保险', 1],
    ['保険', 1],
  ],
  activity: [
    ['ticket', 0.4],
    ['ingresso', 0.8],
    ['entrada', 0.5],
    ['admission', 0.8],
    ['tour', 0.6],
    ['museum', 0.6],
    ['museu', 0.6],
    ['museo', 0.6],
    ['门票', 1],
    ['入场券', 1],
    ['チケット', 0.6],
    ['入場券', 1],
  ],
  health: [
    ['vaccin', 1],
    ['vacina', 1],
    ['vacuna', 1],
    ['yellow fever', 1],
    ['febre amarela', 1],
    ['civp', 1],
    ['prescription', 0.8],
    ['receita', 0.6],
    ['receta', 0.6],
    ['疫苗', 1],
    ['ワクチン', 1],
  ],
  money: [
    ['receipt', 0.6],
    ['recibo', 0.6],
    ['invoice', 0.6],
    ['fatura', 0.6],
    ['factura', 0.6],
    ['发票', 0.8],
    ['領収書', 0.8],
    ['bank', 0.4],
    ['card', 0.2],
  ],
};

export interface LabelSuggestion {
  label: DocumentLabel;
  /** 0..1; below CONFIDENCE_THRESHOLD the UI pre-selects "other" and shows `alternatives`. */
  confidence: number;
  /** Top labels by score, best first, excluding "other". */
  alternatives: DocumentLabel[];
}

export const CONFIDENCE_THRESHOLD = 0.6;
const TEXT_WEIGHT = 0.4;

/** Lowercase, strip accents and extension, split camelCase; `_`, `-` and spaces become one space. */
export function normalizeTitle(input: string): string {
  return (
    input
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Strip Latin accents only; Japanese kana marks (e.g. the ゚ in ポ) must survive.
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[_\-\s]+/g, ' ')
      .trim()
  );
}

function matches(text: string, keyword: Keyword): boolean {
  return typeof keyword === 'string' ? text.includes(keyword) : keyword.test(text);
}

function scoreText(text: string, scores: Map<DocumentLabel, number>, weight: number) {
  for (const [label, keywords] of Object.entries(KEYWORDS) as [
    DocumentLabel,
    WeightedKeyword[],
  ][]) {
    let best = 0;
    for (const [keyword, w] of keywords) {
      if (matches(text, keyword)) best = Math.max(best, w);
    }
    if (best > 0) scores.set(label, (scores.get(label) ?? 0) + best * weight);
  }
}

export interface SuggestOptions {
  /** First-page text extracted on the device (pdf.js), weighted lower than the title. */
  text?: string;
  /** Per-user boosts learned from corrections: token -> label. */
  boosts?: Readonly<Record<string, DocumentLabel>>;
}

export function suggestLabel(fileName: string, options: SuggestOptions = {}): LabelSuggestion {
  const title = normalizeTitle(fileName);
  const scores = new Map<DocumentLabel, number>();

  scoreText(title, scores, 1);
  if (options.text) scoreText(normalizeTitle(options.text).slice(0, 4000), scores, TEXT_WEIGHT);

  if (options.boosts) {
    for (const token of title.split(/[\s.-]+/)) {
      const label = options.boosts[token];
      if (label) scores.set(label, (scores.get(label) ?? 0) + 1);
    }
  }

  const ranked = [...scores.entries()]
    .filter(([label]) => label !== 'other')
    .sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first) return { label: 'other', confidence: 0, alternatives: [] };

  // Confidence drops when two labels compete closely.
  const margin = second ? (first[1] - second[1]) / first[1] : 1;
  const confidence = Math.min(1, first[1]) * (0.5 + 0.5 * margin);
  const alternatives = ranked.slice(0, 3).map(([label]) => label);

  return {
    label: confidence >= CONFIDENCE_THRESHOLD ? first[0] : 'other',
    confidence: Math.round(confidence * 100) / 100,
    alternatives,
  };
}

/** Records tokens of a corrected title so the next similar file gets the right label. */
export function learnBoosts(
  fileName: string,
  label: DocumentLabel,
  boosts: Readonly<Record<string, DocumentLabel>> = {},
): Record<string, DocumentLabel> {
  const next = { ...boosts };
  for (const token of normalizeTitle(fileName).split(/[\s.-]+/)) {
    if (token.length >= 3 && !/^\d+$/.test(token)) next[token] = label;
  }
  return next;
}

/** Turns "ETKT_CA1234_SMITH_JOHN.pdf" into "Flight CA1234". Falls back to a tidied file name. */
export function suggestTitle(fileName: string, label: DocumentLabel): string {
  // Drop any folder path ("vouchers/…", "C:\Downloads\…") and the extension.
  const base = (fileName.split(/[\\/]/).pop() ?? fileName).replace(/\.[a-z0-9]{2,5}$/i, '');
  if (label === 'flight') {
    const m = base.match(/(?:^|[^A-Za-z0-9])([A-Z][A-Z0-9]\s?\d{3,4})(?![0-9])/);
    if (m?.[1]) return `Flight ${m[1].replace(/\s/, '')}`;
  }
  if (label === 'train') {
    const m = base.match(/(?:^|[^A-Za-z0-9])([GDCKTZ]\d{1,4})(?![0-9])/);
    if (m?.[1]) return `Train ${m[1]}`;
  }
  const tidy = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
}
