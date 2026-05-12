CREATE TABLE IF NOT EXISTS seen_alerts (
  key          TEXT    PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS detected_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT    NOT NULL,
  level      TEXT    NOT NULL,
  route      TEXT    NOT NULL,
  data       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
