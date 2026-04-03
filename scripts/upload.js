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

const BUFFER_TOKEN = process.env.BUFFER_API_TOKEN;
const BUFFER_CHANNEL_ID = process.env.BUFFER_CHANNEL_ID;
const BUFFER_ORG_ID = process.env.BUFFER_ORG_ID;
const BUFFER_API = 'https://api.buffer.com';

// ── CLI Args ────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dir: null, schedule: null, dryRun: false, listChannels: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':
        opts.dir = args[++i];
        break;
      case '--schedule':
        opts.schedule = args[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--list-channels':
        opts.listChannels = true;
        break;
    }
  }

  if (!opts.dir && !opts.listChannels) {
    console.error('Usage:');
    console.error('  node scripts/upload.js --dir output/26-03-17-주제명 [--schedule "2026-03-18T09:00:00+09:00"] [--dry-run]');
    console.error('  node scripts/upload.js --list-channels   # Buffer 채널 목록 조회');
    process.exit(1);
  }

  return opts;
}

// ── Helpers ─────────────────────────────────────────────
function validateEnv(requireBuffer) {
  const cloudinaryKeys = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  const bufferKeys = [
    'BUFFER_API_TOKEN',
  ];

  const required = requireBuffer ? [...cloudinaryKeys, ...bufferKeys] : cloudinaryKeys;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }
}

function getSlideFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^slide_\d+\.png$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function getCaption(dir) {
  const textPath = path.join(dir, 'text.md');
  if (!fs.existsSync(textPath)) return '';
  return fs.readFileSync(textPath, 'utf8').trim();
}

