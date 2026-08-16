// api/article.js
import { renderMarkdown } from '../assets/markdown/markdown-node.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const userAgent = req.headers['user-agent'] || '';
  const isCrawler = /googlebot|bingbot|baiduspider|yandex|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp/i.test(userAgent);

  // 解析 ?id=xxx
  const url = new URL(req.url, 'https://cuizi.top');
  const idParam = url.searchParams.get('id');
  const articleId = parseInt(idParam);

  // ============ 普通用户：返回 SPA 入口 ============
  if (!isCrawler) {
    // 读取 index.html（放在项目根目录）
    const indexPath = path.join(process.cwd(), 'index.html');
    try {
      const html = fs.readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);   // 状态码 200，无重定向
    } catch (err) {
      // 如果文件不存在，返回一个最小骨架
      return res.status(200).send(`
        <!DOCTYPE html>
        <html><head><title>ks</title></head><body>
          <div id="app">加载中...</div>
          <script src="/assets/app.js"></script>
        </body></html>
      `);
    }
  }

  // ============ 爬虫：预渲染完整文章页 ============
  if (isNaN(articleId) || articleId < 0) {
    return res.status(404).send('<h1>文章不存在</h1>');
  }

  try {
    // 获取文章数据（支持本地读取或远程 fetch，这里用 fetch 更灵活）
    const dataRes = await fetch('https://cuizi.top/wenzhang.json');
    if (!dataRes.ok) throw new Error('无法获取文章数据');
    const data = await dataRes.json();
    const articles = data.announcements || [];

    if (articleId >= articles.length || articles[articleId].delete) {
      return res.status(404).send('<h1>文章不存在或已删除</h1>');
    }

    const article = articles[articleId];
    const title = article.title || '无标题';
    const date = article.date || '';
    const content = article.content || '';

    // 渲染 Markdown → HTML
    const renderedHtml = renderMarkdown(content);

    // 生成纯文本描述（供 meta description）
    const plainText = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-\d>]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150);

    // 构造完整 HTML（包含文章内容）
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} · ks</title>
  <meta name="description" content="${plainText}">
  <link rel="icon" href="/favicon.ico">
  <!-- Open Graph / Twitter Card 可加 -->
  <style>
    /* 精简样式（与你的站点保持一致） */
    body { font-family: 'Inter', sans-serif; background: #FAFAFE; color: #1A1A2E; line-height: 1.8; padding: 2.8rem 1.8rem; max-width: 700px; margin: 0 auto; }
    .detail-title { font-size: 2rem; font-weight: 700; margin-bottom: 0.3rem; }
    .detail-date { font-size: 0.85rem; color: #8A8AB5; display: block; margin-bottom: 0.6rem; }
    .detail-content { font-size: 1rem; line-height: 1.9; }
    .detail-content p { margin-bottom: 0.8rem; }
    .detail-content img { max-width: 100%; height: auto; border-radius: 12px; margin: 0.8rem 0; }
    .detail-content h1, h2, h3 { font-weight: 700; margin: 1.2rem 0 0.6rem; }
    .detail-content code { font-family: monospace; background: rgba(0,0,0,0.06); padding: 0.1rem 0.4rem; border-radius: 4px; }
    .detail-content blockquote { border-left: 4px solid #6B5ACF; padding-left: 1.2rem; margin: 0.8rem 0; color: #6A6A92; }
    .detail-content hr { border: none; border-top: 2px solid rgba(0,0,0,0.08); margin: 1.5rem 0; }
    .back-link { display: inline-block; margin-top: 2rem; color: #6B5ACF; text-decoration: none; font-weight: 500; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="detail-title">${title}</div>
  <span class="detail-date">${date}</span>
  <hr>
  <div class="detail-content">${renderedHtml}</div>
  <a href="https://cuizi.top" class="back-link">← 回到首页</a>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (error) {
    console.error('预渲染失败:', error);
    // 降级：返回 SPA 入口（用户可能会看到动态加载，但至少不会报错）
    const indexPath = path.join(process.cwd(), 'index.html');
    try {
      const fallbackHtml = fs.readFileSync(indexPath, 'utf-8');
      return res.status(200).send(fallbackHtml);
    } catch {
      return res.status(500).send('服务器错误，请稍后重试');
    }
  }
  }
