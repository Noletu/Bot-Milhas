import { Bot } from 'grammy';
import { getHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { Alert, AppError } from '../types.js';
import type { SearchConfig } from '../../config/search.schema.js';
import { formatAlert } from './format.js';
import type { Logger } from '../logger.js';

const BRT_TZ = 'America/Sao_Paulo';

export async function sendAlerts(
  alerts: Alert[],
  botToken: string,
  chatId: string,
  config: SearchConfig,
  logger: Logger
): Promise<Result<number, AppError>> {
  const bot = new Bot(botToken);
  let sentCount = 0;

  for (const alert of alerts) {
    if (!shouldSendNow(alert, config)) {
      logger.info({ level: alert.level, route: alert.route }, 'Alert suppressed by quiet hours');
      continue;
    }

    const result = await sendSingle(bot, chatId, alert);
    if (result.isOk()) {
      sentCount++;
    } else {
      logger.error({ err: result.error, route: alert.route }, 'Failed to send Telegram alert');
    }
  }

  return ok(sentCount);
}

async function sendSingle(bot: Bot, chatId: string, alert: Alert): Promise<Result<void, AppError>> {
  try {
    const text = formatAlert(alert);
    await bot.api.sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
    return ok(undefined);
  } catch (e) {
    return err({
      code: 'TELEGRAM_SEND_ERROR',
      message: `Failed to send message: ${String(e)}`,
      cause: e,
    });
  }
}

function shouldSendNow(alert: Alert, config: SearchConfig): boolean {
  if (alert.level === 'RED') return true;

  const now = toZonedTime(new Date(), BRT_TZ);
  const hour = getHours(now);

  const [startHH] = config.quiet_hours.start.split(':').map(Number);
  const [endHH] = config.quiet_hours.end.split(':').map(Number);

  if (startHH === undefined || endHH === undefined) return true;

  if (startHH > endHH) {
    return hour < startHH && hour >= endHH;
  }
  return hour >= endHH && hour < startHH;
}
