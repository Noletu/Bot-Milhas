/**
 * Run once locally to obtain a Gmail OAuth2 refresh token.
 *
 * Usage:
 *   1. Create a Google Cloud project, enable the Gmail API, and create
 *      OAuth 2.0 credentials (Desktop app type).
 *   2. Copy the client_id and client_secret from the credentials JSON.
 *   3. Export them: GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=...
 *   4. Run: npm run oauth:bootstrap
 *   5. Open the printed URL in your browser and grant access.
 *   6. Copy the refresh_token printed to the console into .env (GMAIL_REFRESH_TOKEN).
 */

import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { google } from 'googleapis';

const CLIENT_ID = process.env['GMAIL_CLIENT_ID'];
const CLIENT_SECRET = process.env['GMAIL_CLIENT_SECRET'];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const PORT = 3000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  process.stderr.write('Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set.\n');
  process.exit(1);
}

const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = auth.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

process.stdout.write('\n=== Gmail OAuth2 Bootstrap ===\n');
process.stdout.write('Open this URL in your browser to authorise:\n\n');
process.stdout.write(`  ${authUrl}\n\n`);
process.stdout.write('Waiting for callback on http://localhost:3000 ...\n\n');

async function handleCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('Missing authorization code.');
    return;
  }

  try {
    const { tokens } = await auth.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Authorization successful! You can close this tab.\n');

    process.stdout.write('=== Token received ===\n');
    process.stdout.write(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token ?? '<empty>'}\n\n`);
    process.stdout.write('Add this to your .env file and GitHub Actions secrets.\n');
  } catch (e) {
    res.writeHead(500);
    res.end(`Error exchanging code: ${String(e)}`);
    process.stderr.write(`Token exchange failed: ${String(e)}\n`);
  } finally {
    server.close();
  }
}

const server = createServer((req, res) => {
  void handleCallback(req, res);
});

server.listen(PORT);
