'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const db = require('./db');
const { decrypt } = require('./crypto');
const { collectFeeds } = require('./feeds');
const { runPrompt } = require('./ai-provider');

const ROOT = path.join(__dirname, '..');
const WORKSPACE_DIR = path.join(ROOT, 'workspace');
const OUTPUT_DIR = path.join(ROOT, 'output');
let running = false;
const queue = [];

const FRAMEWORK_CURRICULUM = {
  react: [
    '컴포넌트와 JSX 기본',
    '컴포넌트 분리와 재사용',
    'props 기본',
    '조건부 렌더링',
    'state(useState) 기본',
    '이벤트 처리',
    '리스트 렌더링과 key',
    'useEffect 기본',
    '상태 끌어올리기',
    '커스텀 훅 기초',
  ],
  kotlin: [
    'Kotlin 소개와 기본 문법',
    '변수(val/var)와 타입 시스템',
    '함수 선언과 표현식',
    'null 안전성(Nullable, 안전 호출)',
    '조건문과 when',
    '컬렉션(List/Set/Map) 기초',
    '클래스와 data class',
    '객체지향 핵심(상속, 인터페이스)',
    '확장 함수와 고차 함수',
    '코루틴 기초(suspend, launch)',
  ],
  코틀린: [
    'Kotlin 소개와 기본 문법',
    '변수(val/var)와 타입 시스템',
    '함수 선언과 표현식',
    'null 안전성(Nullable, 안전 호출)',
    '조건문과 when',
    '컬렉션(List/Set/Map) 기초',
    '클래스와 data class',
    '객체지향 핵심(상속, 인터페이스)',
    '확장 함수와 고차 함수',
    '코루틴 기초(suspend, launch)',
  ],
  javascript: [
    'JavaScript가 실행되는 환경과 역할',
    '값, 타입, typeof의 기본',
    '변수 선언(let/const)과 재할당',
    '연산자와 형 변환',
    '조건문과 truthy/falsy',
    '반복문과 순회 패턴',
    '함수 선언식, 표현식, 화살표 함수',
    '스코프와 lexical scope',
    '객체와 프로퍼티 접근',
    '배열과 자주 쓰는 메서드',
    '구조 분해 할당과 spread/rest',
    '템플릿 리터럴과 문자열 처리',
    '콜백 함수와 고차 함수',
    'this 바인딩',
    '프로토타입과 클래스',
    '모듈(import/export)',
    '에러 처리와 try/catch',
    '비동기 처리 개념',
    'Promise와 async/await',
    'DOM 이벤트와 브라우저 API 기초',
  ],
};

const NEXT_FRAMEWORK_MAP = {
  react: 'Kotlin',
  kotlin: 'JavaScript',
  코틀린: 'JavaScript',
};

const FRAMEWORK_TOTAL_PARTS = {
  javascript: 20,
};

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

function pad(value) {
  return String(value).padStart(2, '0');
}

