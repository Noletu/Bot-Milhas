import { describe, it, expect } from 'vitest';
import { dedupeKey, shouldSendAlert } from '../../src/engine/dedupe.js';
import type { Alert } from '../../src/types.js';

const makeAlert = (override: Partial<Alert> = {}): Alert => ({
  level: 'GREEN',
  promo: null,
  seat: {
    source: 'seats.aero',
    program: 'IBERIA_PLUS',
    airline: 'IB',
    origin: 'GRU',
    destination: 'MAD',
    date: new Date('2027-06-15'),
    cabin: 'BUSINESS',
    seats: 2,
    miles: 65000,
    taxesCents: 3000000,
    url: 'https://iberia.com',
  },
  route: 'GRU-MAD',
  detectedAt: new Date(),
  dedupeKey: 'gru-mad|2027-06-15|iberia_plus|business',
  ...override,
});

describe('dedupeKey', () => {
  it('builds a lowercase pipe-separated key', () => {
    const key = dedupeKey('GRU-MAD', '2027-06-15', 'IBERIA_PLUS', 'BUSINESS');
    expect(key).toBe('gru-mad|2027-06-15|iberia_plus|business');
  });

  it('produces the same key regardless of case', () => {
    const a = dedupeKey('GRU-MAD', '2027-06-15', 'Iberia_Plus', 'Business');
    const b = dedupeKey('gru-mad', '2027-06-15', 'iberia_plus', 'business');
    expect(a).toBe(b);
  });
});

describe('shouldSendAlert', () => {
  it('returns true when key has never been seen', () => {
    const hasSeen = (_key: string): boolean => false;
    expect(shouldSendAlert('some-key', hasSeen)).toBe(true);
  });

  it('returns false when key was recently seen', () => {
    const hasSeen = (_key: string): boolean => true;
    expect(shouldSendAlert('some-key', hasSeen)).toBe(false);
  });

  it('passes the exact key to hasSeen', () => {
    let capturedKey = '';
    const hasSeen = (key: string): boolean => {
      capturedKey = key;
      return false;
    };
    shouldSendAlert('my-special-key', hasSeen);
    expect(capturedKey).toBe('my-special-key');
  });
});

describe('dedupeKey from alert', () => {
  it('produces consistent key from seat data', () => {
    const alert = makeAlert();
    const key = dedupeKey(alert.route, '2027-06-15', 'IBERIA_PLUS', 'BUSINESS');
    expect(key).toBe('gru-mad|2027-06-15|iberia_plus|business');
  });
});