// ── Buffer GraphQL ──────────────────────────────────────
async function bufferQuery(query) {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BUFFER_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  if (data.errors) {
    throw new Error(`Buffer API error: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

async function listChannels() {
  if (!BUFFER_ORG_ID) {
    // First get organizations
    const orgData = await bufferQuery(`
      query GetOrganizations {
        account {
          organizations {
            id
            name
            ownerEmail
          }
        }
      }
    `);
    console.log('\n📋 Organizations:');
    const orgs = orgData.data?.account?.organizations || [];
    orgs.forEach((o) => console.log(`  ID: ${o.id}  Name: ${o.name}`));

    if (orgs.length === 0) {
      console.log('  (none found)');
      return;
    }

    // Get channels for each org
    for (const org of orgs) {
      const chData = await bufferQuery(`
        query {
          channels(input: { organizationId: "${org.id}" }) {
            id
            name
            displayName
            service
            isQueuePaused
          }
        }
      `);
      console.log(`\n📱 Channels for "${org.name}":`);
      const channels = chData.data?.channels || [];
      channels.forEach((ch) => {
        console.log(`  ID: ${ch.id}  Service: ${ch.service}  Name: ${ch.displayName || ch.name}  Paused: ${ch.isQueuePaused}`);
      });
      if (channels.length === 0) console.log('  (none found)');
    }
    return;
  }

  const data = await bufferQuery(`
    query {
      channels(input: { organizationId: "${BUFFER_ORG_ID}" }) {
        id
        name
        displayName
        service
        isQueuePaused
      }
    }
  `);

  console.log('\n📱 Buffer Channels:');
  const channels = data.data?.channels || [];
  channels.forEach((ch) => {
    console.log(`  ID: ${ch.id}  Service: ${ch.service}  Name: ${ch.displayName || ch.name}  Paused: ${ch.isQueuePaused}`);
  });
  if (channels.length === 0) {
    console.log('  (none found)');
    console.log('\n⚠️  채널이 없습니다. 확인사항:');
    console.log('  1. buffer.com → Channels에서 Instagram이 연결되어 있는지 확인');
    console.log('  2. Instagram 계정이 비즈니스/크리에이터 계정인지 확인');
    console.log('     (Instagram → 설정 → 계정 유형 및 도구 → 프로페셔널 계정으로 전환)');
    console.log('  3. 연결된 채널이 있다면 Buffer에서 해제 후 재연결');
  }
}

// ── Steps ───────────────────────────────────────────────

/** 1. Upload images to Cloudinary → public URLs */
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

/** 2. Create post via Buffer GraphQL API */
async function createBufferPost(imageUrls, caption, schedule) {
  console.log('\n📦 Creating Buffer carousel post...');

  const channelId = BUFFER_CHANNEL_ID;
  if (!channelId) {
    throw new Error('BUFFER_CHANNEL_ID not set. Run: node scripts/upload.js --list-channels');
  }

  const imagesArray = imageUrls
    .map((url) => `{ url: "${url}" }`)
    .join(', ');

  // Escape caption for GraphQL
  const escapedCaption = caption
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  let scheduleFields = '';
  if (schedule) {
    const isoDate = typeof schedule === 'string' && schedule.includes('T')
      ? schedule
      : new Date(Number(schedule) * 1000).toISOString();
    scheduleFields = `
      schedulingType: automatic
      mode: customScheduled
      dueAt: "${isoDate}"
    `;
    console.log(`  ⏰ Scheduled for: ${isoDate}`);
  } else {
    scheduleFields = `
      schedulingType: automatic
      mode: shareNow
    `;
  }

  const mutation = `
    mutation {
      createPost(input: {
        text: "${escapedCaption}",
        channelId: "${channelId}",
        ${scheduleFields}
        metadata: {
          instagram: {
            type: post
            shouldShareToFeed: true
          }
        }
        assets: {
          images: [${imagesArray}]
        }
      }) {
        ... on PostActionSuccess {
          post {
            id
            text
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const data = await bufferQuery(mutation);

  const result = data.data?.createPost;
  if (result?.post) {
    console.log(`  ✓ Post created! ID: ${result.post.id}`);
    return result.post.id;
  } else if (result?.message) {
    throw new Error(`Buffer mutation error: ${result.message}`);
  } else {
    throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  }
}

/** 3. Cleanup Cloudinary (optional) */
async function cleanupCloudinary(folderName) {
  try {
    await cloudinary.api.delete_resources_by_prefix(`instagram-card-news/${folderName}`);
    console.log('\n🧹 Cloudinary temp images cleaned up.');
  } catch {
    // non-critical
  }
}

// ── Main ────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  // --list-channels mode
  if (opts.listChannels) {
    if (!BUFFER_TOKEN) {
      console.error('BUFFER_API_TOKEN not set in .env');
      process.exit(1);
    }
    await listChannels();
    return;
  }

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
  console.log('  Instagram Carousel Uploader (via Buffer)');
  console.log('═══════════════════════════════════════════');
  console.log(`  Directory : ${dir}`);
  console.log(`  Slides    : ${files.length}`);
  console.log(`  Caption   : ${caption.length} chars`);
  console.log(`  Schedule  : ${opts.schedule || 'immediate'}`);
  console.log(`  Dry run   : ${opts.dryRun}`);
  console.log('═══════════════════════════════════════════');

  if (opts.dryRun) {
    console.log('\n🏃 Dry run — Cloudinary upload only.\n');
    validateEnv(false);
    const urls = await uploadToCloudinary(files, folderName);
    console.log('\n✅ Dry run complete. Image URLs:');
    urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
    return;
  }

  validateEnv(true);

  // Step 1: Upload to Cloudinary
  const imageUrls = await uploadToCloudinary(files, folderName);

  // Step 2: Create post via Buffer
  await createBufferPost(imageUrls, caption, opts.schedule);

  // Step 3: Cleanup temp images (after Buffer has fetched them — wait a bit)
  console.log('\n⏳ Waiting 30s for Buffer to fetch images...');
  await new Promise((r) => setTimeout(r, 30_000));
  await cleanupCloudinary(folderName);

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ Done! Check Buffer dashboard.');
  console.log('═══════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
