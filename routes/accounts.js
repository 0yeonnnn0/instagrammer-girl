'use strict';

const { requireAuth } = require('../lib/auth');
const { encrypt, decrypt } = require('../lib/crypto');
const db = require('../lib/db');
const scheduler = require('../lib/scheduler');

function normalizeTopicMode(value) {
  return value === 'series' ? 'series' : 'backup';
}

function normalizeInt(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth);

  // List
  fastify.get('/accounts', async (request, reply) => {
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
    return reply.view('accounts/index.ejs', { accounts });
  });

  // New form
  fastify.get('/accounts/new', async (request, reply) => {
    return reply.view('accounts/form.ejs', { account: null, error: null });
  });

  // Create
  fastify.post('/accounts', async (request, reply) => {
    const b = request.body;
    try {
      const result = db.prepare(`
        INSERT INTO accounts (name, ig_account_id, ig_access_token,
          cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret,
          template, reel_template, accent_color, tone, content_type,
          schedule_cron, slide_count, scene_count, backup_topics,
          rss_hackernews, rss_devto, max_budget_usd, timeout_minutes,
          card_prompt, reel_prompt,
          card_strategy, reel_strategy, card_strategy_prompt, reel_strategy_prompt,
          card_topic_mode, card_series_framework, card_series_total_parts, card_series_current_part, card_series_loop,
          ai_provider, ai_model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        b.name, b.ig_account_id, encrypt(b.ig_access_token),
        b.cloudinary_cloud_name || null, b.cloudinary_api_key || null, b.cloudinary_api_secret ? encrypt(b.cloudinary_api_secret) : null,
        b.template || 'studio', b.reel_template || 'clean', b.accent_color || '#C94040',
        b.tone || 'professional', b.content_type || 'both',
        b.schedule_cron || '0 7 * * *',
        parseInt(b.slide_count) || 7, parseInt(b.scene_count) || 7,
        b.backup_topics || null,
        b.rss_hackernews ? 1 : 0, b.rss_devto ? 1 : 0,
        parseFloat(b.max_budget_usd) || 5.0, parseInt(b.timeout_minutes) || 15,
        b.card_prompt || null, b.reel_prompt || null,
        b.card_strategy || 'tutorial', b.reel_strategy || 'news',
        b.card_strategy_prompt || null, b.reel_strategy_prompt || null,
        normalizeTopicMode(b.card_topic_mode),
        (b.card_series_framework || 'React').trim(),
        normalizeInt(b.card_series_total_parts, 10, 2, 100),
        normalizeInt(b.card_series_current_part, 1, 1, 100),
        b.card_series_loop ? 1 : 0,
        b.ai_provider || 'claude', b.ai_model || null
      );
      scheduler.scheduleAccount(result.lastInsertRowid);
      return reply.redirect(`/accounts/${result.lastInsertRowid}`);
    } catch (err) {
      return reply.view('accounts/form.ejs', { account: b, error: err.message });
    }
  });

  // Show
  fastify.get('/accounts/:id', async (request, reply) => {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(request.params.id);
    if (!account) return reply.code(404).send('Not found');

    account.ig_access_token_preview = decrypt(account.ig_access_token).substring(0, 20) + '...';

    const jobs = db.prepare(`
      SELECT * FROM jobs WHERE account_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(request.params.id);

    const topics = db.prepare(`
      SELECT * FROM topic_history WHERE account_id = ? ORDER BY used_at DESC LIMIT 30
    `).all(request.params.id);

    return reply.view('accounts/show.ejs', { account, jobs, topics, flash: null });
  });

  // Edit form
  fastify.get('/accounts/:id/edit', async (request, reply) => {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(request.params.id);
    if (!account) return reply.code(404).send('Not found');
    // Parse cron to KST hour/minute for UI
    const cronParts = (account.schedule_cron || '0 7 * * *').split(' ');
    const utcHour = parseInt(cronParts[1]) || 0;
    const utcMinute = parseInt(cronParts[0]) || 0;
    account.schedule_hour = (utcHour + 9) % 24; // UTC → KST
    account.schedule_minute = utcMinute;
    return reply.view('accounts/form.ejs', { account, error: null });
  });

  // Update
  fastify.post('/accounts/:id', async (request, reply) => {
    const b = request.body;
    const id = request.params.id;
    try {
      // Only update token if a new one is provided
      const tokenUpdate = b.ig_access_token
        ? ', ig_access_token = ?'
        : '';
      const secretUpdate = b.cloudinary_api_secret
        ? ', cloudinary_api_secret = ?'
        : '';

      let sql = `UPDATE accounts SET
        name = ?, ig_account_id = ?,
        cloudinary_cloud_name = ?, cloudinary_api_key = ?,
        template = ?, reel_template = ?, accent_color = ?,
        tone = ?, content_type = ?, schedule_cron = ?,
        slide_count = ?, scene_count = ?, backup_topics = ?,
        rss_hackernews = ?, rss_devto = ?,
        max_budget_usd = ?, timeout_minutes = ?,
        card_prompt = ?, reel_prompt = ?,
        card_strategy = ?, reel_strategy = ?,
        card_strategy_prompt = ?, reel_strategy_prompt = ?,
        card_topic_mode = ?, card_series_framework = ?, card_series_total_parts = ?, card_series_current_part = ?, card_series_loop = ?,
        ai_provider = ?, ai_model = ?,
        updated_at = datetime('now')
        ${tokenUpdate}${secretUpdate}
        WHERE id = ?`;

      const params = [
        b.name, b.ig_account_id,
        b.cloudinary_cloud_name || null, b.cloudinary_api_key || null,
        b.template || 'studio', b.reel_template || 'clean', b.accent_color || '#C94040',
        b.tone || 'professional', b.content_type || 'both',
        b.schedule_cron || '0 7 * * *',
        parseInt(b.slide_count) || 7, parseInt(b.scene_count) || 7,
        b.backup_topics || null,
        b.rss_hackernews ? 1 : 0, b.rss_devto ? 1 : 0,
        parseFloat(b.max_budget_usd) || 5.0, parseInt(b.timeout_minutes) || 15,
        b.card_prompt || null, b.reel_prompt || null,
        b.card_strategy || 'tutorial', b.reel_strategy || 'news',
        b.card_strategy_prompt || null, b.reel_strategy_prompt || null,
        normalizeTopicMode(b.card_topic_mode),
        (b.card_series_framework || 'React').trim(),
        normalizeInt(b.card_series_total_parts, 10, 2, 100),
        normalizeInt(b.card_series_current_part, 1, 1, 100),
        b.card_series_loop ? 1 : 0,
        b.ai_provider || 'claude', b.ai_model || null,
      ];

      if (b.ig_access_token) params.push(encrypt(b.ig_access_token));
      if (b.cloudinary_api_secret) params.push(encrypt(b.cloudinary_api_secret));
      params.push(id);

      db.prepare(sql).run(...params);
      scheduler.scheduleAccount(id);
      return reply.redirect(`/accounts/${id}`);
    } catch (err) {
      return reply.view('accounts/form.ejs', { account: { ...b, id }, error: err.message });
    }
  });

  // Toggle active
  fastify.post('/accounts/:id/toggle', async (request, reply) => {
    const id = request.params.id;
    db.prepare("UPDATE accounts SET is_active = NOT is_active, updated_at = datetime('now') WHERE id = ?").run(id);
    const account = db.prepare('SELECT is_active FROM accounts WHERE id = ?').get(id);
    if (account.is_active) {
      scheduler.scheduleAccount(id);
    } else {
      scheduler.stopAccount(id);
    }
    return reply.redirect(`/accounts/${id}`);
  });

  // Delete
  fastify.post('/accounts/:id/delete', async (request, reply) => {
    scheduler.stopAccount(request.params.id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(request.params.id);
    return reply.redirect('/accounts');
  });

  // Manual generate trigger
  fastify.post('/accounts/:id/generate', async (request, reply) => {
    const id = request.params.id;
    const type = request.body.type || 'both';
    const { runJob } = require('../lib/job-runner');
    runJob(parseInt(id), type, 'manual');
    return reply.redirect(`/accounts/${id}`);
  });
};
