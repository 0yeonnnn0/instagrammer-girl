'use strict';

const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (request, reply) => {
    const today = new Date().toISOString().slice(0, 10);

    const totalAccounts = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get().cnt;
    const todayJobs = db.prepare('SELECT COUNT(*) as cnt FROM jobs WHERE date(created_at) = ?').get(today).cnt;
    const totalJobs = db.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status IN ('success','failed')").get().cnt;
    const successJobs = db.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'success'").get().cnt;
    const successRate = totalJobs > 0 ? Math.round((successJobs / totalJobs) * 100) : 0;

    const accounts = db.prepare(`
      SELECT a.*,
        (SELECT json_object('status', j.status, 'topic', j.topic)
         FROM jobs j WHERE j.account_id = a.id ORDER BY j.created_at DESC LIMIT 1) as last_job_json
      FROM accounts a ORDER BY a.created_at DESC
    `).all().map(a => {
      a.lastJob = a.last_job_json ? JSON.parse(a.last_job_json) : null;
      delete a.last_job_json;
      return a;
    });

    const recentJobs = db.prepare(`
      SELECT j.*, a.name as account_name
      FROM jobs j JOIN accounts a ON j.account_id = a.id
      ORDER BY j.created_at DESC LIMIT 10
    `).all();

    return reply.view('dashboard.ejs', {
      stats: { totalAccounts, todayJobs, successRate },
      accounts,
      recentJobs,
    });
  });
};
