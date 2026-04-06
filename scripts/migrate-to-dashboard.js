'use strict';

/**
 * One-time migration: existing .env + config.json + topic-history.json → SQLite
 * Usage: node scripts/migrate-to-dashboard.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Init DB (runs migrations)
const db = require('../lib/db');
const { encrypt } = require('../lib/crypto');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const HISTORY_PATH = path.join(__dirname, 'topic-history.json');

console.log('=== Migration: Existing data → Dashboard SQLite ===\n');

// 1. Ensure admin
const existingAdmin = db.prepare('SELECT id FROM admin WHERE id = 1').get();
if (!existingAdmin) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admin (id, username, password) VALUES (1, ?, ?)').run(username, hash);
  console.log(`[1/3] Admin created: ${username}`);
} else {
  console.log('[1/3] Admin already exists, skipping');
}

// 2. Create first account from .env + config.json
const existingAccount = db.prepare('SELECT id FROM accounts LIMIT 1').get();
if (!existingAccount) {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const auto = config.automation || {};

  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!igToken || !igAccountId) {
    console.log('[2/3] WARNING: No Instagram credentials in .env, skipping account creation');
  } else {
    const backupTopics = (auto.backup_topics || []).join('\n');

    const result = db.prepare(`
      INSERT INTO accounts (name, ig_account_id, ig_access_token,
        cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret,
        template, reel_template, accent_color, tone, content_type,
        schedule_cron, slide_count, backup_topics,
        rss_hackernews, rss_devto, max_budget_usd, timeout_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      config.defaults.account_name || 'dev.daaram',
      igAccountId,
      encrypt(igToken),
      process.env.CLOUDINARY_CLOUD_NAME || null,
      process.env.CLOUDINARY_API_KEY || null,
      process.env.CLOUDINARY_API_SECRET ? encrypt(process.env.CLOUDINARY_API_SECRET) : null,
      auto.template || config.defaults.template || 'studio',
      config.reel_defaults?.template || 'clean',
      config.defaults.accent_color || '#C94040',
      auto.tone || 'professional',
      'both',
      `${auto.schedule_minute || 0} ${auto.schedule_hour || 7} * * *`,
      config.defaults.slide_count || 7,
      backupTopics,
      auto.rss_feeds?.hackernews !== false ? 1 : 0,
      auto.rss_feeds?.devto !== false ? 1 : 0,
      auto.max_budget_per_run || 5.0,
      auto.timeout_minutes || 15
    );
    console.log(`[2/3] Account created: ${config.defaults.account_name} (ID: ${result.lastInsertRowid})`);

    // 3. Migrate topic history
    if (fs.existsSync(HISTORY_PATH)) {
      const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
      const accountId = result.lastInsertRowid;
      let migrated = 0;

      const insertJob = db.prepare(`
        INSERT INTO jobs (account_id, type, topic, status, trigger_type, output_dir, created_at, finished_at)
        VALUES (?, ?, ?, ?, 'schedule', ?, ?, ?)
      `);
      const insertTopic = db.prepare(`
        INSERT INTO topic_history (account_id, type, topic, job_id, used_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const entry of history.history) {
        const type = entry.type || 'card';
        const jobResult = insertJob.run(
          accountId, type, entry.topic, entry.status || 'success',
          entry.output || null, entry.date, entry.date
        );
        insertTopic.run(accountId, type, entry.topic, jobResult.lastInsertRowid, entry.date);
        migrated++;
      }
      console.log(`[3/3] Migrated ${migrated} topic history entries`);
    } else {
      console.log('[3/3] No topic-history.json found, skipping');
    }
  }
} else {
  console.log('[2/3] Account already exists, skipping');
  console.log('[3/3] Skipping topic history (account exists)');
}

console.log('\n=== Migration complete! ===');
console.log(`Database: ${path.join(ROOT, 'data', 'dashboard.db')}`);
console.log('Start server: npm start');
