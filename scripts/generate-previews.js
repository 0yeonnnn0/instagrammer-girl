'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PREVIEWS_DIR = path.join(ROOT, 'public', 'previews');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const REEL_TEMPLATES_DIR = path.join(ROOT, 'templates-reel');

// Sample data for each card slide type
const CARD_SAMPLES = [
  { slide: 1, type: 'cover', headline: '샘플 제목\n미리보기', subtext: '서브텍스트 영역' },
  { slide: 2, type: 'content', headline: '일반 콘텐츠', body: '본문 텍스트가\n여기에 표시됩니다' },
  { slide: 3, type: 'content-stat', headline: '통계 슬라이드', emphasis: '92%', body: '강조할 숫자가\n크게 표시됩니다' },
  { slide: 4, type: 'content-list', headline: '리스트 슬라이드', item1: '첫 번째 항목', item2: '두 번째 항목', item3: '세 번째 항목', item4: '네 번째 항목', item5: '다섯 번째 항목' },
  { slide: 5, type: 'content-split', headline: 'A vs B 비교', left_title: '왼쪽', left_body: '왼쪽 설명\n텍스트', right_title: '오른쪽', right_body: '오른쪽 설명\n텍스트' },
  { slide: 6, type: 'content-highlight', headline: '하이라이트', emphasis: '핵심 메시지', body: '부연 설명 텍스트가\n여기에 표시됩니다' },
  { slide: 7, type: 'content-steps', headline: '단계별 가이드', step1: '첫 번째 단계 설명', step2: '두 번째 단계 설명', step3: '세 번째 단계 설명' },
  { slide: 8, type: 'content-grid', headline: '그리드 레이아웃', grid1_icon: '🎯', grid1_title: '항목 1', grid1_desc: '설명', grid2_icon: '📱', grid2_title: '항목 2', grid2_desc: '설명', grid3_icon: '🤖', grid3_title: '항목 3', grid3_desc: '설명', grid4_icon: '📊', grid4_title: '항목 4', grid4_desc: '설명' },
  { slide: 9, type: 'content-badge', badge_text: 'BADGE', headline: '배지 슬라이드', body: '본문 텍스트 영역', subtext: '서브텍스트' },
  { slide: 10, type: 'content-quote', headline: '— 출처', body: '인용문이 여기에\n표시됩니다' },
  { slide: 11, type: 'content-bigdata', headline: '빅데이터', bigdata_number: '48.8', bigdata_unit: '조원', body: '설명 텍스트', subtext: '출처' },
  { slide: 12, type: 'cta', headline: '행동 유도\n슬라이드', cta_text: '팔로우하기' },
];

// Sample data for each reel scene type
const REEL_SAMPLES = [
  { scene: 1, type: 'hook', badge_text: '🚨 훅', headline: '스크롤 멈춤\n제목', subtext: '서브텍스트', duration: 2 },
  { scene: 2, type: 'stat', headline: '통계', emphasis: '85%', subtext: '단위', body: '본문 설명\n텍스트', duration: 2.5 },
  { scene: 3, type: 'point', badge_number: '01', headline: '포인트\n제목', body: '본문 설명\n텍스트 영역', duration: 3 },
  { scene: 4, type: 'list', headline: '리스트 제목', item1: '항목 1', item2: '항목 2', item3: '항목 3', item4: '항목 4', item5: '항목 5', duration: 3.5 },
  { scene: 5, type: 'tip', badge_text: '💡', headline: '팁 제목', body: '팁 본문\n텍스트 영역', duration: 3 },
  { scene: 6, type: 'comparison', headline: 'A vs B', left_title: '왼쪽', left_body: '왼쪽 설명', right_title: '오른쪽', right_body: '오른쪽 설명', duration: 3 },
  { scene: 7, type: 'highlight', headline: '하이라이트', emphasis: '강조 문구\n핵심 메시지', body: '부연 설명', duration: 2.5 },
  { scene: 8, type: 'cta', headline: 'CTA 제목\n행동 유도', subtext: '서브텍스트', cta_text: '팔로우하기', tag1: '#태그1', tag2: '#태그2', tag3: '#태그3', duration: 2 },
];

