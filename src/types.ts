export type AlertLevel = 'RED' | 'YELLOW' | 'GREEN';

export type PromoSource = 'rss' | 'imap' | 'scraper';

export type CabinClass = 'BUSINESS' | 'PREMIUM_BUSINESS' | 'PREMIUM_ECONOMY' | 'ECONOMY';

export interface PromoEvent {
  source: PromoSource;
  airline: string;
  origin: string;
  destination: string;
  cabin: CabinClass;
  priceReais: number | null;
  milesEstimate: number | null;
  dateRange: { from: Date; to: Date } | null;
  url: string;
  title: string;
  detectedAt: Date;
}

export interface AwardSeat {
  source: 'seats.aero';
  program: string;
  airline: string;
  origin: string;
  destination: string;
  date: Date;
  cabin: CabinClass;
  seats: number;
  miles: number;
  taxesCents: number;
  url: string;
}

export interface Alert {
  level: AlertLevel;
  promo: PromoEvent | null;
  seat: AwardSeat | null;
  route: string;
  detectedAt: Date;
  dedupeKey: string;
}

export interface AppError {
  code: string;
  message: string;
  cause?: unknown;
}
