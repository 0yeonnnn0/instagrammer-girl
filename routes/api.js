'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../lib/auth');

const ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const REEL_TEMPLATES_DIR = path.join(ROOT, 'templates-reel');
const PREVIEWS_DIR = path.join(ROOT, 'public', 'previews');

function getTemplateList(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(d => fs.statSync(path.join(dir, d)).isDirectory())
    .sort();
}

function getSlideTypes(dir, templateName) {
  const tmplDir = path.join(dir, templateName);
  if (!fs.existsSync(tmplDir)) return [];
  return fs.readdirSync(tmplDir)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace('.html', ''))
    .sort();
}

function regeneratePreview(type, name) {
  try {
    if (type === 'card') {
      const slidesJson = JSON.stringify([{ slide: 1, type: 'cover', headline: '미리보기\\n샘플', subtext: `${name} 템플릿` }]);
      fs.writeFileSync('/tmp/preview-slides.json', slidesJson);
      execSync(`node scripts/render.js --slides /tmp/preview-slides.json --style ${name} --output public/previews/ --accent "#C94040" --account "preview"`, { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
      fs.renameSync(path.join(PREVIEWS_DIR, 'slide_01.png'), path.join(PREVIEWS_DIR, `card-${name}.png`));
    } else {
      const reelsJson = JSON.stringify([{ scene: 1, type: 'hook', badge_text: 'HOOK', headline: '미리보기\\n샘플', subtext: `${name} 템플릿`, duration: 2 }]);
      fs.writeFileSync('/tmp/preview-reels.json', reelsJson);
      execSync(`node scripts/render-reel.js --scenes /tmp/preview-reels.json --style ${name} --output public/previews/ --accent "#C94040" --account "preview" --png-only`, { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
      fs.renameSync(path.join(PREVIEWS_DIR, 'scene_01.png'), path.join(PREVIEWS_DIR, `reel-${name}.png`));
    }
    return true;
  } catch {
    return false;
  }
}

const CARD_SAMPLE_DATA = {
  'cover': { type:'cover', headline:'샘플 제목\\n미리보기', subtext:'서브텍스트' },
  'content': { type:'content', headline:'일반 콘텐츠', body:'본문 텍스트가\\n여기에 표시됩니다' },
  'content-stat': { type:'content-stat', headline:'통계', emphasis:'92%', body:'강조 숫자가\\n크게 표시됩니다' },
  'content-list': { type:'content-list', headline:'리스트', item1:'첫 번째', item2:'두 번째', item3:'세 번째', item4:'네 번째', item5:'다섯 번째' },
  'content-split': { type:'content-split', headline:'A vs B', left_title:'왼쪽', left_body:'왼쪽 설명', right_title:'오른쪽', right_body:'오른쪽 설명' },
  'content-highlight': { type:'content-highlight', headline:'하이라이트', emphasis:'핵심 메시지', body:'부연 설명' },
  'content-steps': { type:'content-steps', headline:'단계별', step1:'첫 번째 단계', step2:'두 번째 단계', step3:'세 번째 단계' },
  'content-grid': { type:'content-grid', headline:'그리드', grid1_icon:'🎯', grid1_title:'항목1', grid1_desc:'설명', grid2_icon:'📱', grid2_title:'항목2', grid2_desc:'설명', grid3_icon:'🤖', grid3_title:'항목3', grid3_desc:'설명', grid4_icon:'📊', grid4_title:'항목4', grid4_desc:'설명' },
  'content-badge': { type:'content-badge', badge_text:'BADGE', headline:'배지', body:'본문', subtext:'서브' },
  'content-quote': { type:'content-quote', headline:'— 출처', body:'인용문 영역' },
  'content-bigdata': { type:'content-bigdata', headline:'빅데이터', bigdata_number:'48.8', bigdata_unit:'조원', body:'설명', subtext:'출처' },
  'cta': { type:'cta', headline:'행동 유도\\n슬라이드', cta_text:'팔로우하기' },
};
const REEL_SAMPLE_DATA = {
  'hook': { type:'hook', badge_text:'🚨 훅', headline:'스크롤 멈춤\\n제목', subtext:'서브텍스트', duration:2 },
  'stat': { type:'stat', headline:'통계', emphasis:'85%', subtext:'단위', body:'본문', duration:2.5 },
  'point': { type:'point', badge_number:'01', headline:'포인트\\n제목', body:'본문 설명', duration:3 },
  'list': { type:'list', headline:'리스트', item1:'항목1', item2:'항목2', item3:'항목3', item4:'항목4', item5:'항목5', duration:3.5 },
  'tip': { type:'tip', badge_text:'💡', headline:'팁 제목', body:'팁 본문', duration:3 },
  'comparison': { type:'comparison', headline:'A vs B', left_title:'왼쪽', left_body:'왼쪽', right_title:'오른쪽', right_body:'오른쪽', duration:3 },
  'highlight': { type:'highlight', headline:'하이라이트', emphasis:'강조 문구', body:'부연 설명', duration:2.5 },
  'cta': { type:'cta', headline:'CTA\\n행동 유도', subtext:'서브텍스트', cta_text:'팔로우', tag1:'#태그1', tag2:'#태그2', tag3:'#태그3', duration:2 },
};

function regenerateSlidePreview(type, templateName, slideType) {
  try {
    const outDir = path.join(PREVIEWS_DIR, `${type}-${templateName}`);
    fs.mkdirSync(outDir, { recursive: true });
    if (type === 'card') {
      const sample = CARD_SAMPLE_DATA[slideType];
      if (!sample) return;
      const data = [{ ...sample, slide: 1 }];
      fs.writeFileSync('/tmp/regen-slide.json', JSON.stringify(data));
      execSync(`node scripts/render.js --slides /tmp/regen-slide.json --style ${templateName} --output ${outDir}/ --accent "#C94040" --account "preview"`, { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
      const src = path.join(outDir, 'slide_01.png');
      const dst = path.join(outDir, `${slideType}.png`);
      if (fs.existsSync(src)) fs.renameSync(src, dst);
    } else {
      const sample = REEL_SAMPLE_DATA[slideType];
      if (!sample) return;
      const data = [{ ...sample, scene: 1 }];
      fs.writeFileSync('/tmp/regen-scene.json', JSON.stringify(data));
      execSync(`node scripts/render-reel.js --scenes /tmp/regen-scene.json --style ${templateName} --output ${outDir}/ --accent "#C94040" --account "preview" --png-only`, { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
      const src = path.join(outDir, 'scene_01.png');
      const dst = path.join(outDir, `${slideType}.png`);
      if (fs.existsSync(src)) fs.renameSync(src, dst);
      const concat = path.join(outDir, 'concat.txt');
      if (fs.existsSync(concat)) fs.unlinkSync(concat);
    }
  } catch { /* ignore preview errors */ }
}

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth);

  // ── Prompt test ──
  fastify.post('/api/prompt-test', async (request, reply) => {
    const { prompt } = request.body || {};
    if (!prompt) return reply.send({ error: '프롬프트가 비어있습니다.' });

    const testPrompt = `[테스트 모드 — 업로드하지 마세요. 렌더링도 하지 마세요. 카피라이팅 결과만 JSON으로 보여주세요.]\n\n${prompt.replace(/업로드까지 해줘[.]?/g, '카피라이팅 결과만 JSON으로 보여줘.')}`;

    try {
      const result = execSync(
        `claude -p --model sonnet --max-budget-usd 1 ${JSON.stringify(testPrompt)}`,
        { cwd: ROOT, encoding: 'utf8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return reply.send({ result: result.trim() });
    } catch (err) {
      return reply.send({ error: `실행 실패: ${(err.stdout || err.stderr || err.message).substring(0, 2000)}` });
    }
  });

  // ── Template preview slides ──
  fastify.get('/api/templates/:type/:name/previews', async (request, reply) => {
    const { type, name } = request.params;
    const dir = path.join(PREVIEWS_DIR, `${type}-${name}`);
    if (!fs.existsSync(dir)) return reply.send({ slides: [] });
    const slides = fs.readdirSync(dir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .map(f => ({ type: f.replace('.png', ''), src: `/public/previews/${type}-${name}/${f}` }));
    return reply.send({ slides });
  });

  // ── Template HTML read ──
  fastify.get('/api/templates/:type/:name/:slideType', async (request, reply) => {
    const { type, name, slideType } = request.params;
    const baseDir = type === 'reel' ? REEL_TEMPLATES_DIR : TEMPLATES_DIR;
    const filePath = path.join(baseDir, name, `${slideType}.html`);
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'File not found' });
    return reply.send({ html: fs.readFileSync(filePath, 'utf8') });
  });

  // ── Template HTML save ──
  fastify.post('/api/templates/:type/:name/:slideType', async (request, reply) => {
    const { type, name, slideType } = request.params;
    const { html } = request.body || {};
    if (!html) return reply.code(400).send({ error: 'HTML content required' });
    const baseDir = type === 'reel' ? REEL_TEMPLATES_DIR : TEMPLATES_DIR;
    const filePath = path.join(baseDir, name, `${slideType}.html`);
    if (!fs.existsSync(path.dirname(filePath))) return reply.code(404).send({ error: 'Template not found' });
    fs.writeFileSync(filePath, html, 'utf8');
    // Regenerate preview for this slide
    regenerateSlidePreview(type, name, slideType);
    return reply.send({ success: true });
  });

  // ── Template list ──
  fastify.get('/api/templates', async (request, reply) => {
    const cards = getTemplateList(TEMPLATES_DIR).map(name => ({
      name, type: 'card',
      slideTypes: getSlideTypes(TEMPLATES_DIR, name),
      hasPreview: fs.existsSync(path.join(PREVIEWS_DIR, `card-${name}.png`)),
    }));
    const reels = getTemplateList(REEL_TEMPLATES_DIR).map(name => ({
      name, type: 'reel',
      slideTypes: getSlideTypes(REEL_TEMPLATES_DIR, name),
      hasPreview: fs.existsSync(path.join(PREVIEWS_DIR, `reel-${name}.png`)),
    }));
    return reply.send({ cards, reels });
  });

  // ── Template create (duplicate from existing) ──
  fastify.post('/api/templates', async (request, reply) => {
    const { type, name, copyFrom } = request.body || {};
    if (!type || !name) return reply.code(400).send({ error: 'type과 name이 필요합니다.' });
    if (!/^[a-z0-9-]+$/.test(name)) return reply.code(400).send({ error: '이름은 영문 소문자, 숫자, 하이픈만 가능합니다.' });

    const baseDir = type === 'reel' ? REEL_TEMPLATES_DIR : TEMPLATES_DIR;
    const targetDir = path.join(baseDir, name);

    if (fs.existsSync(targetDir)) return reply.code(400).send({ error: '이미 존재하는 템플릿입니다.' });

    // Copy from existing template
    const sourceDir = path.join(baseDir, copyFrom || (type === 'reel' ? 'clean' : 'studio'));
    if (!fs.existsSync(sourceDir)) return reply.code(400).send({ error: '복사할 원본 템플릿이 없습니다.' });

    fs.cpSync(sourceDir, targetDir, { recursive: true });

    // Generate preview
    regeneratePreview(type, name);

    return reply.send({ success: true, name, type });
  });

  // ── Template delete ──
  fastify.post('/api/templates/delete', async (request, reply) => {
    const { type, name } = request.body || {};
    if (!type || !name) return reply.code(400).send({ error: 'type과 name이 필요합니다.' });

    // Protect default templates
    const protectedCards = ['studio', 'minimal'];
    const protectedReels = ['clean'];
    if (type === 'card' && protectedCards.includes(name)) return reply.code(400).send({ error: '기본 템플릿은 삭제할 수 없습니다.' });
    if (type === 'reel' && protectedReels.includes(name)) return reply.code(400).send({ error: '기본 템플릿은 삭제할 수 없습니다.' });

    const baseDir = type === 'reel' ? REEL_TEMPLATES_DIR : TEMPLATES_DIR;
    const targetDir = path.join(baseDir, name);

    if (!fs.existsSync(targetDir)) return reply.code(404).send({ error: '템플릿을 찾을 수 없습니다.' });

    fs.rmSync(targetDir, { recursive: true });

    // Remove preview
    const previewPath = path.join(PREVIEWS_DIR, `${type === 'reel' ? 'reel' : 'card'}-${name}.png`);
    if (fs.existsSync(previewPath)) fs.unlinkSync(previewPath);

    return reply.send({ success: true });
  });
};