function slugify(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function datePrefix(now = new Date()) {
  return `${pad(now.getFullYear() % 100)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeInt(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeFrameworkKey(framework) {
  return String(framework || '').trim().toLowerCase().replace(/\s+/g, '');
}

function resolveSeriesConcept(framework, totalParts, currentPart) {
  const curriculum = FRAMEWORK_CURRICULUM[normalizeFrameworkKey(framework)];
  if (!curriculum || curriculum.length === 0) return null;

  // If total parts are fewer than the curriculum length, keep first N in order.
  if (totalParts <= curriculum.length) {
    return curriculum[currentPart - 1] || null;
  }

  // If total parts exceed predefined curriculum, keep order first and then extend with generic deep-dive.
  if (currentPart <= curriculum.length) return curriculum[currentPart - 1];
  return `${curriculum[curriculum.length - 1]} 심화 ${currentPart - curriculum.length}`;
}

function buildSeriesTopic(framework, totalParts, currentPart) {
  const concept = resolveSeriesConcept(framework, totalParts, currentPart);
  const cleanFramework = String(framework || '').trim();

  if (concept) return concept;
  return `${cleanFramework} 쉽게 배우기`;
}

function buildLegacySeriesTopic(framework, totalParts, currentPart) {
  return `${framework} 공식문서 쉽게 배우기 #${currentPart}/${totalParts}`;
}

function buildSeriesSubtext(framework, totalParts, currentPart) {
  const concept = resolveSeriesConcept(framework, totalParts, currentPart);
  const prefix = `${framework} 쉽게 배우기 #${currentPart}/${totalParts}`;

  if (concept) return `${prefix} : ${concept}`;
  return prefix;
}

function resolveNextFramework(framework) {
  return NEXT_FRAMEWORK_MAP[normalizeFrameworkKey(framework)] || null;
}

function resolveFrameworkTotalParts(framework, fallback) {
  return FRAMEWORK_TOTAL_PARTS[normalizeFrameworkKey(framework)] || fallback;
}

function buildArtifactPaths(account, type, topic) {
  const baseName = `${datePrefix()}-${slugify(topic)}-${slugify(account.name)}`;
  const outputDir = path.join(OUTPUT_DIR, type === 'reel' ? `${baseName}-reel` : baseName);
  const dataPath = path.join(WORKSPACE_DIR, type === 'reel' ? 'reels.json' : 'slides.json');
  return {
    outputDir,
    dataPath,
    captionPath: path.join(outputDir, 'text.md'),
  };
}

function resetArtifacts(paths) {
  fs.rmSync(paths.outputDir, { recursive: true, force: true });
  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.rmSync(paths.dataPath, { force: true });
}

function validateArtifacts(paths) {
  if (!fs.existsSync(paths.dataPath)) {
    throw new Error(`Expected generated data file at ${paths.dataPath}`);
  }

  if (!fs.existsSync(paths.captionPath)) {
    fs.writeFileSync(paths.captionPath, '', 'utf8');
  }
}

function runNodeScript(jobId, env, scriptPath, args, label, timeoutMs) {
  try {
    const output = execFileSync(process.execPath, [scriptPath, ...args], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (output && output.trim()) {
      const lines = output.trim().split('\n').map((line) => line.trim()).filter(Boolean);
      const summary = [...lines].reverse().find((line) => !/^[═\-\s]+$/.test(line)) || lines[lines.length - 1];
      log(jobId, `${label}: ${summary}`);
    }
    return true;
  } catch (error) {
    const detail = (error.stdout || error.stderr || error.message || '').toString().trim();
    log(jobId, `${label} failed: ${detail.substring(0, 1000)}`);
    return false;
  }
}

function renderAndUpload(account, type, topic, jobId, env) {
  const artifacts = buildArtifactPaths(account, type, topic);
  resetArtifacts(artifacts);
  db.prepare('UPDATE jobs SET output_dir = ? WHERE id = ?').run(artifacts.outputDir, jobId);

  const prompt = buildPrompt(account, type, topic, artifacts);
  const result = runPrompt(prompt, {
    cwd: ROOT,
    provider: account.ai_provider,
    model: account.ai_model,
    timeoutMs: account.timeout_minutes * 60 * 1000,
    budgetUsd: account.max_budget_usd,
    skipPermissions: true,
    env,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (!result.ok) {
    log(jobId, `Generation failed (${result.provider}): ${result.message.substring(0, 500)}`);
    return false;
  }

  try {
    validateArtifacts(artifacts);
  } catch (error) {
    log(jobId, `Artifact validation failed: ${error.message}`);
    return false;
  }

  const renderArgs = type === 'reel'
    ? ['scripts/render-reel.js', '--scenes', artifacts.dataPath, '--style', account.reel_template, '--output', artifacts.outputDir, '--accent', account.accent_color, '--account', account.name]
    : ['scripts/render.js', '--slides', artifacts.dataPath, '--style', account.template, '--output', artifacts.outputDir, '--accent', account.accent_color, '--account', account.name];

  if (!runNodeScript(jobId, env, renderArgs[0], renderArgs.slice(1), `${type} render`, account.timeout_minutes * 60 * 1000)) {
    return false;
  }

  if (!account.upload_after_gen) {
    log(jobId, `Upload skipped for ${type} (upload_after_gen disabled)`);
    return true;
  }

  const uploadArgs = type === 'reel'
    ? ['scripts/upload-reel.js', '--dir', artifacts.outputDir]
    : ['scripts/upload-carousel.js', '--dir', artifacts.outputDir];

  return runNodeScript(jobId, env, uploadArgs[0], uploadArgs.slice(1), `${type} upload`, 15 * 60 * 1000);
}

async function selectReelTopic(account, jobId) {
  const articles = await collectFeeds(account);
  if (!articles) return null;

  const usedTopics = db.prepare(
    "SELECT topic FROM topic_history WHERE account_id = ? AND type = 'reel'"
  ).all(account.id).map(t => t.topic).join(', ');

  const articleList = articles.map((a, i) => `${i + 1}. [${a.source}] ${a.title}`).join('\n');

  const prompt = `아래는 오늘의 개발/기술 뉴스 목록입니다.
인스타그램 릴스로 만들기 가장 좋은 뉴스 주제 1개를 선정해주세요.
이미 사용한 주제 (제외): ${usedTopics || '없음'}

${articleList}

한국어로 릴스 제목만 한 줄로 출력해주세요.`;

  const result = runPrompt(prompt, {
    cwd: ROOT,
    provider: account.ai_provider,
    model: account.ai_model,
    timeoutMs: 180_000,
  });

  if (!result.ok) {
    log(jobId, `Topic selection failed (${result.provider}): ${result.message.substring(0, 500)}`);
    return null;
  }

  return result.output.split('\n').pop().trim();
}

function selectCardTopic(account) {
  const topicMode = account.card_topic_mode === 'series' ? 'series' : 'backup';
  const framework = String(account.card_series_framework || '').trim();
  const totalParts = normalizeInt(account.card_series_total_parts, 10, 2, 100);
  const currentPart = normalizeInt(account.card_series_current_part, 1, 1, totalParts);
  const loop = Number(account.card_series_loop || 0) === 1;

  if (topicMode === 'series' && framework) {
    const seriesTopic = buildSeriesTopic(framework, totalParts, currentPart);

    // Non-loop mode: once the final part has already been published, skip future card generation.
    if (!loop && currentPart === totalParts) {
      const legacySeriesTopic = buildLegacySeriesTopic(framework, totalParts, currentPart);
      const alreadyPublishedFinal = db.prepare(
        "SELECT 1 FROM topic_history WHERE account_id = ? AND type = 'card' AND topic IN (?, ?) LIMIT 1"
      ).get(account.id, seriesTopic, legacySeriesTopic);

      if (alreadyPublishedFinal) {
        const nextFramework = resolveNextFramework(framework);
        if (nextFramework) {
          const nextTotalParts = resolveFrameworkTotalParts(nextFramework, totalParts);
          const nextTopic = buildSeriesTopic(nextFramework, nextTotalParts, 1);
          db.prepare(
            "UPDATE accounts SET card_series_framework = ?, card_series_total_parts = ?, card_series_current_part = 1, updated_at = datetime('now') WHERE id = ?"
          ).run(nextFramework, nextTotalParts, account.id);
          account.card_series_framework = nextFramework;
          account.card_series_total_parts = nextTotalParts;
          account.card_series_current_part = 1;
          return {
            topic: nextTopic,
            mode: 'series',
            framework: nextFramework,
            currentPart: 1,
            totalParts: nextTotalParts,
          };
        }

        return {
          skip: true,
          reason: 'series_completed',
          mode: 'series',
          topic: seriesTopic,
          framework,
          currentPart,
          totalParts,
        };
      }
    }

    return {
      topic: seriesTopic,
      mode: 'series',
      framework,
      currentPart,
      totalParts,
    };
  }

  const backupRaw = account.backup_topics || '';
  const backups = backupRaw.split('\n').map(s => s.trim()).filter(Boolean);
  if (backups.length === 0) backups.push('개발자 생산성 팁', 'Git 활용법', 'API 설계 가이드');

  const used = db.prepare(
    "SELECT topic FROM topic_history WHERE account_id = ? AND type = 'card'"
  ).all(account.id).map(t => t.topic.toLowerCase().replace(/\s+/g, ''));

  for (const topic of backups) {
    if (!used.includes(topic.toLowerCase().replace(/\s+/g, ''))) {
      return { topic, mode: 'backup' };
    }
  }
  return { topic: backups[0], mode: 'backup' };
}

function buildCardSeriesPrompt(account) {
  if (account.card_topic_mode !== 'series') return '';

  const framework = String(account.card_series_framework || '').trim();
  if (!framework) return '';

  const totalParts = normalizeInt(account.card_series_total_parts, 10, 2, 100);
  const currentPart = normalizeInt(account.card_series_current_part, 1, 1, totalParts);
  const concept = resolveSeriesConcept(framework, totalParts, currentPart);
  const coverSubtext = buildSeriesSubtext(framework, totalParts, currentPart);

  const conceptRule = concept
    ? `이번 ${currentPart}/${totalParts} 편의 고정 주제는 "${concept}"이다. 반드시 이 주제만 다루고 다른 주제로 벗어나지 마라.`
    : `이번 ${currentPart}/${totalParts} 편에서 이전 편과 겹치지 않는 단일 개념 1개를 선택해라.`;

  return [
    `이 콘텐츠는 ${framework} 공식 문서 기반 시리즈 ${currentPart}/${totalParts} 편이다.`,
    conceptRule,
    '이번 편은 핵심 개념 1개만 다뤄라.',
    '설명 방식은 반드시 초급자 친화적으로 유지하고 어려운 용어는 짧게 풀어서 설명해라.',
    '구성 순서: 개념 정의 → 왜 필요한지 → 간단 코드 예시 → 자주 하는 실수 1~2개 → 다음 편 예고(다음 편 주제는 현재 편 주제와 달라야 함).',
    '사실 설명은 공식 문서와 충돌하지 않게 작성해라.',
    `커버 첫 페이지의 subtext 값은 반드시 "${coverSubtext}"로 정확히 써라.`,
    '커버 첫 페이지의 headline 값은 고정 주제 개념을 활용한 짧은 한국어 문구로 써라. headline에는 프레임워크명, 공식문서 문구, 편수 표기를 넣지 마라.',
    '커버 첫 페이지의 headline_en 값은 headline을 보조하는 짧은 영어 문구로 써라.',
    'subtext를 제외한 카드 제목, 슬라이드 제목, 캡션 제목에는 "#4/10", "4/10", "몇 편째" 같은 편수 표기를 절대 넣지 마라.',
  ].join(' ');
}

function advanceCardSeriesProgress(account, selection, jobId) {
  if (!selection || selection.mode !== 'series') return;

  const loop = Number(account.card_series_loop || 0) === 1;
  const finishedFinalPart = selection.currentPart >= selection.totalParts;

  // Non-loop mode: auto-switch to configured next framework when final part is completed.
  if (!loop && finishedFinalPart) {
    const nextFramework = resolveNextFramework(selection.framework);
    if (nextFramework) {
      const nextTotalParts = resolveFrameworkTotalParts(nextFramework, selection.totalParts);
      db.prepare(
        "UPDATE accounts SET card_series_framework = ?, card_series_total_parts = ?, card_series_current_part = 1, updated_at = datetime('now') WHERE id = ?"
      ).run(nextFramework, nextTotalParts, account.id);
      if (jobId) {
        log(jobId, `Card series switched: ${selection.framework} ${selection.totalParts}/${selection.totalParts} -> ${nextFramework} 1/${nextTotalParts}`);
      }
      return;
    }
  }

  const nextPart = selection.currentPart < selection.totalParts
    ? selection.currentPart + 1
    : (loop ? 1 : selection.totalParts);

  db.prepare(
    "UPDATE accounts SET card_series_current_part = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(nextPart, account.id);

  if (jobId) {
    log(jobId, `Card series progress: ${selection.currentPart}/${selection.totalParts} -> ${nextPart}/${selection.totalParts}`);
  }
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

function buildPrompt(account, type, topic, artifacts) {
  // 1. Base prompt (fixed, not editable)
  const base = type === 'reel'
    ? `"${topic}" 주제로 릴스 콘텐츠를 만들어줘. 톤: ${account.tone}, 릴스 템플릿: ${account.reel_template}, 악센트: ${account.accent_color}, 계정: ${account.name}.`
    : `"${topic}" 주제로 카드뉴스 콘텐츠를 만들어줘. 톤: ${account.tone}, 템플릿: ${account.template}, 악센트: ${account.accent_color}, 계정: ${account.name}.`;

  // 2. Strategy prompt (editable, with defaults)
  const strategy = type === 'reel' ? account.reel_strategy : account.card_strategy;
  const strategyPromptCustom = type === 'reel' ? account.reel_strategy_prompt : account.card_strategy_prompt;
  const strategyPrompt = (strategyPromptCustom && strategyPromptCustom.trim())
    ? strategyPromptCustom.trim()
    : (DEFAULT_STRATEGIES[type]?.[strategy] || '');

  // 3. Additional instructions (free text)
  const custom = type === 'reel' ? account.reel_prompt : account.card_prompt;
  const seriesPrompt = type === 'card' ? buildCardSeriesPrompt(account) : '';

  const outputRules = type === 'reel'
    ? [
        `반드시 JSON 결과를 ${artifacts.dataPath} 에 저장해. 파일명은 고정이고 배열 형식이어야 해.`,
        `캡션은 ${artifacts.captionPath} 에 UTF-8 text.md로 저장해.`,
        '이번 실행에서는 reels.json과 text.md만 생성하고, ffmpeg/업로드 스크립트는 직접 실행하지 마.',
      ]
    : [
        `반드시 JSON 결과를 ${artifacts.dataPath} 에 저장해. 파일명은 고정이고 배열 형식이어야 해.`,
        `캡션은 ${artifacts.captionPath} 에 UTF-8 text.md로 저장해.`,
        '이번 실행에서는 slides.json과 text.md만 생성하고, 렌더링/업로드 스크립트는 직접 실행하지 마.',
      ];

  const parts = [base, ...outputRules];
  if (strategyPrompt) parts.push(strategyPrompt);
  if (seriesPrompt) parts.push(seriesPrompt);
  if (custom && custom.trim()) parts.push(custom.trim());

  return parts.join('\n\n');
}

function generateContent(account, type, topic, jobId) {
  const env = {
    ...process.env,
    INSTAGRAM_ACCESS_TOKEN: decrypt(account.ig_access_token),
    INSTAGRAM_ACCOUNT_ID: account.ig_account_id,
  };

  if (account.cloudinary_cloud_name) env.CLOUDINARY_CLOUD_NAME = account.cloudinary_cloud_name;
  if (account.cloudinary_api_key) env.CLOUDINARY_API_KEY = account.cloudinary_api_key;
  if (account.cloudinary_api_secret) env.CLOUDINARY_API_SECRET = decrypt(account.cloudinary_api_secret);

  return renderAndUpload(account, type, topic, jobId, env);
}

async function executeJob(accountId, type, triggerType) {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return;

  const types = type === 'both' ? ['reel', 'card'] : [type];

  for (const t of types) {
    let topic;
    if (t === 'reel') {
      const tempJob = db.prepare(
        "INSERT INTO jobs (account_id, type, topic, status, trigger_type, started_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
      ).run(accountId, t, 'selecting...', 'running', triggerType);
      const jobId = tempJob.lastInsertRowid;

      topic = await selectReelTopic(account, jobId);
      if (!topic) {
        db.prepare("UPDATE jobs SET topic = ?, status = ?, error_msg = COALESCE(error_msg, '') || ?, finished_at = datetime('now') WHERE id = ?")
          .run('(no topic)', 'failed', 'No reel topic found\n', jobId);
        continue;
      }
      db.prepare('UPDATE jobs SET topic = ? WHERE id = ?').run(topic, jobId);

      log(jobId, `Generating reel: ${topic}`);
      const success = generateContent(account, t, topic, jobId);
      db.prepare("UPDATE jobs SET status = ?, finished_at = datetime('now') WHERE id = ?")
        .run(success ? 'success' : 'failed', jobId);

      if (success) {
        db.prepare('INSERT INTO topic_history (account_id, type, topic, job_id) VALUES (?, ?, ?, ?)')
          .run(accountId, t, topic, jobId);
      }
    } else {
      const cardSelection = selectCardTopic(account);
      if (cardSelection.skip) {
        console.log(
          `[job-runner] Account ${accountId} card skipped: ${cardSelection.reason} (${cardSelection.topic})`
        );
        continue;
      }

      topic = cardSelection.topic;
      const tempJob = db.prepare(
        "INSERT INTO jobs (account_id, type, topic, status, trigger_type, started_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
      ).run(accountId, t, topic, 'running', triggerType);
      const jobId = tempJob.lastInsertRowid;

      log(jobId, `Generating card: ${topic}`);
      const success = generateContent(account, t, topic, jobId);
      db.prepare("UPDATE jobs SET status = ?, finished_at = datetime('now') WHERE id = ?")
        .run(success ? 'success' : 'failed', jobId);

      if (success) {
        db.prepare('INSERT INTO topic_history (account_id, type, topic, job_id) VALUES (?, ?, ?, ?)')
          .run(accountId, t, topic, jobId);
        advanceCardSeriesProgress(account, cardSelection, jobId);
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
