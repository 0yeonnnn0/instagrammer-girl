'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Paths ──────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const HISTORY_PATH = path.join(__dirname, 'topic-history.json');
const LOGS_DIR = path.join(ROOT, 'logs');
const OUTPUT_DIR = path.join(ROOT, 'output');

// ── Config ─────────────────────────────────────────────
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const auto = config.automation || {};

// ── CLI Args ───────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const CARD_ONLY = process.argv.includes('--card-only');
const REEL_ONLY = process.argv.includes('--reel-only');

// ── Logger ─────────────────────────────────────────────
const now = new Date();
const logFileName = `daily-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.log`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  ensureDir(LOGS_DIR);
  fs.appendFileSync(path.join(LOGS_DIR, logFileName), line + '\n');
}

function notify(title, message) {
  try {
    execSync(
      `osascript -e 'display notification "${message}" with title "${title}"'`,
      { stdio: 'ignore' }
    );
  } catch {
    // non-critical
  }
}

// ── Topic History ──────────────────────────────────────
function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify({ history: [] }, null, 2));
    return { history: [] };
  }
  return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function isTopicUsed(history, topic) {
  const normalized = topic.toLowerCase().replace(/\s+/g, '');
  return history.history.some(
    (entry) => entry.topic.toLowerCase().replace(/\s+/g, '') === normalized
  );
}

// ── RSS Feeds (for Reel topics — news/trending) ────────
async function fetchHackerNews() {
  log('INFO', 'Fetching Hacker News top stories...');
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await res.json();
    const top30 = ids.slice(0, 30);

    const stories = [];
    for (let i = 0; i < top30.length; i += 10) {
      const batch = top30.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (id) => {
          const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return r.json();
        })
      );
      stories.push(...results);
    }

    log('INFO', `HN: fetched ${stories.length} stories`);
    return stories
      .filter((s) => s && s.title)
      .map((s) => ({
        source: 'hackernews',
        title: s.title,
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        score: s.score || 0,
      }));
  } catch (err) {
    log('WARN', `HN fetch failed: ${err.message}`);
    return [];
  }
}

async function fetchDevTo() {
  log('INFO', 'Fetching dev.to feed...');
  try {
    const res = await fetch('https://dev.to/feed', {
      headers: { Accept: 'application/xml' },
    });
    const xml = await res.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/) || [])[1];
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1];
      const categories = [];
      const catRegex = /<category>(.*?)<\/category>/g;
      let catMatch;
      while ((catMatch = catRegex.exec(block)) !== null) {
        categories.push(catMatch[1]);
      }

      if (title) {
        items.push({
          source: 'devto',
          title: title.trim(),
          url: link || '',
          tags: categories,
        });
      }
    }

    log('INFO', `dev.to: fetched ${items.length} articles`);
    return items;
  } catch (err) {
    log('WARN', `dev.to fetch failed: ${err.message}`);
    return [];
  }
}

async function collectFeeds() {
  const feeds = auto.rss_feeds || { hackernews: true, devto: true };
  const results = [];

  const tasks = [];
  if (feeds.hackernews) tasks.push(fetchHackerNews());
  if (feeds.devto) tasks.push(fetchDevTo());

  const settled = await Promise.allSettled(tasks);
  for (const result of settled) {
    if (result.status === 'fulfilled') results.push(...result.value);
  }

  if (results.length === 0) {
    log('WARN', 'All RSS feeds failed');
    return null;
  }

  log('INFO', `Total collected: ${results.length} articles`);
  return results;
}

// ── Topic Selection ────────────────────────────────────

// Reel topic: from RSS feeds (news/trending)
function selectReelTopicViaClaude(articles, history) {
  const articleList = articles
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}`)
    .join('\n');

  const usedTopics = history.history
    .filter((h) => h.type === 'reel')
    .map((h) => h.topic)
    .join(', ');

  const prompt = `아래는 오늘의 개발/기술 뉴스 목록입니다.
이 중에서 인스타그램 릴스(숏폼 영상)로 만들기 가장 좋은 뉴스 주제 1개를 선정해주세요.

선정 기준:
- 최신 뉴스/속보/트렌드 (상시 콘텐츠 X)
- 한국 개발자들이 관심 가질 만한 주제
- "스크롤 스톱" 훅이 강한 주제 (충격적 숫자, 스캔들, 논란 등)
- 릴스 8씬으로 핵심을 전달할 수 있는 주제

이미 사용한 릴스 주제 (제외): ${usedTopics || '없음'}

글 목록:
${articleList}

