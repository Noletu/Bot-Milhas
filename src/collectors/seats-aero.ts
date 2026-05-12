import axios from 'axios';
import axiosRetry from 'axios-retry';
import { z } from 'zod';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { parseISO } from 'date-fns';
import type { AwardSeat, CabinClass, AppError } from '../types.js';
import type { SearchConfig } from '../../config/search.schema.js';

const BASE_URL = 'https://seats.aero/partnerapi';

const RouteSchema = z.object({
  OriginAirport: z.string(),
  DestinationAirport: z.string(),
  Source: z.string(),
});

const AvailabilityItemSchema = z.object({
  ID: z.string(),
  Source: z.string(),
  ParsedDate: z.string(),
  JAvailable: z.boolean(),
  JMileageCost: z.number().nullable(),
  JRemainingSeats: z.number(),
  JTaxesCents: z.number().nullable(),
  YAvailable: z.boolean(),
  YMileageCost: z.number().nullable(),
  YRemainingSeats: z.number(),
  YTaxesCents: z.number().nullable(),
  Route: RouteSchema,
});

const AvailabilityResponseSchema = z.object({
  data: z.array(AvailabilityItemSchema),
  hasMore: z.boolean(),
  cursor: z.string(),
});

const SOURCE_TO_PROGRAM: Record<string, string> = {
  qantas: 'QANTAS_FF',
  american: 'AADVANTAGE',
  iberia: 'IBERIA_PLUS',
  britishairways: 'BRITISH_AIRWAYS',
  qatar: 'QATAR_PRIVILEGE',
  avianca: 'AVIANCA_LIFEMILES',
  aeroplan: 'AEROPLAN',
  tap: 'TAP_MILES_GO',
  united: 'UNITED_MILEAGEPLUS',
  smiles: 'SMILES',
};

const OUTBOUND_SOURCES = [
  'qantas',
  'american',
  'iberia',
  'britishairways',
  'qatar',
  'avianca',
  'aeroplan',
  'tap',
];

const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
});
axiosRetry(httpClient, {
  retries: 3,
  retryDelay: (count, err) => axiosRetry.exponentialDelay(count, err),
  retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err),
});

export async function fetchAwardSeats(
  apiKey: string,
  config: SearchConfig
): Promise<Result<AwardSeat[], AppError>> {
  const { origins, destinations, outbound } = config.search;
  const seats: AwardSeat[] = [];
  const errors: string[] = [];

  for (const origin of origins) {
    for (const destination of destinations) {
      for (const source of OUTBOUND_SOURCES) {
        const result = await fetchRoute(apiKey, {
          origin,
          destination,
          cabin: 'business',
          startDate: outbound.date_window.from,
          endDate: outbound.date_window.to,
          source,
        });
        if (result.isOk()) {
          seats.push(...result.value);
        } else {
          errors.push(result.error.message);
        }
      }
    }
  }

  if (seats.length === 0 && errors.length > 0) {
    return err({ code: 'SEATS_AERO_ALL_FAILED', message: errors.join('; ') });
  }

  return ok(seats);
}

interface RouteQuery {
  origin: string;
  destination: string;
  cabin: string;
  startDate: string;
  endDate: string;
  source: string;
}

async function fetchRoute(
  apiKey: string,
  query: RouteQuery
): Promise<Result<AwardSeat[], AppError>> {
  try {
    const response = await httpClient.get('/availability', {
      headers: { 'Partner-Authorization': apiKey },
      params: {
        origin_airport: query.origin,
        destination_airport: query.destination,
        cabin: query.cabin,
        start_date: query.startDate,
        end_date: query.endDate,
        source: query.source,
      },
    });

    const parsed = AvailabilityResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      return err({
        code: 'SEATS_AERO_PARSE_ERROR',
        message: `Schema validation failed for ${query.origin}-${query.destination}: ${parsed.error.message}`,
      });
    }

    const seats = parsed.data.data
      .filter((item) => item.JAvailable && item.JMileageCost !== null && item.JRemainingSeats >= 1)
      .map((item) => mapToAwardSeat(item, query));

    return ok(seats);
  } catch (e) {
    return err({
      code: 'SEATS_AERO_FETCH_ERROR',
      message: `Failed to fetch ${query.origin}-${query.destination} via ${query.source}: ${String(e)}`,
      cause: e,
    });
  }
}

function mapToAwardSeat(
  item: z.infer<typeof AvailabilityItemSchema>,
  query: RouteQuery
): AwardSeat {
  const program = SOURCE_TO_PROGRAM[item.Source.toLowerCase()] ?? item.Source.toUpperCase();
  const cabin: CabinClass = 'BUSINESS';

  return {
    source: 'seats.aero',
    program,
    airline: item.Route.Source.toUpperCase().slice(0, 2),
    origin: item.Route.OriginAirport,
    destination: item.Route.DestinationAirport,
    date: parseISO(item.ParsedDate),
    cabin,
    seats: item.JRemainingSeats,
    miles: item.JMileageCost!,
    taxesCents: item.JTaxesCents ?? 0,
    url: `https://seats.aero/search?origin=${query.origin}&destination=${query.destination}&cabin=business`,
  };
}
