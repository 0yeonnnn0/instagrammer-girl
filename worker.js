'use strict';

require('dotenv').config();

const db = require('./lib/db');
const scheduler = require('./lib/scheduler');

function log(message) {
  console.log(`[worker] ${message}`);
}

function listActiveAccounts() {
  return db.prepare(
    'SELECT id, name, schedule_cron, content_type FROM accounts WHERE is_active = 1 ORDER BY id'
  ).all();
}

function start() {
  const accounts = listActiveAccounts();
  log(`Starting automation worker with ${accounts.length} active account(s)`);
  for (const account of accounts) {
    log(`Account ${account.id} (${account.name}) scheduled: ${account.schedule_cron} [${account.content_type}]`);
  }

  scheduler.initAll();
  log('Scheduler initialized');
}

function shutdown(signal) {
  log(`Received ${signal}, stopping worker`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
