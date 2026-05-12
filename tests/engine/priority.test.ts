import { describe, it, expect } from 'vitest';
import { classifyPriority } from '../../src/engine/priority.js';
import type { PromoEvent, AwardSeat } from '../../src/types.js';

const latamPromo = (): PromoEvent => ({
  source: 'rss',
  airline: 'LATAM',
  origin: 'GRU',
  destination: 'FCO',
  cabin: 'BUSINESS',
  priceReais: null,
  milesEstimate: 85000,
  dateRange: { from: new Date('2027-06-01'), to: new Date('2027-09-30') },
  url: 'https://melhoresdestinos.com.br/promo-latam-executiva-europa',
  title: 'LATAM com milhas em Executiva para Roma',
  detectedAt: new Date(),
});

const jSeatLatam = (): AwardSeat => ({
  source: 'seats.aero',
  program: 'QANTAS_FF',
  airline: 'LA',
  origin: 'GRU',
  destination: 'FCO',
  date: new Date('2027-07-10'),
  cabin: 'BUSINESS',
  seats: 2,
  miles: 75000,
  taxesCents: 5000000,
  url: 'https://seats.aero/search',
});

const partnerSeat = (): AwardSeat => ({
  source: 'seats.aero',
  program: 'IBERIA_PLUS',
  airline: 'IB',
  origin: 'GRU',
  destination: 'MAD',
  date: new Date('2027-07-10'),
  cabin: 'BUSINESS',
  seats: 2,
  miles: 65000,
  taxesCents: 3000000,
  url: 'https://seats.aero/search',
});

describe('classifyPriority', () => {
  it('returns RED when LATAM promo + confirmed J seat in compatible window', () => {
    const level = classifyPriority(latamPromo(), jSeatLatam());
    expect(level).toBe('RED');
  });

  it('returns YELLOW when LATAM promo exists but no seat inventory confirmed', () => {
    const level = classifyPriority(latamPromo(), null);
    expect(level).toBe('YELLOW');
  });

  it('returns GREEN when partner seat found without any LATAM promo', () => {
    const level = classifyPriority(null, partnerSeat());
    expect(level).toBe('GREEN');
  });

  it('returns GREEN when non-LATAM promo + seat found', () => {
    const iberiaPromo: PromoEvent = {
      ...latamPromo(),
      airline: 'IBERIA',
    };
    const level = classifyPriority(iberiaPromo, partnerSeat());
    expect(level).toBe('GREEN');
  });

  it('returns YELLOW when LATAM promo + seat exists but outside date window', () => {
    const seatOutsideWindow: AwardSeat = {
      ...jSeatLatam(),
      date: new Date('2028-06-01'),
    };
    const level = classifyPriority(latamPromo(), seatOutsideWindow);
    expect(level).toBe('YELLOW');
  });

  it('returns YELLOW when LATAM promo + only 1 seat available (need 2)', () => {
    const oneSeat: AwardSeat = { ...jSeatLatam(), seats: 1 };
    const level = classifyPriority(latamPromo(), oneSeat);
    expect(level).toBe('YELLOW');
  });
});
