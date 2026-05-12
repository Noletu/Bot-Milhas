import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { load } from 'js-yaml';
import { randomUUID } from 'crypto';
import { SearchConfigSchema } from '../config/search.schema.js';
import { loadEnv } from './env.js';
import { createLogger } from './logger.js';
import { openDb } from './storage/db.js';
import { hasSeenAlert, markAlertSeen, insertEvent } from './storage/repository.js';
import { fetchAllFeeds } from './collectors/rss.js';
import { fetchAwardSeats } from './collectors/seats-aero.js';
import { detectPromos } from './parsers/promo-detector.js';
import { crossReference } from './engine/cross-reference.js';
import { shouldSendAlert } from './engine/dedupe.js';
import { sendAlerts } from './notifier/telegram.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const runId = randomUUID().slice(0, 8);
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, runId);

  logger.info('Award-bot starting');

  const rawYaml = readFileSync(join(__dirname, '../config/search.yaml'), 'utf-8');
  const config = SearchConfigSchema.parse(load(rawYaml));
  logger.debug(
    { origins: config.search.origins, destinations: config.search.destinations },
    'Config loaded'
  );

  const db = openDb(env.DB_PATH);
  logger.info({ dbPath: env.DB_PATH }, 'Database ready');

  // Collect RSS feeds
  const rssResult = await fetchAllFeeds();
  if (rssResult.isErr()) {
    logger.error({ err: rssResult.error }, 'RSS collection failed');
  }
  const rssItems = rssResult.isOk() ? rssResult.value : [];
  logger.info({ itemCount: rssItems.length }, 'RSS items collected');

  // Parse promotions
  const promos = detectPromos(rssItems);
  logger.info({ promoCount: promos.length }, 'LATAM promos detected');

  // Collect award inventory from Seats.aero
  const seatsResult = await fetchAwardSeats(env.SEATS_AERO_API_KEY, config);
  if (seatsResult.isErr()) {
    logger.warn({ err: seatsResult.error }, 'Seats.aero collection partial or failed');
  }
  const seats = seatsResult.isOk() ? seatsResult.value : [];
  logger.info({ seatCount: seats.length }, 'Award seats collected');

  // Cross-reference
  const allAlerts = crossReference(promos, seats);
  logger.info({ alertCount: allAlerts.length }, 'Alerts generated');

  // Dedupe
  const windowDays = config.dedupe.reset_after_days;
  const newAlerts = allAlerts.filter((alert) =>
    shouldSendAlert(alert.dedupeKey, (key) => hasSeenAlert(db, key, windowDays))
  );
  logger.info(
    { newCount: newAlerts.length, skipped: allAlerts.length - newAlerts.length },
    'After dedupe'
  );

  // Persist all detected events (even deduped ones)
  for (const alert of allAlerts) {
    insertEvent(db, alert);
  }

  // Send new alerts via Telegram
  if (newAlerts.length > 0) {
    const sendResult = await sendAlerts(
      newAlerts,
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_CHAT_ID,
      config,
      logger
    );
    if (sendResult.isOk()) {
      const sentCount = sendResult.value;
      logger.info({ sentCount }, 'Alerts sent to Telegram');
      // Mark sent alerts as seen
      for (const alert of newAlerts) {
        markAlertSeen(db, alert.dedupeKey);
      }
    } else {
      logger.error({ err: sendResult.error }, 'Failed to send alerts');
    }
  } else {
    logger.info('No new alerts to send');
  }

  logger.info({ runId }, 'Award-bot run complete');
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
