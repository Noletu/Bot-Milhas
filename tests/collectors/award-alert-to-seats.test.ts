import { describe, it, expect } from 'vitest';
import { awardAlertToSeats } from '../../src/collectors/award-alert-to-seats.js';
import type { AwardAlert } from '../../src/types.js';

const BASE_FLIGHT = {
  flightNumbers: ['AA100'],
  routing: 'GRU/FCO',
  segments: ['GRU', 'FCO'],
  isDirect: true,
  numStops: 0,
  cabin: 'Business' as const,
  miles: 80000,
  taxesUsd: 50.0,
};

function makeAlert(overrides: Partial<AwardAlert> = {}): AwardAlert {
  return {
    alertName: 'Test Alert',
    program: 'American AAdvantage',
    origin: 'GRU',
    destination: 'FCO',
    travelDate: '2027-06-15',
    cabin: 'Business',
    flights: [BASE_FLIGHT],
    cheapestMiles: 80000,
    hasDirectOption: true,
    cheapestDirect: 80000,
    detailsUrl: 'https://seats.aero/search',
    emailId: 'test-id',
    emailReceivedAt: new Date('2026-05-11'),
    detectedAt: new Date('2026-05-11'),
    ...overrides,
  };
}

describe('awardAlertToSeats', () => {
  it('flattens AwardAlert with 5 flights into 5 AwardSeats', () => {
    const alert = makeAlert({
      flights: Array.from({ length: 5 }, (_, i) => ({
        ...BASE_FLIGHT,
        flightNumbers: [`AA${100 + i}`],
        miles: 80000 + i * 1000,
      })),
      cheapestMiles: 80000,
    });

    const seats = awardAlertToSeats(alert);

    expect(seats).toHaveLength(5);
    for (const seat of seats) {
      expect(seat.source).toBe('seats.aero');
      expect(seat.program).toBe('American AAdvantage');
      expect(seat.origin).toBe('GRU');
      expect(seat.destination).toBe('FCO');
      expect(seat.cabin).toBe('BUSINESS');
      expect(seat.seats).toBe(2);
      expect(seat.url).toBe('https://seats.aero/search');
    }
    const milesValues = seats.map((s) => s.miles);
    expect(milesValues).toEqual([80000, 81000, 82000, 83000, 84000]);
  });

  it('flattens AwardAlert with 1 flight into 1 AwardSeat', () => {
    const alert = makeAlert();
    const seats = awardAlertToSeats(alert);

    expect(seats).toHaveLength(1);
    const seat = seats[0]!;
    expect(seat.source).toBe('seats.aero');
    expect(seat.miles).toBe(80000);
    expect(seat.taxesCents).toBe(5000);
    expect(seat.cabin).toBe('BUSINESS');
    expect(seat.airline).toBe('AA');
    expect(seat.date).toEqual(new Date('2027-06-15'));
  });

  it('sets seats=1 for connecting flights and seats=2 for direct', () => {
    const directAlert = makeAlert({
      flights: [{ ...BASE_FLIGHT, isDirect: true }],
    });
    const connectingAlert = makeAlert({
      flights: [
        {
          ...BASE_FLIGHT,
          flightNumbers: ['AA100', 'AA200'],
          routing: 'GRU/MIA/FCO',
          segments: ['GRU', 'MIA', 'FCO'],
          isDirect: false,
          numStops: 1,
        },
      ],
    });

    expect(awardAlertToSeats(directAlert)[0]!.seats).toBe(2);
    expect(awardAlertToSeats(connectingAlert)[0]!.seats).toBe(1);
  });

  it('maps cabin labels to legacy CabinClass values', () => {
    const cabinCases: Array<[AwardAlert['cabin'], string]> = [
      ['Economy', 'ECONOMY'],
      ['Premium Economy', 'PREMIUM_ECONOMY'],
      ['Business', 'BUSINESS'],
      ['First', 'BUSINESS'],
    ];

    for (const [rich, legacy] of cabinCases) {
      const alert = makeAlert({
        cabin: rich,
        flights: [{ ...BASE_FLIGHT, cabin: rich }],
      });
      const seats = awardAlertToSeats(alert);
      expect(seats[0]!.cabin).toBe(legacy);
    }
  });
});
