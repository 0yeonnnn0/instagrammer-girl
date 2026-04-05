'use strict';

const bcrypt = require('bcryptjs');
const db = require('./db');

// Ensure admin exists on startup
function ensureAdmin() {
  const admin = db.prepare('SELECT id FROM admin WHERE id = 1').get();
  if (!admin) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admin (id, username, password) VALUES (1, ?, ?)').run(username, hash);
    console.log(`[auth] Admin created: ${username}`);
  }
}

function verifyPassword(password) {
  const admin = db.prepare('SELECT password FROM admin WHERE id = 1').get();
  if (!admin) return false;
  return bcrypt.compareSync(password, admin.password);
}

function getAdmin() {
  return db.prepare('SELECT id, username, created_at FROM admin WHERE id = 1').get();
}

// Fastify auth hook
function requireAuth(request, reply, done) {
  if (!request.session || !request.session.authenticated) {
    reply.redirect('/login');
    return;
  }
  done();
}

module.exports = { ensureAdmin, verifyPassword, getAdmin, requireAuth };
