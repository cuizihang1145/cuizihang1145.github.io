import { renderMarkdown } from '../assets/markdown/markdown-node.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type } = req.query;

  if (type === 'robots') {
    const robots = `
User-agent: *
Allow: /

Disallow: /api/
Disallow: /assets/

Sitemap: https://cuizi.top/sitemap.xml
`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(robots);
  }

  if (type === 'sitemap') {
    try {
      const TOKEN = process.env.TOKEN;
      const url = 'https://api.github.com/repos/cuizihang1145/cuizihang1145.github.io/contents/wenzhang.json';
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${TOKEN}`,
          'User-Agent': 'ks-admin',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) throw new Error(`GitHub API 失败: ${response.status}`);
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const json = JSON.parse(content);
      const articles = json.announcements || [];

      const baseUrl = 'https://cuizi.top';
      const now = new Date().toISOString().split('T')[0];

      const pages = [
        { loc: '/', priority: 1.0, changefreq: 'daily' },
        { loc: '/shuoshuo.html', priority: 0.9, changefreq: 'weekly' },
        { loc: '/fuqin.html', priority: 0.8, changefreq: 'yearly' },
        { loc: '/muqin.html', priority: 0.8, changefreq: 'yearly' },
        { loc: '/nordownload.html', priority: 0.7, changefreq: 'monthly' },
        { loc: '/zhuanhuandownload.html', priority: 0.7, changefreq: 'monthly' },
        { loc: '/youlian.html', priority: 0.7, changefreq: 'monthly' },
      ];

      articles.forEach((item, originalIndex) => {
        if (item.delete) return;
        pages.push({
          loc: `/article.html?id=${originalIndex}`,
          priority: 0.9,
          changefreq: 'monthly',
          lastmod: item.date || now,
        });
      });

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
      pages.forEach(p => {
        const fullUrl = baseUrl + p.loc;
        const lastmod = p.lastmod || now;
        xml += `  <url>
    <loc>${escapeXml(fullUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>
`;
      });
      xml += `</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=600');
      return res.status(200).send(xml);
    } catch (error) {
      console.error('Sitemap 生成失败:', error.message);
      return res.status(500).send('Sitemap 生成失败');
    }
  }

  res.status(400).send('Invalid type parameter. Use ?type=robots or ?type=sitemap');
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