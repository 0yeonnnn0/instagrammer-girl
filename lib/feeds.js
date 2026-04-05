'use strict';

async function fetchHackerNews() {
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
    return stories.filter(s => s && s.title).map(s => ({
      source: 'hackernews',
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score || 0,
    }));
  } catch {
    return [];
  }
}

async function fetchDevTo() {
  try {
    const res = await fetch('https://dev.to/feed', { headers: { Accept: 'application/xml' } });
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/) || [])[1];
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1];
      if (title) items.push({ source: 'devto', title: title.trim(), url: link || '' });
    }
    return items;
  } catch {
    return [];
  }
}

async function collectFeeds(account) {
  const results = [];
  const tasks = [];
  if (account.rss_hackernews) tasks.push(fetchHackerNews());
  if (account.rss_devto) tasks.push(fetchDevTo());
  const settled = await Promise.allSettled(tasks);
  for (const result of settled) {
    if (result.status === 'fulfilled') results.push(...result.value);
  }
  return results.length > 0 ? results : null;
}

module.exports = { collectFeeds };