한국어로 릴스 제목만 한 줄로 출력해주세요. 다른 설명 없이 제목만.`;

  log('INFO', 'Selecting reel topic via Claude...');

  try {
    const result = execSync(
      `claude -p --model sonnet ${JSON.stringify(prompt)}`,
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 180_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    const topic = result.trim().split('\n').pop().trim();
    log('INFO', `Selected reel topic: ${topic}`);
    return topic;
  } catch (err) {
    log('ERROR', `Claude reel topic selection failed: ${err.message}`);
    return null;
  }
}

// Card topic: from backup_topics (tutorial/guide/tip)
function selectCardTopic(history) {
  const backups = auto.backup_topics || [
    '개발자 생산성을 높이는 도구 모음',
    '클린 코드 핵심 원칙',
    '2026 프론트엔드 트렌드',
    'Git 고급 활용법',
    'API 설계 베스트 프랙티스',
    'Docker 핵심 명령어 정리',
    'SQL 최적화 실전 팁',
    'React 성능 최적화 가이드',
    'TypeScript 필수 타입 패턴',
    '개발자가 알아야 할 네트워크 기초',
    'REST API vs GraphQL 비교',
    'CI/CD 파이프라인 구축 가이드',
  ];

  for (const topic of backups) {
    if (!isTopicUsed(history, topic)) {
      log('INFO', `Using card topic: ${topic}`);
      return topic;
    }
  }

  log('WARN', 'All card topics used, recycling first');
  return backups[0];
}

// ── Generation via Claude ──────────────────────────────

function generateContent(type, topic, attempt = 1) {
  const template = auto.template || 'studio';
  const tone = auto.tone || 'professional';
  const budget = auto.max_budget_per_run || 5.0;
  const timeoutMin = auto.timeout_minutes || 15;

  const claudePrompt = type === 'reel'
    ? `"${topic}" 주제로 릴스 만들어줘. 톤: ${tone}, 릴스 템플릿: clean, 업로드까지 해줘.`
    : `"${topic}" 주제로 카드뉴스 만들어줘. 톤: ${tone}, 템플릿: ${template}, 업로드까지 해줘.`;

  log('INFO', `Generating ${type} (attempt ${attempt}): ${topic}`);
  log('INFO', `Template: ${template}, Tone: ${tone}, Budget: $${budget}`);

  try {
    execSync(
      `claude -p --dangerously-skip-permissions --max-budget-usd ${budget} ${JSON.stringify(claudePrompt)}`,
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: timeoutMin * 60 * 1000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    log('INFO', `Claude ${type} pipeline completed`);
    return true;
  } catch (err) {
    log('ERROR', `Claude ${type} pipeline failed (attempt ${attempt}): ${err.message}`);
    return false;
  }
}

// ── Output Validation ──────────────────────────────────
function getOutputDirs() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs.readdirSync(OUTPUT_DIR).filter((d) =>
    fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory()
  );
}

function findNewOutputDir(dirsBefore, suffix) {
  const dirsAfter = getOutputDirs();
  const newDirs = dirsAfter.filter((d) => !dirsBefore.includes(d));

  if (suffix) {
    const matched = newDirs.find((d) => d.includes(suffix));
    if (matched) return path.join(OUTPUT_DIR, matched);
  }

  if (newDirs.length > 0) {
    return path.join(OUTPUT_DIR, newDirs[newDirs.length - 1]);
  }

  return null;
}

function validateCardOutput(outputDir) {
  if (!outputDir || !fs.existsSync(outputDir)) {
    log('ERROR', 'Card output directory not found');
    return false;
  }

  const slide1 = path.join(outputDir, 'slide_01.png');
  if (!fs.existsSync(slide1)) {
    log('ERROR', `slide_01.png not found in ${outputDir}`);
    return false;
  }

  const slideCount = fs.readdirSync(outputDir)
    .filter((f) => /^slide_\d+\.png$/.test(f)).length;
  log('INFO', `Card output validated: ${slideCount} slides in ${outputDir}`);
  return true;
}

function validateReelOutput(outputDir) {
  if (!outputDir || !fs.existsSync(outputDir)) {
    log('ERROR', 'Reel output directory not found');
    return false;
  }

  const scene1 = path.join(outputDir, 'scene_01.png');
  const video = path.join(outputDir, 'reel.mp4');
  if (!fs.existsSync(scene1)) {
    log('ERROR', `scene_01.png not found in ${outputDir}`);
    return false;
  }
  if (!fs.existsSync(video)) {
    log('WARN', `reel.mp4 not found in ${outputDir} (PNG-only mode?)`);
  }

  const sceneCount = fs.readdirSync(outputDir)
    .filter((f) => /^scene_\d+\.png$/.test(f)).length;
  log('INFO', `Reel output validated: ${sceneCount} scenes in ${outputDir}`);
  return true;
}

// ── Main Pipeline ──────────────────────────────────────
async function main() {
  log('INFO', '═══════════════════════════════════════════');
  log('INFO', `  Daily Content Pipeline${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log('INFO', `  ${CARD_ONLY ? 'CARD ONLY' : REEL_ONLY ? 'REEL ONLY' : 'CARD + REEL'}`);
  log('INFO', '═══════════════════════════════════════════');

  // Load .env
  try {
    require('dotenv').config({ path: path.join(ROOT, '.env') });
  } catch {
    log('WARN', 'dotenv not loaded (non-critical for generation)');
  }

  const history = loadHistory();
  const results = { card: null, reel: null };

  // ── Reel: News/Trending ────────────────────────────
  if (!CARD_ONLY) {
    log('INFO', '── REEL: News/Trending ──');

    const articles = await collectFeeds();
    let reelTopic;
    if (articles) {
      reelTopic = selectReelTopicViaClaude(articles, history);
    }
    if (!reelTopic) {
      log('WARN', 'No reel topic selected, skipping reel');
    } else {
      const dirsBefore = getOutputDirs();
      let success = generateContent('reel', reelTopic, 1);

      if (!success && auto.retry_on_failure !== false) {
        log('INFO', 'Retrying reel generation...');
        success = generateContent('reel', reelTopic, 2);
      }

      const reelDir = findNewOutputDir(dirsBefore, 'reel');

      if (success && validateReelOutput(reelDir)) {
        results.reel = { topic: reelTopic, output: reelDir, status: 'success' };
      } else {
        results.reel = { topic: reelTopic, output: reelDir, status: 'failed' };
        notify('Daily Content', `Reel failed: ${reelTopic}`);
      }
    }
  }

  // ── Card: Tutorial/Guide ───────────────────────────
  if (!REEL_ONLY) {
    log('INFO', '── CARD: Tutorial/Guide ──');

    const cardTopic = selectCardTopic(history);

    const dirsBefore = getOutputDirs();
    let success = generateContent('card', cardTopic, 1);

    if (!success && auto.retry_on_failure !== false) {
      log('INFO', 'Retrying card generation...');
      success = generateContent('card', cardTopic, 2);
    }

    const cardDir = findNewOutputDir(dirsBefore);

    if (success && validateCardOutput(cardDir)) {
      results.card = { topic: cardTopic, output: cardDir, status: 'success' };
    } else {
      results.card = { topic: cardTopic, output: cardDir, status: 'failed' };
      notify('Daily Content', `Card failed: ${cardTopic}`);
    }
  }

  // ── Record History ─────────────────────────────────
  const date = now.toISOString().slice(0, 10);
  const newEntries = [];

  if (results.reel) {
    newEntries.push({
      date,
      type: 'reel',
      topic: results.reel.topic,
      status: results.reel.status,
      output: results.reel.output,
    });
  }

  if (results.card) {
    newEntries.push({
      date,
      type: 'card',
      topic: results.card.topic,
      status: results.card.status,
      output: results.card.output,
    });
  }

  saveHistory({
    ...history,
    history: [...history.history, ...newEntries],
  });

  // ── Summary ────────────────────────────────────────
  log('INFO', '═══════════════════════════════════════════');
  log('INFO', '  DAILY SUMMARY');
  log('INFO', '───────────────────────────────────────────');

  if (results.reel) {
    const icon = results.reel.status === 'success' ? '✅' : '❌';
    log('INFO', `  ${icon} Reel: ${results.reel.topic}`);
    if (results.reel.output) log('INFO', `     → ${results.reel.output}`);
  }

  if (results.card) {
    const icon = results.card.status === 'success' ? '✅' : '❌';
    log('INFO', `  ${icon} Card: ${results.card.topic}`);
    if (results.card.output) log('INFO', `     → ${results.card.output}`);
  }

  log('INFO', '═══════════════════════════════════════════');

  const allSuccess = (!results.reel || results.reel.status === 'success') &&
    (!results.card || results.card.status === 'success');

  if (allSuccess) {
    notify('Daily Content', 'All content published successfully!');
  }

  if (!allSuccess) process.exit(1);
}

main().catch((err) => {
  log('ERROR', `Unhandled error: ${err.message}`);
  notify('Daily Content', `Pipeline error: ${err.message}`);
  process.exit(1);
});
