import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';
import { err, ok } from 'neverthrow';
import type { Result } from 'neverthrow';
import { AwardAlertSchema, FlightOptionSchema } from '../types.js';
import type { AwardAlert, FlightOption, AppError } from '../types.js';

type CabinLabel = 'Economy' | 'Premium Economy' | 'Business' | 'First';

const CABIN_MAP: Record<string, CabinLabel> = {
  economy: 'Economy',
  'premium economy': 'Premium Economy',
  business: 'Business',
  first: 'First',
};

const INTRO_RE =
  /alert "([^"]+)" with (.+?) in (.+?) for ([A-Z]{3}) to ([A-Z]{3}) on (\d{4}-\d{2}-\d{2})/;

const FARE_RE =
  /^(Economy|Premium Economy|Business|First),\s*([\d,]+)\s*points\s*\+\s*\$?([\d.]+)\s*USD/;

const LAST_SEEN_RE = /\((\d{2}\/\d{2}\s+\d{2}:\d{2}\s+UTC)\)/;

export async function parseSeatsAeroEmail(
  rawEmail: Buffer | string,
  emailId: string
): Promise<Result<AwardAlert, AppError>> {
  try {
    const mail = await simpleParser(rawEmail);

    const html = mail.html;
    if (!html) {
      return err({ code: 'EMAIL_PARSE_ERROR', message: 'No HTML body in email' });
    }

    const $ = cheerio.load(html);

    const introText = $('p.text-gray-700').first().text();
    const introMatch = INTRO_RE.exec(introText);
    if (!introMatch) {
      return err({ code: 'EMAIL_PARSE_ERROR', message: 'Could not parse email intro paragraph' });
    }

    const alertName = introMatch[1] ?? '';
    const program = introMatch[2] ?? '';
    const cabinPhrase = introMatch[3] ?? '';
    const origin = introMatch[4] ?? '';
    const destination = introMatch[5] ?? '';
    const travelDate = introMatch[6] ?? '';

    const cabinKey = cabinPhrase
      .toLowerCase()
      .replace(/ class$/, '')
      .trim();
    const cabin = CABIN_MAP[cabinKey];
    if (!cabin) {
      return err({ code: 'EMAIL_PARSE_ERROR', message: `Unknown cabin: "${cabinPhrase}"` });
    }

    const flights: FlightOption[] = [];

    $('table.card').each((_i, el) => {
      const cells = $(el).find('td[class]');
      if (cells.length < 3) return;

      const flightText = cells.eq(0).find('p').first().text().trim();
      const routingText = cells.eq(1).find('p').first().text().trim();
      const fareText = cells.eq(2).find('p').first().text().trim();

      const flightNumbers = flightText
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      const segments = routingText.split('/');
      const isDirect = segments.length === 2;
      const numStops = segments.length - 2;

      const fareMatch = FARE_RE.exec(fareText);
      if (!fareMatch) return;

      const flightCabin = fareMatch[1] as CabinLabel;
      const miles = parseInt((fareMatch[2] ?? '0').replace(/,/g, ''), 10);
      const taxesUsd = parseFloat(fareMatch[3] ?? '0');

      const flightResult = FlightOptionSchema.safeParse({
        flightNumbers,
        routing: routingText,
        segments,
        isDirect,
        numStops,
        cabin: flightCabin,
        miles,
        taxesUsd,
      });

      if (flightResult.success) flights.push(flightResult.data);
    });

    if (flights.length === 0) {
      return err({ code: 'EMAIL_PARSE_ERROR', message: 'No valid flights found in email' });
    }

    const cheapestMiles = Math.min(...flights.map((f) => f.miles));
    const directFlights = flights.filter((f) => f.isDirect);
    const cheapestDirect =
      directFlights.length > 0 ? Math.min(...directFlights.map((f) => f.miles)) : undefined;
    const hasDirectOption = directFlights.length > 0;

    const lastSeenText = $('p.text-gray-500')
      .filter((_i, el) => $(el).text().includes('Last Seen'))
      .first()
      .text();
    const lastSeenUtc = LAST_SEEN_RE.exec(lastSeenText)?.[1];

    const detailsUrl = $('a[target="_blank"]').first().attr('href') ?? '';

    const validation = AwardAlertSchema.safeParse({
      alertName,
      program,
      origin,
      destination,
      travelDate,
      cabin,
      flights,
      cheapestMiles,
      cheapestDirect,
      hasDirectOption,
      lastSeenUtc,
      detailsUrl,
      emailId,
      emailReceivedAt: mail.date ?? new Date(),
      detectedAt: new Date(),
    });

    if (!validation.success) {
      return err({
        code: 'EMAIL_PARSE_ERROR',
        message: `Schema validation failed: ${validation.error.message}`,
      });
    }

    return ok(validation.data);
  } catch (e) {
    return err({
      code: 'EMAIL_PARSE_ERROR',
      message: `Failed to parse email: ${String(e)}`,
      cause: e,
    });
  }
}
