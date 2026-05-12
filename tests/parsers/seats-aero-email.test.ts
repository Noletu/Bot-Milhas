import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSeatsAeroEmail } from '../../src/parsers/seats-aero-email.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures/seats-aero-emails');

describe('parseSeatsAeroEmail', () => {
  it('parses economy multi-flight email with 5 direct flights', async () => {
    const raw = readFileSync(resolve(fixturesDir, 'dfw-lax-economy-multi-flight.eml'));
    const result = await parseSeatsAeroEmail(raw, 'fixture-001');

    expect(result.isOk()).toBe(true);
    const alert = result._unsafeUnwrap();

    expect(alert.alertName).toBe('Teste Alerta');
    expect(alert.program).toBe('American AAdvantage');
    expect(alert.origin).toBe('DFW');
    expect(alert.destination).toBe('LAX');
    expect(alert.travelDate).toBe('2026-05-24');
    expect(alert.cabin).toBe('Economy');
    expect(alert.emailId).toBe('fixture-001');
    expect(alert.flights).toHaveLength(5);

    for (const flight of alert.flights) {
      expect(flight.isDirect).toBe(true);
      expect(flight.numStops).toBe(0);
      expect(flight.segments).toEqual(['DFW', 'LAX']);
      expect(flight.cabin).toBe('Economy');
      expect(flight.taxesUsd).toBeCloseTo(5.6);
    }

    const miles = alert.flights.map((f) => f.miles);
    expect(miles).toEqual(expect.arrayContaining([19000, 20000, 18500, 24000, 28000]));

    expect(alert.cheapestMiles).toBe(18500);
    expect(alert.hasDirectOption).toBe(true);
    expect(alert.cheapestDirect).toBe(18500);
    expect(alert.detailsUrl).toBe('https://c.seats.aero/CL0/example/fixture-001');
  });

  it('parses business single-flight email with connection', async () => {
    const raw = readFileSync(resolve(fixturesDir, 'jfk-lhr-business-with-connection.eml'));
    const result = await parseSeatsAeroEmail(raw, 'fixture-002');

    expect(result.isOk()).toBe(true);
    const alert = result._unsafeUnwrap();

    expect(alert.alertName).toBe('Alerta Teste Executiva');
    expect(alert.program).toBe('American AAdvantage');
    expect(alert.origin).toBe('JFK');
    expect(alert.destination).toBe('LHR');
    expect(alert.travelDate).toBe('2026-07-12');
    expect(alert.cabin).toBe('Business');
    expect(alert.flights).toHaveLength(1);

    const flight = alert.flights[0]!;
    expect(flight.isDirect).toBe(false);
    expect(flight.numStops).toBe(1);
    expect(flight.segments).toEqual(['JFK', 'BOS', 'LHR']);
    expect(flight.flightNumbers).toEqual(['AA4376', 'AA108']);
    expect(flight.routing).toBe('JFK/BOS/LHR');
    expect(flight.cabin).toBe('Business');
    expect(flight.miles).toBe(84500);
    expect(flight.taxesUsd).toBeCloseTo(5.6);

    expect(alert.cheapestMiles).toBe(84500);
    expect(alert.hasDirectOption).toBe(false);
    expect(alert.cheapestDirect).toBeUndefined();
    expect(alert.detailsUrl).toBe('https://c.seats.aero/CL0/example/fixture-002');
  });

  it('returns err for input without HTML body', async () => {
    const result = await parseSeatsAeroEmail(
      'From: test@example.com\r\n\r\nplain text only',
      'bad-id'
    );
    expect(result.isErr()).toBe(true);
  });

  it('returns err when intro paragraph does not match expected pattern', async () => {
    const raw =
      'From: alerts@seats.aero\r\nContent-Type: text/html\r\n\r\n' +
      '<html><body><p class="text-gray-700">Unrelated content here.</p></body></html>';
    const result = await parseSeatsAeroEmail(raw, 'bad-intro');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('EMAIL_PARSE_ERROR');
  });

  it('returns err when cabin is not a recognised value', async () => {
    const raw =
      'From: alerts@seats.aero\r\nContent-Type: text/html\r\n\r\n' +
      '<html><body><p class="text-gray-700">Good news! We discovered availability for your alert ' +
      '"Test" with Qantas in unknown class for GRU to FCO on 2027-06-15.</p></body></html>';
    const result = await parseSeatsAeroEmail(raw, 'bad-cabin');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('EMAIL_PARSE_ERROR');
  });

  it('returns err when fare format is unrecognised (no valid flights)', async () => {
    // fare text does not match FARE_RE → !fareMatch branch → card skipped → flights empty
    const raw =
      'From: alerts@seats.aero\r\nContent-Type: text/html\r\n\r\n' +
      '<html><body>' +
      '<p class="text-gray-700">Good news! We discovered availability for your alert ' +
      '"Test" with Qantas in economy class for GRU to FCO on 2027-06-15.</p>' +
      '<table class="card"><tr><td><table><tr>' +
      '<td class="col-3"><p class="m-0 text-gray-700"><strong>QF1</strong></p></td>' +
      '<td class="col-3"><p class="m-0 text-gray-700">GRU/FCO</p></td>' +
      '<td class="col-6"><p class="m-0 text-gray-700">INVALID FARE FORMAT</p></td>' +
      '</tr></table></td></tr></table>' +
      '</body></html>';
    const result = await parseSeatsAeroEmail(raw, 'no-flights');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('EMAIL_PARSE_ERROR');
  });

  it('skips malformed card (< 3 cells) and card with schema-invalid flight, uses the valid one', async () => {
    // card 1: no inner cells → cells.length < 3 branch
    // card 2: miles=0 → FlightOptionSchema.positive() fails → flightResult.success false branch
    // card 3: valid → flights has 1 entry → ok
    const raw =
      'From: alerts@seats.aero\r\nContent-Type: text/html\r\n\r\n' +
      '<html><body>' +
      '<p class="text-gray-700">Good news! We discovered availability for your alert ' +
      '"Skip Test" with Qantas in economy class for GRU to FCO on 2027-06-15. Bookable now.</p>' +
      // card 1: malformed (no td[class] children)
      '<table class="card"><tr><td><p>no cells</p></td></tr></table>' +
      // card 2: schema fails (miles = 0, not positive)
      '<table class="card"><tr><td><table><tr>' +
      '<td class="col-3"><p class="m-0 text-gray-700"><strong>QF1</strong></p></td>' +
      '<td class="col-3"><p class="m-0 text-gray-700">GRU/FCO</p></td>' +
      '<td class="col-6"><p class="m-0 text-gray-700">Economy, 0 points + $0.00 USD</p></td>' +
      '</tr></table></td></tr></table>' +
      // card 3: valid
      '<table class="card"><tr><td><table><tr>' +
      '<td class="col-3"><p class="m-0 text-gray-700"><strong>QF2</strong></p></td>' +
      '<td class="col-3"><p class="m-0 text-gray-700">GRU/FCO</p></td>' +
      '<td class="col-6"><p class="m-0 text-gray-700">Economy, 75000 points + $50.00 USD</p></td>' +
      '</tr></table></td></tr></table>' +
      '<a href="https://seats.aero/search" target="_blank">View on seats.aero</a>' +
      '</body></html>';
    const result = await parseSeatsAeroEmail(raw, 'skip-test');
    expect(result.isOk()).toBe(true);
    const alert = result._unsafeUnwrap();
    expect(alert.flights).toHaveLength(1);
    expect(alert.cheapestMiles).toBe(75000);
  });

  it('returns err when schema validation fails (missing details URL)', async () => {
    // No a[target="_blank"] → detailsUrl = '' → z.string().url() fails → !validation.success branch
    const raw =
      'From: alerts@seats.aero\r\nContent-Type: text/html\r\n\r\n' +
      '<html><body>' +
      '<p class="text-gray-700">Good news! We discovered availability for your alert ' +
      '"No URL Test" with Qantas in economy class for GRU to FCO on 2027-06-15. Bookable now.</p>' +
      '<table class="card"><tr><td><table><tr>' +
      '<td class="col-3"><p class="m-0 text-gray-700"><strong>QF1</strong></p></td>' +
      '<td class="col-3"><p class="m-0 text-gray-700">GRU/FCO</p></td>' +
      '<td class="col-6"><p class="m-0 text-gray-700">Economy, 80000 points + $50.00 USD</p></td>' +
      '</tr></table></td></tr></table>' +
      '</body></html>';
    const result = await parseSeatsAeroEmail(raw, 'no-url');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('EMAIL_PARSE_ERROR');
  });

  it('parses a minimal valid email with no Date header and no Last Seen line', async () => {
    // covers mail.date ?? new Date() fallback and missing lastSeenUtc path
    const raw =
      'From: alerts@seats.aero\r\nContent-Type: text/html\r\n\r\n' +
      '<html><body>' +
      '<p class="text-gray-700">Good news! We discovered availability for your alert ' +
      '"Minimal Test" with Qantas in economy class for GRU to FCO on 2027-06-15. Bookable now.</p>' +
      '<table class="card"><tr><td><table><tr>' +
      '<td class="col-3"><p class="m-0 text-gray-700"><strong>QF1</strong></p></td>' +
      '<td class="col-3"><p class="m-0 text-gray-700">GRU/FCO</p></td>' +
      '<td class="col-6"><p class="m-0 text-gray-700">Economy, 80000 points + $50.00 USD</p></td>' +
      '</tr></table></td></tr></table>' +
      '<a href="https://seats.aero/search?origin=GRU" target="_blank">View on seats.aero</a>' +
      '</body></html>';
    const result = await parseSeatsAeroEmail(raw, 'minimal-id');
    expect(result.isOk()).toBe(true);
    const alert = result._unsafeUnwrap();
    expect(alert.alertName).toBe('Minimal Test');
    expect(alert.cheapestMiles).toBe(80000);
    expect(alert.lastSeenUtc).toBeUndefined();
    expect(alert.emailReceivedAt).toBeInstanceOf(Date);
  });
});
