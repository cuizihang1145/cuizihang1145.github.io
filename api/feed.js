import { renderMarkdown } from '../assets/markdown/markdown-node.js';
import fs from 'fs/promises';
import path from 'path';

async function loadArticles() {
  const filePath = path.join(process.cwd(), 'articles', 'all.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const list = data.list || [];
  return list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, c => {
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

function buildAtom(articles, baseUrl) {
  const now = new Date().toISOString();
  let entriesXml = '';
  articles.forEach(item => {
    const id = `${baseUrl}/article.html?id=${item.id}`;
    const title = escapeXml(item.title || '无标题');
    const updated = new Date(item.date).toISOString();
    const rawHtml = renderMarkdown(item.content || '');
    const htmlContent = escapeXml(rawHtml);
    entriesXml += `
  <entry>
    <id>${id}</id>
    <title>${title}</title>
    <link href="${id}" rel="alternate" />
    <updated>${updated}</updated>
    <content type="html">${htmlContent}</content>
  </entry>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" ?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${baseUrl}</id>
  <title>ks的博客</title>
  <subtitle>ks的个人博客。保持好奇，保持诚实。</subtitle>
  <link href="${baseUrl}/atom.xml" rel="self" />
  <link href="${baseUrl}" rel="alternate" />
  <updated>${now}</updated>
  <author><name>ks</name></author>
  ${entriesXml}
</feed>`;
}

function buildRSS(articles, baseUrl) {
  const now = new Date().toUTCString();
  let itemsXml = '';
  articles.forEach(item => {
    const title = escapeXml(item.title || '无标题');
    const link = `${baseUrl}/article.html?id=${item.id}`;
    const pubDate = new Date(item.date).toUTCString();
    const description = renderMarkdown(item.content || '');
    itemsXml += `
  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid>${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <description><![CDATA[${description}]]></description>
  </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ks的博客</title>
    <link>${baseUrl}</link>
    <description>ks的个人博客。保持好奇，保持诚实。</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;
}

function buildJSONFeed(articles, baseUrl) {
  const items = articles.map(item => ({
    id: `${baseUrl}/article.html?id=${item.id}`,
    url: `${baseUrl}/article.html?id=${item.id}`,
    title: item.title || '无标题',
    date_published: new Date(item.date).toISOString(),
    content_html: renderMarkdown(item.content || '')
  }));
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'ks的博客',
    home_page_url: baseUrl,
    feed_url: `${baseUrl}/feed.json`,
    description: 'ks的个人博客。保持好奇，保持诚实。',
    items
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const articles = await loadArticles();
    const baseUrl = 'https://cuizi.top';
    const { type } = req.query;
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
      return res.status(200).json(json);
    }
    res.status(400).json({ error: 'Invalid type. Use ?type=atom, ?type=rss, or ?type=json' });
  } catch (error) {
    console.error('Feed 生成失败:', error.message);
    res.status(500).send('Feed 生成失败');
  }
}