const { renderMarkdown } = require('../assets/markdown/markdown-node.js');
const fs = require('fs/promises');
const path = require('path');

async function loadArticles() {
  const filePath = path.join(__dirname, '..', 'articles', 'all.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data.list) ? data.list : [];
  return list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function summarizeHtml(html, maxLength = 150) {
  if (!html) return '';
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = decodeHtmlEntities(text);
  if (text.length > maxLength) text = text.slice(0, maxLength).trim() + '…';
  return text;
}

function getSummary(item) {
  return summarizeHtml(renderMarkdown(item.content || ''));
}

function buildAtom(articles, baseUrl) {
  const now = new Date().toISOString();
  let entriesXml = '';
  for (const item of articles) {
    const id = baseUrl + '/article.html?id=' + item.id;
    const title = escapeXml(item.title || '无标题');
    const updated = new Date(item.date || Date.now()).toISOString();
    const summary = escapeXml(getSummary(item));
    entriesXml += '\n  <entry>\n    <id>' + id + '</id>\n    <title>' + title + '</title>\n    <link href="' + id + '" rel="alternate" />\n    <updated>' + updated + '</updated>\n    <summary type="text">' + summary + '</summary>\n  </entry>';
  }
  return '<?xml version="1.0" encoding="UTF-8" ?>\n<?xml-stylesheet type="text/xsl" href="/assets/feed.xsl"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <id>' + baseUrl + '</id>\n  <title>ks的博客</title>\n  <subtitle>ks的个人博客。保持好奇，保持诚实。</subtitle>\n  <link href="' + baseUrl + '/atom.xml" rel="self" />\n  <link href="' + baseUrl + '" rel="alternate" />\n  <updated>' + now + '</updated>\n  <author><name>ks</name></author>' + entriesXml + '\n</feed>';
}

function buildRSS(articles, baseUrl) {
  const now = new Date().toUTCString();
  let itemsXml = '';
  for (const item of articles) {
    const title = escapeXml(item.title || '无标题');
    const link = baseUrl + '/article.html?id=' + item.id;
    const pubDate = new Date(item.date || Date.now()).toUTCString();
    const description = escapeXml(getSummary(item));
    itemsXml += '\n  <item>\n    <title>' + title + '</title>\n    <link>' + link + '</link>\n    <guid>' + link + '</guid>\n    <pubDate>' + pubDate + '</pubDate>\n    <description>' + description + '</description>\n  </item>';
  }
  return '<?xml version="1.0" encoding="UTF-8" ?>\n<?xml-stylesheet type="text/xsl" href="/assets/feed.xsl"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>ks的博客</title>\n    <link>' + baseUrl + '</link>\n    <description>ks的个人博客。保持好奇，保持诚实。</description>\n    <language>zh-CN</language>\n    <lastBuildDate>' + now + '</lastBuildDate>\n    <atom:link href="' + baseUrl + '/rss.xml" rel="self" type="application/rss+xml" />' + itemsXml + '\n  </channel>\n</rss>';
}

function buildJSONFeed(articles, baseUrl) {
  const items = articles.map(item => {
    const summary = getSummary(item);
    return {
      id: baseUrl + '/article.html?id=' + item.id,
      url: baseUrl + '/article.html?id=' + item.id,
      title: item.title || '无标题',
      date_published: new Date(item.date || Date.now()).toISOString(),
      summary: summary,
      content_text: summary
    };
  });
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'ks的博客',
    home_page_url: baseUrl,
    feed_url: baseUrl + '/feed.json',
    description: 'ks的个人博客。保持好奇，保持诚实。',
    items: items
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const articles = await loadArticles();
    const baseUrl = 'https://www.cuizi.top';
    const type = req.query.type;
    if (type === 'atom') {
      const xml = buildAtom(articles, baseUrl);
      res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).send(xml);
    }
    if (type === 'rss') {
      const xml = buildRSS(articles, baseUrl);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).send(xml);
    }
    if (type === 'json') {
      const json = buildJSONFeed(articles, baseUrl);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).send(JSON.stringify(json, null, 2));
    }
    res.status(400).json({ error: 'Invalid type. Use ?type=atom, ?type=rss, or ?type=json' });
  } catch (error) {
    console.error('Feed 生成失败:', error.stack || error.message);
    res.status(500).send('Feed 生成失败');
  }
};
