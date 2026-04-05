'use strict';

const cron = require('node-cron');
const db = require('./db');
const { runJob } = require('./job-runner');

const tasks = new Map();

function scheduleAccount(accountId) {
  stopAccount(accountId);
  const account = db.prepare('SELECT id, schedule_cron, content_type, is_active FROM accounts WHERE id = ?').get(accountId);
  if (!account || !account.is_active) return;

  if (!cron.validate(account.schedule_cron)) {
    console.error(`[scheduler] Invalid cron for account ${accountId}: ${account.schedule_cron}`);
    return;
  }

  const task = cron.schedule(account.schedule_cron, () => {
    console.log(`[scheduler] Triggered account ${accountId} (${account.content_type})`);
    runJob(accountId, account.content_type, 'schedule');
  });

  tasks.set(accountId, task);
  console.log(`[scheduler] Account ${accountId} scheduled: ${account.schedule_cron}`);
}

function stopAccount(accountId) {
  const task = tasks.get(accountId);
  if (task) {
    task.stop();
    tasks.delete(accountId);
    console.log(`[scheduler] Account ${accountId} unscheduled`);
  }
}

function initAll() {
  const accounts = db.prepare('SELECT id FROM accounts WHERE is_active = 1').all();
  for (const account of accounts) {
    scheduleAccount(account.id);
  }
  console.log(`[scheduler] Initialized ${accounts.length} account(s)`);
}

module.exports = { scheduleAccount, stopAccount, initAll };
