'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load config
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const REEL_WIDTH = 1080;
const REEL_HEIGHT = 1920;

/**
 * Replace all template placeholders in HTML content.
 */
function applyPlaceholders(html, scene, opts, index, total) {
  const body = (scene.body || '').replace(/\n/g, '<br>');

  const replacements = {
    '{{headline}}': (scene.headline || '').replace(/\n/g, '<br>'),
    '{{headline_en}}': (scene.headline_en || '').replace(/\n/g, '<br>'),
    '{{emphasis_en}}': (scene.emphasis_en || '').replace(/\n/g, '<br>'),
    '{{subtext}}': (scene.subtext || '').replace(/\n/g, '<br>'),
    '{{body}}': body,
    '{{emphasis}}': (scene.emphasis || '').replace(/\n/g, '<br>'),
    '{{badge_text}}': scene.badge_text || '',
    '{{badge_number}}': scene.badge_number || '',
    '{{cta_text}}': scene.cta_text || '',
    '{{slide_number}}': String(index + 1).padStart(2, '0'),
    '{{total_slides}}': String(total).padStart(2, '0'),
    '{{accent_color}}': opts.accent || config.defaults.accent_color,
    '{{account_name}}': opts.account || config.defaults.account_name,
    // list items
    '{{item1}}': (scene.item1 || '').replace(/\n/g, '<br>'),
    '{{item2}}': (scene.item2 || '').replace(/\n/g, '<br>'),
    '{{item3}}': (scene.item3 || '').replace(/\n/g, '<br>'),
    '{{item4}}': (scene.item4 || '').replace(/\n/g, '<br>'),
    '{{item5}}': (scene.item5 || '').replace(/\n/g, '<br>'),
    // comparison
    '{{left_title}}': scene.left_title || '',
    '{{left_body}}': (scene.left_body || '').replace(/\n/g, '<br>'),
    '{{right_title}}': scene.right_title || '',
    '{{right_body}}': (scene.right_body || '').replace(/\n/g, '<br>'),
    // cta tags
    '{{tag1}}': scene.tag1 || '',
    '{{tag2}}': scene.tag2 || '',
    '{{tag3}}': scene.tag3 || '',
  };

  let result = html;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.split(placeholder).join(value);
  }
  // Second pass for accent_color inside injected content
  const accentColor = opts.accent || config.defaults.accent_color;
  result = result.split('{{accent_color}}').join(accentColor);
  return result;
}

/**
 * Render reel scenes to individual PNGs.
 */
async function renderScenes(opts = {}) {
  const scenesPath = opts.scenesPath || path.join(process.cwd(), config.workspace_dir, 'reels.json');
  const style = opts.style || config.defaults.reel_template || config.defaults.template;
  const outputDir = opts.outputDir || path.join(process.cwd(), config.output_dir);
  const accent = opts.accent || config.defaults.accent_color;
  const account = opts.account || config.defaults.account_name;

  if (!fs.existsSync(scenesPath)) {
    throw new Error(`reels.json not found at: ${scenesPath}`);
  }
  const scenes = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));

  fs.mkdirSync(outputDir, { recursive: true });

  const templateDir = path.join(__dirname, '..', 'templates-reel', style);
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Reel template directory not found: ${templateDir}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.setViewport({ width: REEL_WIDTH, height: REEL_HEIGHT });

    const total = scenes.length;
    const pngFiles = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneType = scene.type || 'point';
      const templateFile = path.join(templateDir, `${sceneType}.html`);

      if (!fs.existsSync(templateFile)) {
        console.warn(`  Warning: reel template not found for type "${sceneType}", skipping scene ${i + 1}`);
        continue;
      }

      console.log(`Rendering scene ${i + 1}/${total} (${sceneType})...`);

      const rawHtml = fs.readFileSync(templateFile, 'utf8');
      const processedHtml = applyPlaceholders(rawHtml, scene, { accent, account }, i, total);

      await page.setContent(processedHtml, { waitUntil: 'networkidle0' });
      await page.mouse.move(0, 0);

      const sceneNum = String(i + 1).padStart(2, '0');
      const outputFile = path.join(outputDir, `scene_${sceneNum}.png`);

      await page.screenshot({
        path: outputFile,
        clip: { x: 0, y: 0, width: REEL_WIDTH, height: REEL_HEIGHT },
      });

      pngFiles.push(outputFile);
      console.log(`  Saved: ${outputFile}`);
    }

    // Generate FFmpeg concat file for video assembly
    const concatFile = path.join(outputDir, 'concat.txt');
    const durations = scenes.map((s) => s.duration || 2.5);
    const lines = pngFiles.map((f, i) => `file '${path.basename(f)}'\nduration ${durations[i]}`);
    // FFmpeg concat requires last file repeated without duration
    if (pngFiles.length > 0) {
      lines.push(`file '${path.basename(pngFiles[pngFiles.length - 1])}'`);
    }
    fs.writeFileSync(concatFile, lines.join('\n'));
    console.log(`\nConcat file: ${concatFile}`);

    return { pngFiles, concatFile, outputDir };
  } finally {
    await browser.close();
  }
}

