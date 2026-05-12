import { z } from 'zod';

const DateWindowSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

const MilesMapSchema = z.record(z.string(), z.number().positive());

const LegSchema = z.object({
  cabin: z.array(z.enum(['BUSINESS', 'PREMIUM_BUSINESS', 'PREMIUM_ECONOMY', 'ECONOMY'])),
  date_window: DateWindowSchema,
  max_miles_per_pax: MilesMapSchema,
});

const TripConstraintsSchema = z.object({
  min_trip_days: z.number().int().positive(),
  max_trip_days: z.number().int().positive(),
  require_both_legs_in_alert: z.boolean(),
});

const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM');

export const SearchConfigSchema = z.object({
  search: z.object({
    origins: z.array(z.string().length(3)),
    destinations: z.array(z.string().length(3)),
    pax: z.number().int().positive(),
    outbound: LegSchema,
    inbound: LegSchema,
    trip_constraints: TripConstraintsSchema,
  }),
  priority_rules: z.object({
    RED_alert: z.array(z.string()),
    YELLOW_alert: z.array(z.string()),
    GREEN_alert: z.array(z.string()),
  }),
  dedupe: z.object({
    reset_after_days: z.number().int().positive(),
  }),
  quiet_hours: z.object({
    start: TimeSchema,
    end: TimeSchema,
  }),
});

export type SearchConfig = z.infer<typeof SearchConfigSchema>;
