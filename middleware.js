// middleware.js
export default async function middleware(req) {
  const url = new URL(req.url);
  // 只处理 /article 路径
  if (url.pathname !== '/article') {
    return NextResponse.next();
  }

  const userAgent = req.headers.get('user-agent') || '';
  const isCrawler = /googlebot|bingbot|baiduspider|yandex|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp/i.test(userAgent);

  // 普通用户：直接放行，Vercel 会返回静态的 article.html
  if (!isCrawler) {
    return NextResponse.next();
  }

  // 爬虫：预渲染文章
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
      return new Response('文章不存在或已删除', { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    const article = articles[articleId];
    const title = article.title || '无标题';
    const date = article.date || '';
    const content = article.content || '';

    // 这里需要你的 Markdown 渲染函数，可以 import 或内联
    // 简化示例：直接用文本
    const html = `<!DOCTYPE html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>${date}</p><div>${content}</div></body></html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 's-maxage=86400' }
    });
  } catch {
    return new Response('加载失败', { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
}

// 配置匹配路径
export const config = {
  matcher: '/article',
};
