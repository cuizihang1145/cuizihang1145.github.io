import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BOT_USER_AGENTS = [
  'bingbot',
  'Baiduspider',
  'Googlebot',
  'Slurp',
  'DuckDuckBot',
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'Applebot',
  'bot',
  'crawler',
  'spider',
];

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';
  const isBot = BOT_USER_AGENTS.some(bot =>
    ua.toLowerCase().includes(bot.toLowerCase())
  );

  if (!isBot) {
    return NextResponse.next();
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '/index.html') {
    return NextResponse.rewrite(new URL('/prerendered/index.html', request.url));
  }

  if (pathname === '/article.html') {
    const id = url.searchParams.get('id');
    if (id && /^\d+$/.test(id)) {
      return NextResponse.rewrite(
        new URL(`/prerendered/article/${id}.html`, request.url)
      );
    }
    return NextResponse.rewrite(new URL('/prerendered/index.html', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
};
