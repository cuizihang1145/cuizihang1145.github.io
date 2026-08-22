import { Redis } from '@upstash/redis';
import Pusher from 'pusher';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || 'ap3',
  useTLS: true,
});

const ALLOWED_ORIGINS = ['https://www.cuizi.top'];
const RATE_LIMIT_MS = 300;

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
}

function isAllowedOrigin(req) {
  const referer = req.headers.referer || '';
  try {
    const url = new URL(referer);
    return ALLOWED_ORIGINS.some(origin => url.origin === origin);
  } catch {
    return false;
  }
}

function isValidUserAgent(req) {
  const ua = req.headers['user-agent'] || '';
  if (!ua) return false;
  const blocked = ['curl', 'wget', 'python-requests', 'java', 'okhttp'];
  return !blocked.some(k => ua.toLowerCase().includes(k));
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    acc[key] = rest.join('=');
    return acc;
  }, {});
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  if (!isValidUserAgent(req)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const clientIP = getClientIP(req);
  const cookies = parseCookies(req.headers.cookie || '');
  let sessionId = cookies.session_id;

  if (!sessionId) {
    sessionId = generateSessionId();
    res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/`);
  }

  if (req.method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      return res.status(200).json({ success: true, data: counts });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  if (req.method === 'POST') {
    const { id, action, visitorId } = req.body || {};

    if (!id || !action) {
      return res.status(400).json({ success: false, error: 'Missing id or action' });
    }
    if (!visitorId) {
      return res.status(400).json({ success: false, error: 'Missing visitorId' });
    }
    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const shortKey = `rate:short:${clientIP}:${id}`;
    const sessionKey = `rate:session:${sessionId}`;
    const now = Date.now();

    const [shortVal, sessionVal] = await Promise.all([
      kv.get(shortKey),
      kv.get(sessionKey),
    ]);

    if (shortVal !== null && (now - Number(shortVal)) < RATE_LIMIT_MS) {
      return res.status(429).json({ success: false, error: '操作过快，请稍后再试' });
    }
    if (sessionVal !== null && Number(sessionVal) > 30) {
      return res.status(429).json({ success: false, error: '操作过于频繁，请稍后再试' });
    }

    const likeSetKey = `like:set:${id}`;

    try {
      const isLiked = await kv.sismember(likeSetKey, visitorId);

      if (action === 'like') {
        if (isLiked) {
          const currentCount = await kv.scard(likeSetKey);
          return res.status(200).json({ success: true, id, likes: currentCount });
        }

        await kv.sadd(likeSetKey, visitorId);
        const newCount = await kv.scard(likeSetKey);
        await kv.hset('likes:counts', { [id]: newCount });

        pusher.trigger('shuoshuo-channel', 'like-event', { id, likes: newCount, action }).catch(() => {});

        const pipeline = kv.pipeline();
        pipeline.set(shortKey, String(now), { px: RATE_LIMIT_MS });
        pipeline.incr(sessionKey);
        pipeline.expire(sessionKey, 300);
        await pipeline.exec();

        return res.status(200).json({ success: true, id, likes: newCount });
      }

      if (action === 'unlike') {
        if (!isLiked) {
          const currentCount = await kv.scard(likeSetKey);
          return res.status(400).json({ success: false, error: '我去了，你都没点赞你取消个毛线' });
        }

        await kv.srem(likeSetKey, visitorId);
        const newCount = await kv.scard(likeSetKey);
        await kv.hset('likes:counts', { [id]: newCount });

        pusher.trigger('shuoshuo-channel', 'like-event', { id, likes: newCount, action }).catch(() => {});

        const pipeline = kv.pipeline();
        pipeline.set(shortKey, String(now), { px: RATE_LIMIT_MS });
        pipeline.incr(sessionKey);
        pipeline.expire(sessionKey, 300);
        await pipeline.exec();

        return res.status(200).json({ success: true, id, likes: newCount });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}