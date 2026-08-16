// api/article.js
export default async function handler(req, res) {
  const userAgent = req.headers['user-agent'] || '';
  const isCrawler = /googlebot|bingbot|baiduspider|yandex|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp/i.test(userAgent);

  const url = new URL(req.url, 'https://cuizi.top');
  const idParam = url.searchParams.get('id');
  const articleId = parseInt(idParam);

  // 普通用户：直接返回 article.html
  if (!isCrawler) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'article.html');
      const html = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    } catch (_) {
      return res.status(200).send('加载失败');
    }
  }

  // 爬虫：返回最简内容（纯文本，去掉所有符号）
  if (!idParam || isNaN(articleId) || articleId < 0) {
    return res.status(200).send('文章不存在');
  }

  try {
    const dataRes = await fetch('https://cuizi.top/wenzhang.json');
    const data = await dataRes.json();
    const articles = data.announcements || [];
    if (articleId >= articles.length || articles[articleId].delete) {
      return res.status(200).send('文章不存在');
    }

    const article = articles[articleId];
    const title = article.title || '无标题';
    const date = article.date || '';
    const content = article.content || '';

    // 去掉所有 Markdown 符号，只保留纯文本
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
      .replace(/\n/g, '<br>')
      .trim();

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} · ks</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 2rem; line-height: 1.8; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p><small>${date}</small></p>
  <hr>
  <div>${plainText}</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(200).send(html);

  } catch (_) {
    return res.status(200).send('加载失败');
  }
}
