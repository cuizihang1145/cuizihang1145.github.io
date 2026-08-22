import { kv } from '@vercel/kv';
import Pusher from 'pusher';

// ============ 轻量级随机（替代 crypto） ============
function generateSessionId() {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return now + rand;
}

const ALLOWED_ORIGINS = ['https://www.cuizi.top'];
const RATE_LIMIT_MS = 300;

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || 'ap3',
  useTLS: true,
});

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
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid Referer' });
  }

  if (!isValidUserAgent(req)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Unsupported User-Agent' });
  }

  const clientIP = getClientIP(req);
  const cookies = parseCookies(req.headers.cookie || '');
  let sessionId = cookies.session_id;

  if (!sessionId) {
    sessionId = generateSessionId(); // 替换掉 crypto
    res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`);
  }

  // ==================== GET 请求 ====================
  if (req.method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      return res.status(200).json({ success: true, data: counts });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  // ==================== POST 请求 ====================
  if (req.method === 'POST') {
    const { id, action } = req.body || {};

    if (!id || !action) {
      return res.status(400).json({ success: false, error: 'Missing id or action' });
    }

    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    // ---- 限频检查（保持原样，但已经在内存中，够快） ----
    const shortKey = `rate:short:${clientIP}:${id}`;
    const sessionKey = `rate:session:${sessionId}`;
    const now = Date.now();

    // 用 Promise.all 并行读（比串行快一倍）
    const [shortVal, sessionVal] = await Promise.all([
      kv.get(shortKey),
      kv.get(sessionKey)
    ]);

    if (shortVal !== null && (now - Number(shortVal)) < RATE_LIMIT_MS) {
      return res.status(429).json({ success: false, error: '操作过快，请稍后再试' });
    }
    if (sessionVal !== null && Number(sessionVal) > 30) {
      return res.status(429).json({ success: false, error: '操作过于频繁，请稍后再试' });
    }

    try {
      const delta = action === 'like' ? 1 : -1;

      // ---- 使用 Pipeline 合并写入操作（关键优化！） ----
      const pipeline = kv.pipeline();
      pipeline.set(shortKey, String(now), { px: RATE_LIMIT_MS });
      pipeline.incr(sessionKey);
      pipeline.expire(sessionKey, 300);
      pipeline.hincrby('likes:counts', id, delta);
      
      const results = await pipeline.exec();
      // results 数组：[set结果, incr结果, expire结果, hincrby结果]
      let newVal = results[3]; // hincrby 的返回值在第四个位置

      if (newVal < 0) {
        await kv.hset('likes:counts', { [id]: 0 });
        newVal = 0;
      }

      // ---- Pusher 不等待 ----
      pusher.trigger('shuoshuo-channel', 'like-event', {
        id: id,
        likes: newVal,
        action: action,
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        id: id,
        likes: newVal,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}