-- Admin user (single row)
CREATE TABLE IF NOT EXISTS admin (
  id       INTEGER PRIMARY KEY DEFAULT 1,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Instagram accounts
CREATE TABLE IF NOT EXISTS accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  ig_account_id   TEXT NOT NULL,
  ig_access_token TEXT NOT NULL,
  cloudinary_cloud_name TEXT,
  cloudinary_api_key    TEXT,
  cloudinary_api_secret TEXT,
  template        TEXT NOT NULL DEFAULT 'studio',
  reel_template   TEXT NOT NULL DEFAULT 'clean',
  accent_color    TEXT NOT NULL DEFAULT '#C94040',
  tone            TEXT NOT NULL DEFAULT 'professional',
  content_type    TEXT NOT NULL DEFAULT 'both',
  schedule_cron   TEXT DEFAULT '0 7 * * *',
  slide_count     INTEGER DEFAULT 7,
  scene_count     INTEGER DEFAULT 7,
  backup_topics   TEXT,
  rss_hackernews  INTEGER DEFAULT 1,
  rss_devto       INTEGER DEFAULT 1,
  max_budget_usd  REAL DEFAULT 5.0,
  timeout_minutes INTEGER DEFAULT 15,
  retry_on_failure INTEGER DEFAULT 1,
  upload_after_gen INTEGER DEFAULT 1,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Generation jobs
CREATE TABLE IF NOT EXISTS jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  topic       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT NOT NULL DEFAULT 'schedule',
  output_dir  TEXT,
  error_msg   TEXT,
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Topic history (per account dedup)
CREATE TABLE IF NOT EXISTS topic_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  topic       TEXT NOT NULL,
  job_id      INTEGER REFERENCES jobs(id),
  used_at     TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_account ON jobs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_topics_account ON topic_history(account_id, type);
