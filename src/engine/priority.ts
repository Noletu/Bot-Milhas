import type { PromoEvent, AwardSeat, AlertLevel } from '../types.js';

const PROMO_WINDOW_BUFFER_DAYS = 30;
const MIN_PAX_SEATS = 2;
const LATAM_BUSINESS_CABINS = new Set<string>(['BUSINESS', 'PREMIUM_BUSINESS']);

export function classifyPriority(promo: PromoEvent | null, seat: AwardSeat | null): AlertLevel {
  const isLatamBusiness =
    promo !== null && promo.airline === 'LATAM' && LATAM_BUSINESS_CABINS.has(promo.cabin);

  if (
    isLatamBusiness &&
    seat !== null &&
    seat.seats >= MIN_PAX_SEATS &&
    isDateInPromoWindow(promo, seat.date)
  ) {
    return 'RED';
  }

  if (isLatamBusiness) {
    return 'YELLOW';
  }

  return 'GREEN';
}

function isDateInPromoWindow(promo: PromoEvent, date: Date): boolean {
  if (promo.dateRange === null) return true;

  const windowStart = new Date(promo.dateRange.from);
  const windowEnd = new Date(promo.dateRange.to);
  windowStart.setDate(windowStart.getDate() - PROMO_WINDOW_BUFFER_DAYS);
  windowEnd.setDate(windowEnd.getDate() + PROMO_WINDOW_BUFFER_DAYS);

  return date >= windowStart && date <= windowEnd;
}
