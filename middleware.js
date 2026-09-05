export default async function middleware(request) {
  if (request.headers.get('x-middleware-internal') === 'true') {
    return;
  }

  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  const isBot = /bingbot|baiduspider|googlebot|slurp|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|applebot|bot|crawler|spider/i.test(userAgent);

  if (!isBot) {
    return;
  }

  const pathname = url.pathname;
  let targetPath = null;

  if (pathname === '/' || pathname === '/index.html') {
    targetPath = '/prerendered/index.html';
  } else if (pathname === '/article.html') {
    const id = url.searchParams.get('id');
    if (id && /^\d+$/.test(id)) {
      targetPath = `/prerendered/article/${id}.html`;
    } else {
      targetPath = '/prerendered/index.html';
    }
  }

  if (!targetPath) {
    return;
  }

  const targetUrl = new URL(targetPath, url.origin);
  const response = await fetch(targetUrl.toString(), {
    headers: {
      'Accept': 'text/html',
      'User-Agent': request.headers.get('user-agent') || '',
      'x-middleware-internal': 'true'
    }
  });

  const html = await response.text();
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

export const config = {
  matcher: ['/', '/index.html', '/article.html']
};