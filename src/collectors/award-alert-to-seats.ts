import type { AwardAlert, AwardSeat, CabinClass } from '../types.js';

type RichCabin = 'Economy' | 'Premium Economy' | 'Business' | 'First';

const CABIN_MAP: Record<RichCabin, CabinClass> = {
  Economy: 'ECONOMY',
  'Premium Economy': 'PREMIUM_ECONOMY',
  Business: 'BUSINESS',
  First: 'BUSINESS',
};

export function awardAlertToSeats(alert: AwardAlert): AwardSeat[] {
  return alert.flights.map((flight) => ({
    source: 'seats.aero' as const,
    program: alert.program,
    airline: (flight.flightNumbers[0] ?? 'XX').slice(0, 2).toUpperCase(),
    origin: alert.origin,
    destination: alert.destination,
    date: new Date(alert.travelDate),
    cabin: CABIN_MAP[flight.cabin],
    seats: flight.isDirect ? 2 : 1,
    miles: flight.miles,
    taxesCents: Math.round(flight.taxesUsd * 100),
    url: alert.detailsUrl,
  }));
}
