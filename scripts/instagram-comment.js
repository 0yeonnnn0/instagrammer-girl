'use strict';

const IG_API = 'https://graph.instagram.com/v21.0';

/**
 * Extract hashtags from caption text.md
 * Splits caption at "—" separator and takes the hashtag block.
 */
function extractHashtags(caption) {
  const parts = caption.split('—');
  if (parts.length < 2) return null;

  const lastPart = parts[parts.length - 1];
  const hashtags = lastPart.match(/#\S+/g);
  if (!hashtags || hashtags.length === 0) return null;

  return hashtags.join(' ');
}

/**
 * Remove hashtags from caption (keep only content above "—" separator).
 */
function removeHashtagsFromCaption(caption) {
  const parts = caption.split('—');
  if (parts.length < 2) return caption;

  // Keep everything before the last "—" separator
  return parts.slice(0, -1).join('—').trim();
}

/**
 * Post a comment on a media object.
 */
async function postComment(mediaId, commentText, accessToken) {
  const params = new URLSearchParams({
    message: commentText,
    access_token: accessToken,
  });

  const res = await fetch(`${IG_API}/${mediaId}/comments`, {
    method: 'POST',
    body: params,
  });

  const data = await res.json();

  if (data.error) {
    console.error(`  ⚠️ Comment failed: ${data.error.message}`);
    return null;
  }

  console.log(`  ✓ First comment posted (hashtags)`);
  return data.id;
}

module.exports = { extractHashtags, removeHashtagsFromCaption, postComment };
