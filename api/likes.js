import { kv } from '@vercel/kv';

const ALLOWED_ORIGINS = ['https://www.cuizi.top'];
const RATE_LIMIT_MS = 300;
const API_KEY = process.env.LIKE_API_KEY;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid Referer' });
  }
  if (!isValidUserAgent(req)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Unsupported User-Agent' });
  }
  const clientIP = getClientIP(req);
  const clientKey = req.headers['x-api-key'];
  if (API_KEY && (!clientKey || clientKey !== API_KEY)) {
    return res.status(403).json({ success: false, error: 'Invalid API Key' });
  }

  if (req.method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      return res.status(200).json({ success: true, data: counts, key: API_KEY || '' });
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
    const rateResult = await checkRateLimit(clientIP, id);
    if (!rateResult.allowed) {
      return res.status(429).json({ success: false, error: rateResult.reason });
    }
    try {
      const key = 'likes:counts';
      const current = await kv.hget(key, id) || 0;
      let newVal = action === 'like' ? current + 1 : Math.max(0, current - 1);
      await kv.hset(key, { [id]: newVal });
      return res.status(200).json({
        success: true,
        id: id,
        likes: newVal,
        key: API_KEY || ''
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
