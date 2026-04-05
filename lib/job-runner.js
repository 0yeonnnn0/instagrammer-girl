'use strict';

const { execSync } = require('child_process');
const path = require('path');
const db = require('./db');
const { decrypt } = require('./crypto');
const { collectFeeds } = require('./feeds');

const ROOT = path.join(__dirname, '..');
let running = false;
const queue = [];

function log(jobId, msg) {
  const ts = new Date().toISOString();
  console.log(`[job:${jobId}] ${msg}`);
  // Append to job error_msg as log (reuse field for logs)
  const job = db.prepare('SELECT error_msg FROM jobs WHERE id = ?').get(jobId);
  const existing = job && job.error_msg ? job.error_msg : '';
  db.prepare('UPDATE jobs SET error_msg = ? WHERE id = ?').run(
    existing + `[${ts}] ${msg}\n`, jobId
  );
}

async function selectReelTopic(account, jobId) {
  const articles = await collectFeeds(account);
  if (!articles) return null;

  const usedTopics = db.prepare(
    'SELECT topic FROM topic_history WHERE account_id = ? AND type = "reel"'
  ).all(account.id).map(t => t.topic).join(', ');

  const articleList = articles.map((a, i) => `${i + 1}. [${a.source}] ${a.title}`).join('\n');

  const prompt = `아래는 오늘의 개발/기술 뉴스 목록입니다.
인스타그램 릴스로 만들기 가장 좋은 뉴스 주제 1개를 선정해주세요.
이미 사용한 주제 (제외): ${usedTopics || '없음'}

${articleList}

한국어로 릴스 제목만 한 줄로 출력해주세요.`;

  try {
    const result = execSync(
      `claude -p --model sonnet ${JSON.stringify(prompt)}`,
      { cwd: ROOT, encoding: 'utf8', timeout: 180_000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim().split('\n').pop().trim();
  } catch (err) {
    log(jobId, `Topic selection failed: ${err.message}`);
    return null;
  }
}

function selectCardTopic(account) {
  const backupRaw = account.backup_topics || '';
  const backups = backupRaw.split('\n').map(s => s.trim()).filter(Boolean);
  if (backups.length === 0) backups.push('개발자 생산성 팁', 'Git 활용법', 'API 설계 가이드');

  const used = db.prepare(
    'SELECT topic FROM topic_history WHERE account_id = ? AND type = "card"'
  ).all(account.id).map(t => t.topic.toLowerCase().replace(/\s+/g, ''));

  for (const topic of backups) {
    if (!used.includes(topic.toLowerCase().replace(/\s+/g, ''))) return topic;
  }
  return backups[0];
}

const DEFAULT_STRATEGIES = {
  card: {
    tutorial: '개발자를 위한 실용적인 튜토리얼/팁/가이드 형태로 만들어줘. 저장·공유를 유도하는 교육 콘텐츠로 구성해.',
    listicle: 'TOP N, 모음, 체크리스트 형태로 만들어줘. 한눈에 스캔할 수 있는 리스트형 콘텐츠로.',
    comparison: 'A vs B 비교·분석 형태로 만들어줘. 양쪽의 장단점을 명확히 대비시켜.',
    news: '최신 뉴스/트렌드를 정리하는 형태로 만들어줘. 핵심 포인트를 빠르게 전달해.',
    custom: '',
  },
  reel: {
    news: '오늘의 최신 뉴스/속보/트렌드를 다뤄줘. 스크롤을 멈추게 하는 충격적 훅으로 시작하고, 신규 팔로워 유입을 극대화해.',
    tips: '빠른 꿀팁/노하우를 전달해줘. "이것만 알면 된다" 식의 실용적 콘텐츠로.',
    controversy: '논란/스캔들/충격적 사건을 다뤄줘. 도발적 훅 + 팩트 중심으로 구성해.',
    comparison: '비교/랭킹/순위 콘텐츠로 만들어줘. "1위는?" 식의 호기심 유발 구조로.',
    custom: '',
  },
};

function buildPrompt(account, type, topic) {
  // 1. Base prompt (fixed, not editable)
  const base = type === 'reel'
    ? `"${topic}" 주제로 릴스 만들어줘. 톤: ${account.tone}, 릴스 템플릿: ${account.reel_template}, 악센트: ${account.accent_color}, 계정: ${account.name}, 업로드까지 해줘.`
    : `"${topic}" 주제로 카드뉴스 만들어줘. 톤: ${account.tone}, 템플릿: ${account.template}, 악센트: ${account.accent_color}, 계정: ${account.name}, 업로드까지 해줘.`;

  // 2. Strategy prompt (editable, with defaults)
  const strategy = type === 'reel' ? account.reel_strategy : account.card_strategy;
  const strategyPromptCustom = type === 'reel' ? account.reel_strategy_prompt : account.card_strategy_prompt;
  const strategyPrompt = (strategyPromptCustom && strategyPromptCustom.trim())
    ? strategyPromptCustom.trim()
    : (DEFAULT_STRATEGIES[type]?.[strategy] || '');

  // 3. Additional instructions (free text)
  const custom = type === 'reel' ? account.reel_prompt : account.card_prompt;

  const parts = [base];
  if (strategyPrompt) parts.push(strategyPrompt);
  if (custom && custom.trim()) parts.push(custom.trim());

  return parts.join('\n\n');
}

function generateContent(account, type, topic, jobId) {
  const prompt = buildPrompt(account, type, topic);

  const env = {
    ...process.env,
    INSTAGRAM_ACCESS_TOKEN: decrypt(account.ig_access_token),
    INSTAGRAM_ACCOUNT_ID: account.ig_account_id,
  };

  if (account.cloudinary_cloud_name) env.CLOUDINARY_CLOUD_NAME = account.cloudinary_cloud_name;
  if (account.cloudinary_api_key) env.CLOUDINARY_API_KEY = account.cloudinary_api_key;
  if (account.cloudinary_api_secret) env.CLOUDINARY_API_SECRET = decrypt(account.cloudinary_api_secret);

  try {
    execSync(
      `claude -p --dangerously-skip-permissions --max-budget-usd ${account.max_budget_usd} ${JSON.stringify(prompt)}`,
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: account.timeout_minutes * 60 * 1000,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    return true;
  } catch (err) {
    log(jobId, `Generation failed: ${err.message.substring(0, 500)}`);
    return false;
  }
}

async function executeJob(accountId, type, triggerType) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return;

  const types = type === 'both' ? ['reel', 'card'] : [type];

  for (const t of types) {
    let topic;
    if (t === 'reel') {
      const tempJob = db.prepare(
        'INSERT INTO jobs (account_id, type, topic, status, trigger_type, started_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
      ).run(accountId, t, 'selecting...', 'running', triggerType);
      const jobId = tempJob.lastInsertRowid;

      topic = await selectReelTopic(account, jobId);
      if (!topic) {
        db.prepare('UPDATE jobs SET topic = ?, status = ?, error_msg = COALESCE(error_msg, "") || ?, finished_at = datetime("now") WHERE id = ?')
          .run('(no topic)', 'failed', 'No reel topic found\n', jobId);
        continue;
      }
      db.prepare('UPDATE jobs SET topic = ? WHERE id = ?').run(topic, jobId);

      log(jobId, `Generating reel: ${topic}`);
      const success = generateContent(account, t, topic, jobId);
      db.prepare('UPDATE jobs SET status = ?, finished_at = datetime("now") WHERE id = ?')
        .run(success ? 'success' : 'failed', jobId);

      if (success) {
        db.prepare('INSERT INTO topic_history (account_id, type, topic, job_id) VALUES (?, ?, ?, ?)')
          .run(accountId, t, topic, jobId);
      }
    } else {
      topic = selectCardTopic(account);
      const tempJob = db.prepare(
        'INSERT INTO jobs (account_id, type, topic, status, trigger_type, started_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
      ).run(accountId, t, topic, 'running', triggerType);
      const jobId = tempJob.lastInsertRowid;

      log(jobId, `Generating card: ${topic}`);
      const success = generateContent(account, t, topic, jobId);
      db.prepare('UPDATE jobs SET status = ?, finished_at = datetime("now") WHERE id = ?')
        .run(success ? 'success' : 'failed', jobId);

      if (success) {
        db.prepare('INSERT INTO topic_history (account_id, type, topic, job_id) VALUES (?, ?, ?, ?)')
          .run(accountId, t, topic, jobId);
      }
    }
  }
}

async function processQueue() {
  if (running || queue.length === 0) return;
  running = true;
  const { accountId, type, triggerType } = queue.shift();
  try {
    await executeJob(accountId, type, triggerType);
  } catch (err) {
    console.error(`[job-runner] Unhandled error for account ${accountId}:`, err.message);
  }
  running = false;
  processQueue();
}

function runJob(accountId, type = 'both', triggerType = 'manual') {
  queue.push({ accountId, type, triggerType });
  processQueue();
}

module.exports = { runJob };
