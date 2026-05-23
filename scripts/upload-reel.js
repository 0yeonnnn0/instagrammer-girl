'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// ── Config ──────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { extractHashtags, removeHashtagsFromCaption, postComment } = require('./instagram-comment');

const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const IG_API = 'https://graph.facebook.com/v21.0';
const MAX_REEL_CAPTION_LENGTH = 1800;

// ── CLI Args ────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dir: null, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir': opts.dir = args[++i]; break;
      case '--dry-run': opts.dryRun = true; break;
    }
  }

  if (!opts.dir) {
    console.error('Usage:');
    console.error('  node scripts/upload-reel.js --dir output/26-03-21-DGX-Spark-reel [--dry-run]');
    process.exit(1);
  }

  return opts;
}

// ── Helpers ─────────────────────────────────────────────
function validateEnv() {
  const required = [
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    console.error('\n설정 방법:');
    console.error('  1. https://developers.facebook.com 에서 앱 생성');
    console.error('  2. Instagram Graph API 권한 추가');
    console.error('  3. 장기 토큰 발급 후 .env에 추가:');
    console.error('     INSTAGRAM_ACCESS_TOKEN=your_token');
    console.error('     INSTAGRAM_ACCOUNT_ID=your_ig_business_account_id');
    process.exit(1);
  }
}

function getCaption(dir) {
  const textPath = path.join(dir, 'text.md');
  if (!fs.existsSync(textPath)) return '';
  return fs.readFileSync(textPath, 'utf8').trim();
}

function truncateCaption(caption, maxLength = MAX_REEL_CAPTION_LENGTH) {
  if (caption.length <= maxLength) return caption;

  const hashtags = extractHashtags(caption);
  const body = hashtags ? removeHashtagsFromCaption(caption) : caption;
  const suffix = hashtags ? `\n\n${hashtags}` : '';
  const available = Math.max(0, maxLength - suffix.length - 4);
  const truncatedBody = body.slice(0, available).trimEnd();
  const result = `${truncatedBody}...\n\n${hashtags || ''}`.trim();

  console.log(`  ⚠️ Caption truncated from ${caption.length} to ${result.length} chars`);
  return result;
}

function getVideoFile(dir) {
  const mp4 = path.join(dir, 'reel.mp4');
  if (fs.existsSync(mp4)) return mp4;
  throw new Error(`reel.mp4 not found in ${dir}. Run render-reel.js first.`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Instagram Graph API ─────────────────────────────────

/** Step 1: Upload video to Cloudinary → public URL */
async function uploadToCloudinary(videoPath, folderName) {
  console.log('\n📤 Uploading video to Cloudinary...');

  const result = await cloudinary.uploader.upload(videoPath, {
    folder: `instagram-reels/${folderName}`,
    public_id: 'reel',
    resource_type: 'video',
    overwrite: true,
  });

  console.log(`  ✓ Uploaded → ${result.secure_url}`);
  return result.secure_url;
}

/** Step 2: Create Reel media container */
async function createReelContainer(videoUrl, caption) {
  console.log('\n📦 Creating Reel container...');

  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption,
    share_to_feed: 'true',
    access_token: IG_ACCESS_TOKEN,
  });

  const res = await fetch(`${IG_API}/${IG_ACCOUNT_ID}/media`, {
    method: 'POST',
    body: params,
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`Container creation failed: ${data.error.message}`);
  }

  console.log(`  ✓ Container created: ${data.id}`);
  return data.id;
}

/** Step 3: Poll container status until ready */
async function waitForContainer(containerId) {
  console.log('\n⏳ Processing video...');

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code,status&access_token=${IG_ACCESS_TOKEN}`
    );
    const data = await res.json();

    if (data.status_code === 'FINISHED') {
      console.log('  ✓ Video processing complete!');
      return true;
    }

    if (data.status_code === 'ERROR') {
      throw new Error(`Video processing failed: ${data.status || 'Unknown error'}`);
    }

    const status = data.status_code || 'IN_PROGRESS';
    process.stdout.write(`  ... ${status} (${i + 1}/${maxAttempts})\r`);
    await sleep(5000);
  }

  throw new Error('Timeout: video processing took too long');
}

/** Step 4: Publish the Reel */
async function publishReel(containerId) {
  console.log('\n🚀 Publishing Reel...');

  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: IG_ACCESS_TOKEN,
  });

  const res = await fetch(`${IG_API}/${IG_ACCOUNT_ID}/media_publish`, {
    method: 'POST',
    body: params,
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`Publish failed: ${data.error.message}`);
  }

  console.log(`  ✓ Reel published! Media ID: ${data.id}`);
  return data.id;
}

/** Get permalink for published media */
async function getPermalink(mediaId) {
  const res = await fetch(
    `${IG_API}/${mediaId}?fields=permalink,shortcode&access_token=${IG_ACCESS_TOKEN}`
  );
  const data = await res.json();
  return data.permalink || `https://www.instagram.com/reel/${data.shortcode || ''}`;
}

/** Cleanup Cloudinary temp video */
async function cleanupCloudinary(folderName) {
  try {
    await cloudinary.api.delete_resources_by_prefix(`instagram-reels/${folderName}`, {
      resource_type: 'video',
    });
    console.log('\n🧹 Cloudinary temp video cleaned up.');
  } catch {
    // non-critical
  }
}

// ── Main ────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const dir = path.resolve(opts.dir);

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  const videoPath = getVideoFile(dir);
  const caption = truncateCaption(getCaption(dir));
  const folderName = path.basename(dir);

  console.log('═══════════════════════════════════════════');
  console.log('  Instagram Reel Uploader');
  console.log('═══════════════════════════════════════════');
  console.log(`  Directory : ${dir}`);
  console.log(`  Video     : ${path.basename(videoPath)}`);
  console.log(`  Caption   : ${caption.length} chars`);
  console.log(`  Dry run   : ${opts.dryRun}`);
  console.log('═══════════════════════════════════════════');

  // Dry run: only upload to Cloudinary
  if (opts.dryRun) {
    validateEnv();
    console.log('\n🏃 Dry run — Cloudinary upload only.\n');
    const videoUrl = await uploadToCloudinary(videoPath, folderName);
    console.log('\n✅ Dry run complete.');
    console.log(`  Video URL: ${videoUrl}`);
    return;
  }

  validateEnv();

  // Step 1: Upload video to Cloudinary
  const videoUrl = await uploadToCloudinary(videoPath, folderName);

  // Extract hashtags for first comment, remove from caption
  const hashtags = extractHashtags(caption);
  const cleanCaption = hashtags ? removeHashtagsFromCaption(caption) : caption;

  // Step 2: Create Reel container
  const containerId = await createReelContainer(videoUrl, cleanCaption);

  // Step 3: Wait for processing
  await waitForContainer(containerId);

  // Step 4: Publish
  const mediaId = await publishReel(containerId);

  // Get permalink
  const permalink = await getPermalink(mediaId);

  // Step 5: Post hashtags as first comment
  if (hashtags) {
    await postComment(mediaId, hashtags, IG_ACCESS_TOKEN);
  }

  // Step 6: Cleanup
  await sleep(5000);
  await cleanupCloudinary(folderName);

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ Reel published successfully!');
  console.log(`  🔗 ${permalink}`);
  console.log('═══════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
