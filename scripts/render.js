'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * Replace all template placeholders in HTML content.
 * @param {string} html - Raw HTML template string
 * @param {object} slide - Slide data object
 * @param {object} opts - Rendering options
 * @param {number} index - 0-based slide index
 * @param {number} total - Total slide count
 * @returns {string} Processed HTML
 */
function applyPlaceholders(html, slide, opts, index, total) {
  const normalizedSlide = normalizeSlideForRender(slide);
  const body = (normalizedSlide.body || '').replace(/\n/g, '<br>');

  const replacements = {
    '{{headline}}': (normalizedSlide.headline || '').replace(/\n/g, '<br>'),
    '{{headline_en}}': (normalizedSlide.headline_en || '').replace(/\n/g, '<br>'),
    '{{emphasis_en}}': (normalizedSlide.emphasis_en || '').replace(/\n/g, '<br>'),
    '{{subtext}}': (normalizedSlide.subtext || '').replace(/\n/g, '<br>'),
    '{{body}}': body,
    '{{emphasis}}': (normalizedSlide.emphasis || '').replace(/\n/g, '<br>'),
    '{{cta_text}}': normalizedSlide.cta_text || '',
    '{{slide_number}}': String(index + 1).padStart(2, '0'),
    '{{total_slides}}': String(total).padStart(2, '0'),
    '{{accent_color}}': opts.accent || config.defaults.accent_color,
    '{{account_name}}': opts.account || config.defaults.account_name,
    // v2 placeholders
    '{{image_url}}': normalizedSlide.image_url || '',
    '{{badge_text}}': normalizedSlide.badge_text || '',
    '{{step1}}': (normalizedSlide.step1 || '').replace(/\n/g, '<br>'),
    '{{step2}}': (normalizedSlide.step2 || '').replace(/\n/g, '<br>'),
    '{{step3}}': (normalizedSlide.step3 || '').replace(/\n/g, '<br>'),
    '{{item1}}': (normalizedSlide.item1 || '').replace(/\n/g, '<br>'),
    '{{item2}}': (normalizedSlide.item2 || '').replace(/\n/g, '<br>'),
    '{{item3}}': (normalizedSlide.item3 || '').replace(/\n/g, '<br>'),
    '{{item4}}': (normalizedSlide.item4 || '').replace(/\n/g, '<br>'),
    '{{item5}}': (normalizedSlide.item5 || '').replace(/\n/g, '<br>'),
    '{{left_title}}': normalizedSlide.left_title || '',
    '{{left_body}}': (normalizedSlide.left_body || '').replace(/\n/g, '<br>'),
    '{{right_title}}': normalizedSlide.right_title || '',
    '{{right_body}}': (normalizedSlide.right_body || '').replace(/\n/g, '<br>'),
    // content-grid placeholders
    '{{grid1_icon}}': (normalizedSlide.grid1_icon || '').replace(/\n/g, '<br>'),
    '{{grid1_title}}': (normalizedSlide.grid1_title || '').replace(/\n/g, '<br>'),
    '{{grid1_desc}}': (normalizedSlide.grid1_desc || '').replace(/\n/g, '<br>'),
    '{{grid2_icon}}': (normalizedSlide.grid2_icon || '').replace(/\n/g, '<br>'),
    '{{grid2_title}}': (normalizedSlide.grid2_title || '').replace(/\n/g, '<br>'),
    '{{grid2_desc}}': (normalizedSlide.grid2_desc || '').replace(/\n/g, '<br>'),
    '{{grid3_icon}}': (normalizedSlide.grid3_icon || '').replace(/\n/g, '<br>'),
    '{{grid3_title}}': (normalizedSlide.grid3_title || '').replace(/\n/g, '<br>'),
    '{{grid3_desc}}': (normalizedSlide.grid3_desc || '').replace(/\n/g, '<br>'),
    '{{grid4_icon}}': (normalizedSlide.grid4_icon || '').replace(/\n/g, '<br>'),
    '{{grid4_title}}': (normalizedSlide.grid4_title || '').replace(/\n/g, '<br>'),
    '{{grid4_desc}}': (normalizedSlide.grid4_desc || '').replace(/\n/g, '<br>'),
    // content-bigdata placeholders
    '{{bigdata_number}}': normalizedSlide.bigdata_number || '',
    '{{bigdata_unit}}': normalizedSlide.bigdata_unit || '',
    // magazine style placeholders
    '{{headline_label}}': normalizedSlide.headline_label || '',
    '{{tag1}}': normalizedSlide.tag1 || '',
    '{{tag2}}': normalizedSlide.tag2 || '',
    '{{tag3}}': normalizedSlide.tag3 || '',
    '{{badge_number}}': normalizedSlide.badge_number || '',
    // content-fullimage placeholders
    '{{badge2_text}}': normalizedSlide.badge2_text || '',
    '{{body2}}': (normalizedSlide.body2 || '').replace(/\n/g, '<br>'),
  };

  let result = html;
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Replace all occurrences
    result = result.split(placeholder).join(value);
  }
  // Second pass: replace {{accent_color}} that may exist inside injected data (e.g. SVG icons)
  const accentColor = opts.accent || config.defaults.accent_color;
  result = result.split('{{accent_color}}').join(accentColor);
  return result;
}

function normalizeSlideForRender(slide) {
  if ((slide.type || 'content') !== 'cover') return slide;

  const headline = String(slide.headline || '');
  const seriesMeta = extractSeriesMeta(headline) || extractSeriesMeta(slide.subtext || '');
  if (!seriesMeta) return slide;

  const cleanedHeadline = removeSeriesMeta(headline, seriesMeta.raw);
  const fallbackHeadline = removeSeriesMeta(slide.subtext || '', seriesMeta.raw);
  const nextHeadline = cleanedHeadline || fallbackHeadline || headline;

  return {
    ...slide,
    headline: compactCoverHeadline(stripInlineCodeMarkers(nextHeadline), slide),
    subtext: seriesMeta.label,
  };
}

