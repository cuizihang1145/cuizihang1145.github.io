import { NextResponse } from 'next/server';

export default async function middleware(req) {
  const url = new URL(req.url);
  if (url.pathname !== '/article') {
    return NextResponse.next();
  }

  const userAgent = req.headers.get('user-agent') || '';
  const isCrawler = /googlebot|bingbot|baiduspider|yandex|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp/i.test(userAgent);

  if (!isCrawler) {
    return NextResponse.next();
  }

  const idParam = url.searchParams.get('id');
  const articleId = parseInt(idParam);
  if (!idParam || isNaN(articleId) || articleId < 0) {
    return new Response('文章不存在', { status: 200, headers: { 'Content-Type': 'text/html' } });
  }

  try {
    const dataRes = await fetch('https://cuizi.top/wenzhang.json');
    const data = await dataRes.json();
    const articles = data.announcements || [];
    if (articleId >= articles.length || articles[articleId].delete) {
      return new Response('文章不存在', { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    const article = articles[articleId];
    const title = article.title || '无标题';
    const date = article.date || '';
    const content = article.content || '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} · ks</title>
</head>
<body>
  <h1>${title}</h1>
  <p>${date}</p>
  <hr>
  <pre>${content}</pre>
  <hr>
  <p><a href="https://cuizi.top">← 回到首页</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 's-maxage=86400' },
    });

  } catch (_) {
    return new Response('加载失败', { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
}

export const config = {
  matcher: '/article',
};
