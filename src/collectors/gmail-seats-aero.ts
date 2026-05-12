import { google } from 'googleapis';
import { err, ok } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { AwardAlert, AppError } from '../types.js';
import { parseSeatsAeroEmail } from '../parsers/seats-aero-email.js';

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail: string;
  label: string;
}

export async function fetchGmailAlerts(
  creds: GmailCredentials,
  afterTimestamp?: Date
): Promise<Result<AwardAlert[], AppError>> {
  try {
    const auth = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
    auth.setCredentials({ refresh_token: creds.refreshToken });

    const gmail = google.gmail({ version: 'v1', auth });

    const parts = [`from:alerts@seats.aero`, `label:${creds.label}`];
    if (afterTimestamp) {
      const epoch = Math.floor(afterTimestamp.getTime() / 1000);
      parts.push(`after:${String(epoch)}`);
    }

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: parts.join(' '),
      maxResults: 50,
    });

    const messages = listRes.data.messages ?? [];
    if (messages.length === 0) {
      return ok([]);
    }

    const alerts: AwardAlert[] = [];
    const errors: string[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;

      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'raw',
      });

      const rawBase64 = msgRes.data.raw;
      if (!rawBase64) continue;

      const raw = Buffer.from(rawBase64, 'base64url');
      const parseResult = await parseSeatsAeroEmail(raw, msg.id);

      if (parseResult.isOk()) {
        alerts.push(parseResult.value);
      } else {
        errors.push(`${msg.id}: ${parseResult.error.message}`);
      }
    }

    if (alerts.length === 0 && errors.length > 0) {
      return err({ code: 'GMAIL_PARSE_ALL_FAILED', message: errors.join('; ') });
    }

    return ok(alerts);
  } catch (e) {
    return err({
      code: 'GMAIL_FETCH_ERROR',
      message: `Failed to fetch Gmail alerts: ${String(e)}`,
      cause: e,
    });
  }
}
