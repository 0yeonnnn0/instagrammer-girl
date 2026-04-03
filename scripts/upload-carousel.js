'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { extractHashtags, removeHashtagsFromCaption, postComment } = require('./instagram-comment');

const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const IG_API = 'https://graph.instagram.com/v21.0';

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
    console.error('Usage: node scripts/upload-carousel.js --dir output/26-03-21-주제명 [--dry-run]');
    process.exit(1);
  }
  return opts;
}

function validateEnv() {
  const required = [
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function getSlideFiles(dir) {
  return fs.readdirSync(dir)
    .filter((f) => /^slide_\d+\.png$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function getCaption(dir) {
  const textPath = path.join(dir, 'text.md');
  if (!fs.existsSync(textPath)) return '';
  return fs.readFileSync(textPath, 'utf8').trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Step 1: Upload images to Cloudinary */
async function uploadToCloudinary(files, folderName) {
  console.log(`\n📤 Uploading ${files.length} images to Cloudinary...`);
  const urls = [];
  for (const file of files) {
    const name = path.basename(file, '.png');
    const result = await cloudinary.uploader.upload(file, {
      folder: `instagram-card-news/${folderName}`,
      public_id: name,
      overwrite: true,
    });
    urls.push(result.secure_url);
    console.log(`  ✓ ${name} → ${result.secure_url}`);
  }
  return urls;
}

/** Step 2: Create individual media containers for each image */
async function createItemContainers(imageUrls) {
  console.log('\n📦 Creating carousel item containers...');
  const containerIds = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const params = new URLSearchParams({
      image_url: imageUrls[i],
      is_carousel_item: 'true',
      access_token: IG_ACCESS_TOKEN,
    });

    const res = await fetch(`${IG_API}/${IG_ACCOUNT_ID}/media`, {
      method: 'POST',
      body: params,
    });
    const data = await res.json();

    if (data.error) {
      throw new Error(`Item container ${i + 1} failed: ${data.error.message}`);
    }

    containerIds.push(data.id);
    console.log(`  ✓ slide ${i + 1}/${imageUrls.length} → ${data.id}`);
  }

  return containerIds;
}

/** Step 3: Create carousel container */
async function createCarouselContainer(containerIds, caption) {
  console.log('\n📦 Creating carousel container...');

  const params = new URLSearchParams({
    media_type: 'CAROUSEL',
    caption: caption,
    children: containerIds.join(','),
    access_token: IG_ACCESS_TOKEN,
  });

  const res = await fetch(`${IG_API}/${IG_ACCOUNT_ID}/media`, {
    method: 'POST',
    body: params,
  });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Carousel container failed: ${data.error.message}`);
  }

  console.log(`  ✓ Carousel container: ${data.id}`);
  return data.id;
}

/** Step 4: Wait for container to be ready */
async function waitForContainer(containerId) {
  console.log('\n⏳ Processing...');
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code,status&access_token=${IG_ACCESS_TOKEN}`
    );
    const data = await res.json();

    if (data.status_code === 'FINISHED') {
      console.log('  ✓ Processing complete!');
      return true;
    }
    if (data.status_code === 'ERROR') {
      throw new Error(`Processing failed: ${data.status || 'Unknown error'}`);
    }

    process.stdout.write(`  ... ${data.status_code || 'IN_PROGRESS'} (${i + 1}/${maxAttempts})\r`);
    await sleep(3000);
  }
  throw new Error('Timeout: processing took too long');
}

/** Step 5: Publish */
async function publishCarousel(containerId) {
  console.log('\n🚀 Publishing carousel...');

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

  console.log(`  ✓ Published! Media ID: ${data.id}`);
  return data.id;
}

/** Get permalink */
async function getPermalink(mediaId) {
  const res = await fetch(
    `${IG_API}/${mediaId}?fields=permalink&access_token=${IG_ACCESS_TOKEN}`
  );
  const data = await res.json();
  return data.permalink || '';
}

/** Cleanup */
async function cleanupCloudinary(folderName) {
  try {
    await cloudinary.api.delete_resources_by_prefix(`instagram-card-news/${folderName}`);
    console.log('\n🧹 Cloudinary temp images cleaned up.');
  } catch { }
}

async function main() {
  const opts = parseArgs();
  const dir = path.resolve(opts.dir);

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  const files = getSlideFiles(dir);
  if (files.length === 0) {
    console.error(`No slide_XX.png files found in ${dir}`);
    process.exit(1);
  }

  const caption = getCaption(dir);
  const folderName = path.basename(dir);

  console.log('═══════════════════════════════════════════');
  console.log('  Instagram Carousel Uploader (Direct API)');
  console.log('═══════════════════════════════════════════');
  console.log(`  Directory : ${dir}`);
  console.log(`  Slides    : ${files.length}`);
  console.log(`  Caption   : ${caption.length} chars`);
  console.log(`  Dry run   : ${opts.dryRun}`);
  console.log('═══════════════════════════════════════════');

  validateEnv();

  // Step 1: Upload to Cloudinary
  const imageUrls = await uploadToCloudinary(files, folderName);

  if (opts.dryRun) {
    console.log('\n✅ Dry run complete. Image URLs:');
    imageUrls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
    return;
  }

  // Extract hashtags for first comment
  const hashtags = extractHashtags(caption);
  const cleanCaption = hashtags ? removeHashtagsFromCaption(caption) : caption;

  // Step 2: Create item containers
  const itemIds = await createItemContainers(imageUrls);

  // Step 3: Create carousel container
  const carouselId = await createCarouselContainer(itemIds, cleanCaption);

  // Step 4: Wait for processing
  await waitForContainer(carouselId);

  // Step 5: Publish
  const mediaId = await publishCarousel(carouselId);

  // Get permalink
  const permalink = await getPermalink(mediaId);

  // Post hashtags as first comment
  if (hashtags) {
    await postComment(mediaId, hashtags, IG_ACCESS_TOKEN);
  }

  // Cleanup
  await sleep(3000);
  await cleanupCloudinary(folderName);

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ Carousel published successfully!');
  console.log(`  🔗 ${permalink}`);
  console.log('═══════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