function generateCardPreviews(templateName) {
  const tmplDir = path.join(TEMPLATES_DIR, templateName);
  if (!fs.existsSync(tmplDir)) return;

  // Filter samples to only include types that exist in this template
  const availableTypes = fs.readdirSync(tmplDir)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace('.html', ''));

  const slides = CARD_SAMPLES
    .filter(s => availableTypes.includes(s.type))
    .map((s, i) => ({ ...s, slide: i + 1 }));

  if (slides.length === 0) return;

  const tmpFile = `/tmp/preview-card-${templateName}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(slides));

  const outDir = path.join(PREVIEWS_DIR, `card-${templateName}`);
  fs.mkdirSync(outDir, { recursive: true });

  try {
    execSync(
      `node scripts/render.js --slides ${tmpFile} --style ${templateName} --output ${outDir}/ --accent "#C94040" --account "preview"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 60000 }
    );

    // Rename to type-based names
    slides.forEach((s, i) => {
      const num = String(i + 1).padStart(2, '0');
      const src = path.join(outDir, `slide_${num}.png`);
      const dst = path.join(outDir, `${s.type}.png`);
      if (fs.existsSync(src)) fs.renameSync(src, dst);
    });

    console.log(`  ✓ card/${templateName}: ${slides.length} slides`);
  } catch (err) {
    console.error(`  ✗ card/${templateName}: ${err.message.substring(0, 100)}`);
  }
}

function generateReelPreviews(templateName) {
  const tmplDir = path.join(REEL_TEMPLATES_DIR, templateName);
  if (!fs.existsSync(tmplDir)) return;

  const availableTypes = fs.readdirSync(tmplDir)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace('.html', ''));

  const scenes = REEL_SAMPLES
    .filter(s => availableTypes.includes(s.type))
    .map((s, i) => ({ ...s, scene: i + 1 }));

  if (scenes.length === 0) return;

  const tmpFile = `/tmp/preview-reel-${templateName}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(scenes));

  const outDir = path.join(PREVIEWS_DIR, `reel-${templateName}`);
  fs.mkdirSync(outDir, { recursive: true });

  try {
    execSync(
      `node scripts/render-reel.js --scenes ${tmpFile} --style ${templateName} --output ${outDir}/ --accent "#C94040" --account "preview" --png-only`,
      { cwd: ROOT, stdio: 'pipe', timeout: 60000 }
    );

    scenes.forEach((s, i) => {
      const num = String(i + 1).padStart(2, '0');
      const src = path.join(outDir, `scene_${num}.png`);
      const dst = path.join(outDir, `${s.type}.png`);
      if (fs.existsSync(src)) fs.renameSync(src, dst);
    });

    // Cleanup concat.txt
    const concat = path.join(outDir, 'concat.txt');
    if (fs.existsSync(concat)) fs.unlinkSync(concat);

    console.log(`  ✓ reel/${templateName}: ${scenes.length} scenes`);
  } catch (err) {
    console.error(`  ✗ reel/${templateName}: ${err.message.substring(0, 100)}`);
  }
}

// Main
console.log('Generating template previews...\n');

const cardTemplates = fs.readdirSync(TEMPLATES_DIR).filter(d => fs.statSync(path.join(TEMPLATES_DIR, d)).isDirectory());
const reelTemplates = fs.readdirSync(REEL_TEMPLATES_DIR).filter(d => fs.statSync(path.join(REEL_TEMPLATES_DIR, d)).isDirectory());

console.log('Card templates:');
for (const t of cardTemplates) generateCardPreviews(t);

console.log('\nReel templates:');
for (const t of reelTemplates) generateReelPreviews(t);

console.log('\nDone!');
