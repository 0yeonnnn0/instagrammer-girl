'use strict';

require('dotenv').config();

const path = require('path');
const fastify = require('fastify')({ logger: true });

// Plugins
fastify.register(require('@fastify/formbody'));
fastify.register(require('@fastify/cookie'));
fastify.register(require('@fastify/session'), {
  secret: process.env.SESSION_SECRET || 'a-very-long-secret-key-change-me-in-prod-32chars!!',
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  saveUninitialized: false,
});
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, 'views'),
  defaultContext: { path: '' },
});
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'output'),
  prefix: '/output/',
  decorateReply: false,
});
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
  decorateReply: false,
});

// Init DB & admin
const { ensureAdmin } = require('./lib/auth');
ensureAdmin();

// JSON body parsing (for API routes)
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try { done(null, JSON.parse(body)); } catch (err) { done(err); }
});

// Routes
fastify.register(require('./routes/auth'));
fastify.register(require('./routes/dashboard'));
fastify.register(require('./routes/accounts'));
fastify.register(require('./routes/jobs'));
fastify.register(require('./routes/api'));

// Start scheduler
const scheduler = require('./lib/scheduler');
const runSchedulerInServer = process.env.SERVER_RUN_SCHEDULER === '1';
if (runSchedulerInServer) {
  scheduler.initAll();
  console.log('[server] Scheduler enabled in server process (SERVER_RUN_SCHEDULER=1)');
} else {
  console.log('[server] Scheduler disabled in server process; use worker.js for automation');
}

// Start
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

fastify.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`[server] Dashboard running at http://${HOST}:${PORT}`);
});
