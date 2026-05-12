export const AIRLINE_IATA: Record<string, string> = {
  LATAM: 'LA',
  IBERIA: 'IB',
  BRITISH_AIRWAYS: 'BA',
  QATAR_AIRWAYS: 'QR',
  AVIANCA: 'AV',
  AIR_CANADA: 'AC',
  TAP: 'TP',
  ITA_AIRWAYS: 'AZ',
  UNITED: 'UA',
  AMERICAN: 'AA',
};

export const DESTINATION_KEYWORDS: Record<string, string> = {
  FCO: 'Roma|Rome|Fiumicino|FCO',
  MAD: 'Madri|Madrid|Barajas|MAD',
  CDG: 'Paris|Charles de Gaulle|CDG',
};

export const ORIGIN_CODES = ['GRU', 'GIG'];
export const DESTINATION_CODES = ['FCO', 'MAD', 'CDG'];

export function resolveDestinationFromText(text: string): string | null {
  for (const [code, keywords] of Object.entries(DESTINATION_KEYWORDS)) {
    if (new RegExp(keywords, 'i').test(text)) return code;
  }
  return null;
}

export function resolveOriginFromText(text: string): string | null {
  if (/Guarulhos|GRU|\bSão Paulo\b/i.test(text)) return 'GRU';
  if (/Galeão|GIG|\bRio\b/i.test(text)) return 'GIG';
  return null;
}
