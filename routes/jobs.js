'use strict';

const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth);

  // Job detail
  fastify.get('/jobs/:id', async (request, reply) => {
    const job = db.prepare(`
      SELECT j.*, a.name as account_name
      FROM jobs j JOIN accounts a ON j.account_id = a.id
      WHERE j.id = ?
    `).get(request.params.id);

    if (!job) return reply.code(404).send('Not found');

    // Find output files
    let slides = [];
    let caption = '';
    let hasVideo = false;

    if (job.output_dir) {
      const dir = path.isAbsolute(job.output_dir) ? job.output_dir : path.join(OUTPUT_DIR, job.output_dir);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        slides = files
          .filter(f => /^(slide|scene)_\d+\.png$/.test(f))
          .sort()
          .map(f => {
            const relDir = path.relative(OUTPUT_DIR, dir);
            return `/output/${relDir}/${f}`;
          });
        hasVideo = files.includes('reel.mp4');
        const textPath = path.join(dir, 'text.md');
        if (fs.existsSync(textPath)) caption = fs.readFileSync(textPath, 'utf8');
      }
    }

    // Parse logs from error_msg field
    const logs = job.error_msg || '';

    return reply.view('jobs/show.ejs', { job, slides, caption, hasVideo, logs });
  });
};
