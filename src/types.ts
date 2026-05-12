import { z } from 'zod';

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

// ── Rich award alert schema (produced by Gmail email parser) ──────────────────

const IATACode = z.string().regex(/^[A-Z]{3}$/);
const FlightNumber = z.string().regex(/^[A-Z]{2,3}\d{1,4}[A-Z]?$/);
const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Cabin = z.enum(['Economy', 'Premium Economy', 'Business', 'First']);

export const FlightOptionSchema = z
  .object({
    flightNumbers: z.array(FlightNumber).min(1),
    routing: z.string().regex(/^[A-Z]{3}(\/[A-Z]{3})+$/),
    segments: z.array(IATACode).min(2),
    isDirect: z.boolean(),
    numStops: z.number().int().nonnegative(),
    cabin: Cabin,
    miles: z.number().int().positive(),
    taxesUsd: z.number().nonnegative(),
  })
  .refine((data) => data.flightNumbers.length === data.segments.length - 1, {
    message: 'flight numbers count must equal segments - 1',
  });

export const AwardAlertSchema = z.object({
  alertName: z.string(),
  program: z.string(),
  origin: IATACode,
  destination: IATACode,
  travelDate: ISODate,
  cabin: Cabin,
  flights: z.array(FlightOptionSchema).min(1),
  cheapestMiles: z.number().int().positive(),
  cheapestDirect: z.number().int().positive().optional(),
  hasDirectOption: z.boolean(),
  lastSeenUtc: z.string().optional(),
  detailsUrl: z.string().url(),
  emailId: z.string(),
  emailReceivedAt: z.date(),
  detectedAt: z.date(),
});

export type FlightOption = z.infer<typeof FlightOptionSchema>;
export type AwardAlert = z.infer<typeof AwardAlertSchema>;
