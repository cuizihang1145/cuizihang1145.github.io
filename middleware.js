// middleware.js
import { NextResponse } from 'next/server';
import { renderMarkdown } from './assets/markdown/markdown-node.js';

export const runtime = 'nodejs';

export default async function middleware(req) {
  try {
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

    const dataRes = await fetch('https://cuizi.top/wenzhang.json');
    if (!dataRes.ok) throw new Error('无法获取文章数据');
    const data = await dataRes.json();
    const articles = data.announcements || [];
    if (articleId >= articles.length || articles[articleId].delete) {
      return new Response('文章不存在或已删除', { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    const article = articles[articleId];
    const title = article.title || '无标题';
    const date = article.date || '';
    const content = article.content || '';

    const renderedHtml = renderMarkdown(content);

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

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} · ks</title>
  <meta name="description" content="${plainText}">
  <link rel="icon" href="/favicon.ico">
  <style>
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

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 's-maxage=86400' },
    });

  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: '/article',
};
