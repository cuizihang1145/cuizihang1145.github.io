import { kv } from '@vercel/kv';
import { Ratelimit } from '@upstash/ratelimit';

// 限流器：10秒内最多5次
const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, '10 s'), // 改这里：3 → 5
  analytics: true,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ========== Key 校验 ==========
  const API_KEY = process.env.LIKE_API_KEY;
  const clientKey = req.headers['x-api-key'];
  if (API_KEY && (!clientKey || clientKey !== API_KEY)) {
    return res.status(403).json({ success: false, error: 'Invalid API Key' });
  }

  // ========== IP 限流 ==========
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
             req.socket.remoteAddress || 
             'unknown';

  const { success, limit, reset, remaining } = await ratelimit.limit(ip);

  if (!success) {
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString());
    const waitSeconds = Math.ceil((reset - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      error: `操作过于频繁，请 ${waitSeconds} 秒后再试`
    });
  }

  // ========== 业务逻辑 ==========
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

    try {
      const key = 'likes:counts';
      const current = await kv.hget(key, id) || 0;
      const newVal = action === 'like' ? current + 1 : Math.max(0, current - 1);
      await kv.hset(key, { [id]: newVal });
      return res.status(200).json({ success: true, id, likes: newVal });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
