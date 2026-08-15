// api/feed.js
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

    const items = filtered.map(item => {
      const index = articles.indexOf(item);
      return {
        id: `${baseUrl}/article.html?id=${index}`,
        url: `${baseUrl}/article.html?id=${index}`,
        title: item.title || '无标题',
        date_published: new Date(item.date).toISOString(),
        content_html: renderMarkdown(item.content || '')
      };
    });

    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'ks的博客',
      home_page_url: baseUrl,
      feed_url: `${baseUrl}/feed.json`,
      description: 'ks的个人博客。保持好奇，保持诚实。',
      items: items
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).json(feed);
  } catch (error) {
    console.error('JSON Feed 生成失败:', error.message);
    res.status(500).json({ error: 'JSON Feed 生成失败' });
  }
        }
