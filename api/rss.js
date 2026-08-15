export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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

    if (!response.ok) {
      throw new Error(`GitHub API 失败: ${response.status}`);
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const json = JSON.parse(content);
    const articles = json.announcements || [];

    const filtered = articles
      .filter(item => !item.delete)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 20);

    const baseUrl = 'https://cuizi.top';
    const now = new Date().toUTCString();

    let itemsXml = '';
    filtered.forEach(item => {
      const index = articles.indexOf(item);
      const title = escapeXml(item.title || '无标题');
      const link = `${baseUrl}/article.html?id=${index}`;
      const pubDate = new Date(item.date).toUTCString();
      const description = escapeXml(item.content ? item.content : '');
      const guid = `${baseUrl}/article.html?id=${index}`;

      itemsXml += `
  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid>${guid}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${description}</description>
  </item>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ks的博客</title>
    <link>${baseUrl}</link>
    <description>ks的个人博客。保持好奇，保持诚实。</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/api/rss" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).send(xml);
  } catch (error) {
    console.error('RSS 生成失败:', error.message);
    res.status(500).send('RSS 生成失败');
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function(c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}      const title = escapeXml(item.title || '无标题');
      const link = `${baseUrl}/article.html?id=${index}`;
      const pubDate = new Date(item.date).toUTCString();
      const description = escapeXml(item.content ? item.content.slice(0, 200) : '');
      const guid = `${baseUrl}/article.html?id=${index}`;

      itemsXml += `
  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid>${guid}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${description}…</description>
  </item>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ks的博客</title>
    <link>${baseUrl}</link>
    <description>ks的个人博客。保持好奇，保持诚实。</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/api/rss" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).send(xml);
  } catch (error) {
    console.error('RSS 生成失败:', error.message);
    res.status(500).send('RSS 生成失败');
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function(c) {
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
