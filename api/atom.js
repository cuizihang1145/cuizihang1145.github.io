// api/atom.js
import { renderMarkdown } from '../assets/markdown/markdown-node.js';

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
    const now = new Date().toISOString();

    let entriesXml = '';
    filtered.forEach(item => {
      const index = articles.indexOf(item);
      const id = `${baseUrl}/article.html?id=${index}`;
      const title = escapeXml(item.title || '无标题');
      const updated = new Date(item.date).toISOString();
      const htmlContent = renderMarkdown(item.content || '');

      entriesXml += `
  <entry>
    <id>${id}</id>
    <title>${title}</title>
    <link href="${id}" rel="alternate" />
    <updated>${updated}</updated>
    <content type="html"><![CDATA[${htmlContent}]]></content>
  </entry>`;
    });

    const atom = `<?xml version="1.0" encoding="UTF-8" ?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${baseUrl}</id>
  <title>ks的博客</title>
  <subtitle>ks的个人博客。保持好奇，保持诚实。</subtitle>
  <link href="${baseUrl}/atom.xml" rel="self" />
  <link href="${baseUrl}" rel="alternate" />
  <updated>${now}</updated>
  <author>
    <name>ks</name>
  </author>
  ${entriesXml}
</feed>`;

    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).send(atom);
  } catch (error) {
    console.error('Atom 生成失败:', error.message);
    res.status(500).send('Atom 生成失败');
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