/**
 * Default BGM path
 */
const DEFAULT_BGM = path.join(__dirname, '..', 'assets', 'bgm', 'deep-urban.mp3');

/**
 * Assemble PNGs into MP4 using FFmpeg.
 */
function assembleVideo(outputDir, outputName = 'reel.mp4', musicPath = null) {
  const concatFile = path.join(outputDir, 'concat.txt');
  if (!fs.existsSync(concatFile)) {
    throw new Error(`concat.txt not found at: ${concatFile}`);
  }

  const absOutputDir = path.resolve(outputDir);
  const absConcatFile = path.resolve(concatFile);
  const outputFile = path.join(absOutputDir, outputName);

  // Check FFmpeg availability
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch {
    console.log('\n⚠️  FFmpeg not found. PNG scenes are ready for manual assembly.');
    console.log('   Install FFmpeg: brew install ffmpeg');
    console.log(`   Then run: cd ${absOutputDir} && ffmpeg -f concat -safe 0 -i concat.txt -vf "fps=30,format=yuv420p" -c:v libx264 -pix_fmt yuv420p reel.mp4`);
    return null;
  }

  // Resolve music file
  const bgm = musicPath || DEFAULT_BGM;
  const hasBgm = fs.existsSync(bgm);

  console.log('\nAssembling video with FFmpeg...');
  if (hasBgm) {
    console.log(`  BGM: ${path.basename(bgm)}`);
  }

  try {
    if (hasBgm) {
      // Step 1: Create silent video
      execSync(
        `ffmpeg -y -f concat -safe 0 -i concat.txt -vf "fps=30,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 "_silent.mp4"`,
        { cwd: absOutputDir, stdio: 'pipe' }
      );
      // Step 2: Get video duration
      const durationStr = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 _silent.mp4`,
        { cwd: absOutputDir, encoding: 'utf8' }
      ).trim();
      const duration = parseFloat(durationStr);
      // Step 3: Merge video + audio (trim & fade out BGM)
      const fadeStart = Math.max(0, duration - 2);
      execSync(
        `ffmpeg -y -i _silent.mp4 -i "${path.resolve(bgm)}" -filter_complex "[1:a]atrim=0:${duration},afade=t=in:st=0:d=1,afade=t=out:st=${fadeStart}:d=2,volume=0.3[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -shortest "${outputName}"`,
        { cwd: absOutputDir, stdio: 'pipe' }
      );
      // Cleanup temp
      fs.unlinkSync(path.join(absOutputDir, '_silent.mp4'));
    } else {
      execSync(
        `ffmpeg -y -f concat -safe 0 -i concat.txt -vf "fps=30,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 "${outputName}"`,
        { cwd: absOutputDir, stdio: 'pipe' }
      );
    }
    console.log(`\nVideo saved: ${outputFile}`);
    return outputFile;
  } catch (err) {
    console.error('FFmpeg assembly failed:', err.message);
    return null;
  }
}

/**
 * Full render pipeline: scenes → PNGs → MP4
 */
async function render(opts = {}) {
  const result = await renderScenes(opts);
  console.log(`\n${result.pngFiles.length} scene(s) rendered to: ${result.outputDir}`);

  if (!opts.pngOnly) {
    assembleVideo(result.outputDir, 'reel.mp4', opts.music);
  }

  return result;
}

// Parse CLI arguments
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scenes': opts.scenesPath = args[++i]; break;
      case '--style': opts.style = args[++i]; break;
      case '--output': opts.outputDir = args[++i]; break;
      case '--accent': opts.accent = args[++i]; break;
      case '--account': opts.account = args[++i]; break;
      case '--png-only': opts.pngOnly = true; break;
      case '--music': opts.music = args[++i]; break;
      case '--no-music': opts.music = '__none__'; break;
      default: console.warn(`Unknown argument: ${args[i]}`);
    }
  }
  return opts;
}

if (require.main === module) {
  const opts = parseArgs(process.argv);
  render(opts).catch((err) => {
    console.error('Reel render failed:', err.message);
    process.exit(1);
  });
}

module.exports = { render, renderScenes, assembleVideo };
