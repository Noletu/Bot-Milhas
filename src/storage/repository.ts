import type Database from 'better-sqlite3';
import type { Alert } from '../types.js';

interface SeenAlertRow {
  key: string;
  first_seen_at: number;
  last_seen_at: number;
}

interface DetectedEventRow {
  id: number;
  source: string;
  level: string;
  route: string;
  data: string;
  created_at: number;
}

export function hasSeenAlert(db: Database.Database, key: string, windowDays: number): boolean {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const row = db
    .prepare<
      [string, number],
      SeenAlertRow
    >('SELECT key, first_seen_at, last_seen_at FROM seen_alerts WHERE key = ? AND last_seen_at > ?')
    .get(key, cutoff);
  return row !== undefined;
}

export function markAlertSeen(db: Database.Database, key: string): void {
  const now = Date.now();
  db.prepare<[string, number, number]>(
    `INSERT INTO seen_alerts (key, first_seen_at, last_seen_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET last_seen_at = excluded.last_seen_at`
  ).run(key, now, now);
}

export function insertEvent(db: Database.Database, alert: Alert): void {
  const now = Date.now();
  db.prepare<[string, string, string, string, number]>(
    'INSERT INTO detected_events (source, level, route, data, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(
    alert.promo?.source ?? alert.seat?.source ?? 'unknown',
    alert.level,
    alert.route,
    JSON.stringify(alert),
    now
  );
}

export function getRecentAlerts(db: Database.Database, n: number): DetectedEventRow[] {
  return db
    .prepare<
      [number],
      DetectedEventRow
    >('SELECT * FROM detected_events ORDER BY created_at DESC LIMIT ?')
    .all(n);
}
