import type { PromoEvent, CabinClass } from '../types.js';
import { resolveDestinationFromText, resolveOriginFromText } from './airline-codes.js';

const LATAM_PATTERN = /\blatam\b/i;
const BUSINESS_PATTERN = /executiva|premium\s*business|business\s*class/i;
const MILES_CONTEXT_PATTERN = /milhas|promo|promoção|R\$/i;
const EXCLUDE_PATTERN = /first\s*class|primeira\s*classe/i;

const MILES_EXTRACT = /(\d[\d.,]+)\s*(?:mil(?:has)?|pontos)/i;
const PRICE_EXTRACT = /R\$\s*(\d[\d.,]+)/i;

export interface RssItem {
  title: string;
  link: string;
  content: string;
  pubDate: string;
}

export function detectPromo(item: RssItem): PromoEvent | null {
  const fullText = `${item.title} ${item.content}`;

  if (!LATAM_PATTERN.test(fullText)) return null;
  if (!BUSINESS_PATTERN.test(fullText)) return null;
  if (!MILES_CONTEXT_PATTERN.test(fullText)) return null;
  if (EXCLUDE_PATTERN.test(fullText)) return null;

  const destination = resolveDestinationFromText(fullText);
  if (destination === null) return null;

  const origin = resolveOriginFromText(fullText) ?? 'GRU';
  const cabin = resolveCabin(fullText);
  const milesEstimate = extractMiles(fullText);
  const priceReais = extractPrice(fullText);
  const dateRange = extractDateRange(fullText);

  return {
    source: 'rss',
    airline: 'LATAM',
    origin,
    destination,
    cabin,
    priceReais,
    milesEstimate,
    dateRange,
    url: item.link,
    title: item.title,
    detectedAt: new Date(),
  };
}

export function detectPromos(items: RssItem[]): PromoEvent[] {
  return items.flatMap((item) => {
    const promo = detectPromo(item);
    return promo !== null ? [promo] : [];
  });
}

function resolveCabin(text: string): CabinClass {
  if (/premium\s*business/i.test(text)) return 'PREMIUM_BUSINESS';
  return 'BUSINESS';
}

function extractMiles(text: string): number | null {
  const match = MILES_EXTRACT.exec(text);
  if (match === null || match[1] === undefined) return null;
  const raw = match[1].replace(/\./g, '').replace(',', '.');
  const value = parseFloat(raw);
  if (isNaN(value)) return null;
  // "85" in "85.000 milhas" → already parsed as 85000 after removing dot
  // "85k" not expected in RSS; values come as "85.000"
  return Math.round(value);
}

function extractPrice(text: string): number | null {
  const match = PRICE_EXTRACT.exec(text);
  if (match === null || match[1] === undefined) return null;
  const raw = match[1].replace(/\./g, '').replace(',', '.');
  const value = parseFloat(raw);
  return isNaN(value) ? null : Math.round(value);
}

const MONTH_MAP: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

function extractDateRange(text: string): { from: Date; to: Date } | null {
  const monthPattern = Object.keys(MONTH_MAP).join('|');
  const re = new RegExp(
    `(?:de\\s+)?(\\d{1,2}\\s+(?:de\\s+)?)?(?:(${monthPattern})\\s+(?:a|ao|até)\\s+(${monthPattern}))(?:\\s+de\\s+(\\d{4}))?`,
    'i'
  );

  const match = re.exec(text);
  if (match === null) {
    const simpleRe = new RegExp(
      `(${monthPattern})\\s+(?:a|ao|até)\\s+(${monthPattern})(?:\\s+de\\s+(\\d{4}))?`,
      'i'
    );
    const simpleMatch = simpleRe.exec(text);
    if (simpleMatch === null) return null;

    const [, fromMonth, toMonth, year] = simpleMatch;
    return buildDateRange(fromMonth, toMonth, year);
  }

  const [, , fromMonth, toMonth, year] = match;
  return buildDateRange(fromMonth, toMonth, year);
}

function buildDateRange(
  fromMonthRaw: string | undefined,
  toMonthRaw: string | undefined,
  yearRaw: string | undefined
): { from: Date; to: Date } | null {
  if (fromMonthRaw === undefined || toMonthRaw === undefined) return null;

  const fromMonthNum = MONTH_MAP[fromMonthRaw.toLowerCase()];
  const toMonthNum = MONTH_MAP[toMonthRaw.toLowerCase()];
  if (fromMonthNum === undefined || toMonthNum === undefined) return null;

  const year = yearRaw ?? String(new Date().getFullYear() + 1);
  return {
    from: new Date(`${year}-${fromMonthNum}-01`),
    to: new Date(`${year}-${toMonthNum}-30`),
  };
}
