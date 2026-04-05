'use strict';

const { verifyPassword, getAdmin } = require('../lib/auth');

module.exports = async function (fastify) {
  fastify.get('/login', async (request, reply) => {
    if (request.session.authenticated) {
      return reply.redirect('/');
    }
    return reply.view('login.ejs', {});
  });

  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body || {};
    const admin = getAdmin();

    if (admin && admin.username === username && verifyPassword(password)) {
      request.session.authenticated = true;
      request.session.username = username;
      return reply.redirect('/');
    }

    return reply.view('login.ejs', { error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
  });

  fastify.post('/logout', async (request, reply) => {
    request.session.destroy();
    return reply.redirect('/login');
  });
};
