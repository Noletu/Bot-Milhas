import { format } from 'date-fns';
import type { PromoEvent, AwardSeat, Alert } from '../types.js';
import { classifyPriority } from './priority.js';
import { dedupeKey } from './dedupe.js';

const LATAM_BUSINESS_CABINS = new Set<string>(['BUSINESS', 'PREMIUM_BUSINESS']);

export function crossReference(promos: PromoEvent[], seats: AwardSeat[]): Alert[] {
  const alerts: Alert[] = [];
  const matchedSeatIndices = new Set<number>();

  for (const promo of promos) {
    if (promo.airline !== 'LATAM' || !LATAM_BUSINESS_CABINS.has(promo.cabin)) {
      continue;
    }

    const matchIdx = findBestSeatMatch(promo, seats, matchedSeatIndices);

    if (matchIdx !== -1) {
      const seat = seats[matchIdx]!;
      matchedSeatIndices.add(matchIdx);
      alerts.push(buildAlert(promo, seat));
    } else {
      alerts.push(buildAlert(promo, null));
    }
  }

  for (let i = 0; i < seats.length; i++) {
    if (!matchedSeatIndices.has(i)) {
      alerts.push(buildAlert(null, seats[i]!));
    }
  }

  return alerts;
}

function findBestSeatMatch(promo: PromoEvent, seats: AwardSeat[], used: Set<number>): number {
  for (let i = 0; i < seats.length; i++) {
    if (used.has(i)) continue;
    const seat = seats[i]!;
    if (
      seat.origin === promo.origin &&
      seat.destination === promo.destination &&
      classifyPriority(promo, seat) === 'RED'
    ) {
      return i;
    }
  }
  return -1;
}

function buildAlert(promo: PromoEvent | null, seat: AwardSeat | null): Alert {
  const level = classifyPriority(promo, seat);
  const origin = promo?.origin ?? seat?.origin ?? '';
  const destination = promo?.destination ?? seat?.destination ?? '';
  const route = `${origin}-${destination}`;

  const dateStr = seat ? format(seat.date, 'yyyy-MM-dd') : 'no-date';
  const program = seat?.program ?? 'LATAM_PASS';
  const cabin = seat?.cabin ?? promo?.cabin ?? 'BUSINESS';

  return {
    level,
    promo,
    seat,
    route,
    detectedAt: new Date(),
    dedupeKey: dedupeKey(route, dateStr, program, cabin),
  };
}
