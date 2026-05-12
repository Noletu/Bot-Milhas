import { describe, it, expect } from 'vitest';
import { crossReference } from '../../src/engine/cross-reference.js';
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
  title: 'LATAM Executiva para Europa com milhas',
  detectedAt: new Date(),
});

const jSeatGruFco = (): AwardSeat => ({
  source: 'seats.aero',
  program: 'QANTAS_FF',
  airline: 'LA',
  origin: 'GRU',
  destination: 'FCO',
  date: new Date('2027-07-15'),
  cabin: 'BUSINESS',
  seats: 2,
  miles: 75000,
  taxesCents: 5000000,
  url: 'https://seats.aero/search',
});

const partnerSeatGruMad = (): AwardSeat => ({
  source: 'seats.aero',
  program: 'IBERIA_PLUS',
  airline: 'IB',
  origin: 'GRU',
  destination: 'MAD',
  date: new Date('2027-08-20'),
  cabin: 'BUSINESS',
  seats: 2,
  miles: 65000,
  taxesCents: 3000000,
  url: 'https://seats.aero/search',
});

describe('crossReference', () => {
  it('returns empty array when no promos and no seats', () => {
    const alerts = crossReference([], []);
    expect(alerts).toHaveLength(0);
  });

  it('generates RED alert when LATAM promo + matching J seat in window', () => {
    const alerts = crossReference([latamPromo()], [jSeatGruFco()]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.level).toBe('RED');
    expect(alerts[0]?.promo).not.toBeNull();
    expect(alerts[0]?.seat).not.toBeNull();
  });

  it('generates YELLOW alert when LATAM promo with no matching seat', () => {
    const alerts = crossReference([latamPromo()], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.level).toBe('YELLOW');
    expect(alerts[0]?.promo).not.toBeNull();
    expect(alerts[0]?.seat).toBeNull();
  });

  it('generates GREEN alert for partner seat without LATAM promo on that route', () => {
    const alerts = crossReference([], [partnerSeatGruMad()]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.level).toBe('GREEN');
    expect(alerts[0]?.seat).not.toBeNull();
    expect(alerts[0]?.promo).toBeNull();
  });

  it('generates RED for matched route and YELLOW for unmatched promo', () => {
    const promoFco = latamPromo();
    const seatFco = jSeatGruFco();
    const alerts = crossReference([promoFco], [seatFco, partnerSeatGruMad()]);

    const red = alerts.filter((a) => a.level === 'RED');
    const green = alerts.filter((a) => a.level === 'GREEN');
    expect(red).toHaveLength(1);
    expect(green).toHaveLength(1);
  });

  it('sets route on the alert as ORIGIN-DESTINATION', () => {
    const alerts = crossReference([], [jSeatGruFco()]);
    expect(alerts[0]?.route).toBe('GRU-FCO');
  });

  it('sets detectedAt on the alert', () => {
    const before = new Date();
    const alerts = crossReference([latamPromo()], []);
    const after = new Date();
    expect(alerts[0]?.detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(alerts[0]?.detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('includes a non-empty dedupeKey on each alert', () => {
    const alerts = crossReference([latamPromo()], [jSeatGruFco()]);
    expect(alerts[0]?.dedupeKey).toBeTruthy();
  });
});