function extractSeriesMeta(value) {
  const text = String(value || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const match = text.match(/(.+?)\s*공식\s*문서\s*쉽게\s*배우기\s*#?\s*(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;

  const framework = match[1].trim();
  const currentPart = match[2];
  const totalParts = match[3];

  return {
    raw: match[0],
    label: `${framework} 공식문서 쉽게 배우기 #${currentPart}/${totalParts}`,
  };
}

function removeSeriesMeta(value, rawSeriesText) {
  return String(value || '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(rawSeriesText, '')
    .replace(/^[\s:：|\-–—]+/, '')
    .replace(/[\s:：|\-–—]+$/, '')
    .trim();
}

function stripInlineCodeMarkers(value) {
  return String(value || '').replace(/`([^`]+)`/g, '$1');
}

function compactCoverHeadline(headline, slide) {
  const cleaned = String(headline || '').replace(/\s+/g, ' ').trim();
  const topic = extractCoverTopic(slide, cleaned);
  if (!topic) return cleaned;

  const withoutTopic = cleaned
    .replace(new RegExp(`^${escapeRegExp(topic)}\\s*(?:를|을|이|가|은|는)?\\s*`), '')
    .replace(/\s+/g, '')
    .trim();

  if (withoutTopic.length <= 12) return cleaned;

  const compactSuffix = chooseCompactSuffix(cleaned);
  const separator = compactSuffix.startsWith('의 ') ? '' : ', ';
  return `${topic}${separator}${compactSuffix}`;
}

function extractCoverTopic(slide, headline) {
  const source = [
    slide.headline,
    slide.subtext,
    slide.emphasis,
    headline,
  ].filter(Boolean).join(' ');

  const codeMatch = source.match(/`([^`\n]{1,24})`/);
  if (codeMatch) return codeMatch[1].trim();

  const leadingWord = String(headline || '').trim().match(/^([A-Za-z_$][\w$]*)/);
  if (leadingWord) return leadingWord[1];

  return '';
}

function chooseCompactSuffix(text) {
  if (/조심|주의|위험|실수|문제/.test(text)) return '제대로 알기';
  if (/이해|헷갈|알아/.test(text)) return '제대로 알기';
  if (/비교|차이/.test(text)) return '차이 알기';
  if (/기초|기본/.test(text)) return '제대로 알기';
  if (/정리|핵심/.test(text)) return '핵심정리';
  return '한눈에 정리';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main render function.
 * @param {object} opts - Options
 * @param {string} opts.slidesPath - Path to slides.json
 * @param {string} opts.style - Template style (minimal|bold|elegant)
 * @param {string} opts.outputDir - Output directory path
 * @param {string} opts.accent - Accent color hex
 * @param {string} opts.account - Account name string
 */
async function render(opts = {}) {
  const slidesPath = opts.slidesPath || path.join(process.cwd(), config.workspace_dir, 'slides.json');
  const style = opts.style || config.defaults.template;
  const outputDir = opts.outputDir || path.join(process.cwd(), config.output_dir);
  const accent = opts.accent || config.defaults.accent_color;
  const account = opts.account || config.defaults.account_name;

  // Read slides
  if (!fs.existsSync(slidesPath)) {
    throw new Error(`slides.json not found at: ${slidesPath}`);
  }
  const slides = JSON.parse(fs.readFileSync(slidesPath, 'utf8'));

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const templateDir = path.join(__dirname, '..', 'templates', style);
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-crash-reporter',
      '--disable-crashpad',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.env.PUPPETEER_USER_DATA_DIR) {
    launchOptions.userDataDir = process.env.PUPPETEER_USER_DATA_DIR;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.setViewport({
      width: config.dimensions.width,
      height: config.dimensions.height,
    });

    const total = slides.length;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideType = slide.type || 'content';
      const templateFile = path.join(templateDir, `${slideType}.html`);

      if (!fs.existsSync(templateFile)) {
        console.warn(`  Warning: template not found for type "${slideType}", skipping slide ${i + 1}`);
        continue;
      }

      console.log(`Rendering slide ${i + 1}/${total}...`);

      const rawHtml = fs.readFileSync(templateFile, 'utf8');
      const processedHtml = applyPlaceholders(rawHtml, slide, { accent, account }, i, total);

      await page.setContent(processedHtml, { waitUntil: 'networkidle0' });
      await page.mouse.move(0, 0);

      const slideNum = String(i + 1).padStart(2, '0');
      const outputFile = path.join(outputDir, `slide_${slideNum}.png`);

      await page.screenshot({
        path: outputFile,
        clip: {
          x: 0,
          y: 0,
          width: config.dimensions.width,
          height: config.dimensions.height,
        },
      });

      console.log(`  Saved: ${outputFile}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone. ${slides.length} slide(s) rendered to: ${outputDir}`);
}

// Parse CLI arguments
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--slides':
        opts.slidesPath = args[++i];
        break;
      case '--style':
        opts.style = args[++i];
        break;
      case '--output':
        opts.outputDir = args[++i];
        break;
      case '--accent':
        opts.accent = args[++i];
        break;
      case '--account':
        opts.account = args[++i];
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }
  return opts;
}

// Run as CLI if executed directly
if (require.main === module) {
  const opts = parseArgs(process.argv);
  render(opts).catch((err) => {
    console.error('Render failed:', err.message);
    process.exit(1);
  });
}

module.exports = { render };
