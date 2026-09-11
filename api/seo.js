export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (type === 'robots') {
    const robots = `
User-agent: *
Allow: /

Disallow: /api/
Disallow: /assets/

Sitemap: https://cuizi.top/sitemap.xml
`;
    return new Response(robots, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  if (type === 'sitemap') {
    try {
      const TOKEN = process.env.TOKEN;
      const url = 'https://api.github.com/repos/cuizihang1145/cuizihang1145.github.io/contents/wenzhang.json';
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${TOKEN}`,
          'User-Agent': 'ks-admin',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) throw new Error(`GitHub API 失败: ${response.status}`);
      const data = await response.json();
      const binary = atob(data.content.replace(/\n/g, ''));
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const content = new TextDecoder().decode(bytes);
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

      return new Response(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=600',
        },
      });
    } catch (error) {
      console.error('Sitemap 生成失败:', error.message);
      return new Response('Sitemap 生成失败', { status: 500 });
    }
  }

  return new Response('Invalid type parameter. Use ?type=robots or ?type=sitemap', { status: 400 });
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