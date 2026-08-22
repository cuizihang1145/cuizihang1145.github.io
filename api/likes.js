import { kv } from '@vercel/kv';
import Pusher from 'pusher';
import crypto from 'crypto';

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

async function checkRateLimit(ip, id) {
  const now = Date.now();
  const shortKey = `rate:short:${ip}:${id}`;
  const last = await kv.get(shortKey);
  if (last && (now - Number(last)) < RATE_LIMIT_MS) {
    return { allowed: false, reason: '操作过快，请稍后再试' };
  }
  await kv.set(shortKey, String(now), { px: RATE_LIMIT_MS });
  return { allowed: true };
}

async function checkSessionLimit(sessionId) {
  if (!sessionId) return { allowed: true };
  const rateKey = `rate:session:${sessionId}`;
  const count = await kv.incr(rateKey);
  if (count === 1) {
    await kv.expire(rateKey, 300);
  }
  if (count > 30) {
    return { allowed: false, reason: '操作过于频繁，请稍后再试' };
  }
  return { allowed: true };
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
    sessionId = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`);
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
    const { id, action } = req.body || {};

    if (!id || !action) {
      return res.status(400).json({ success: false, error: 'Missing id or action' });
    }

    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const [ipRate, sessionRate] = await Promise.all([
      checkRateLimit(clientIP, id),
      checkSessionLimit(sessionId)
    ]);

    if (!ipRate.allowed) {
      return res.status(429).json({ success: false, error: ipRate.reason });
    }
    if (!sessionRate.allowed) {
      return res.status(429).json({ success: false, error: sessionRate.reason });
    }

    try {
      const delta = action === 'like' ? 1 : -1;
      let newVal = await kv.hincrby('likes:counts', id, delta);
      if (newVal < 0) {
        await kv.hset('likes:counts', { [id]: 0 });
        newVal = 0;
      }

      pusher.trigger('shuoshuo-channel', 'like-event', {
        id: id,
        likes: newVal,
        action: action,
      }).catch(err => {
        console.warn('Pusher push failed:', err.message);
      });

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