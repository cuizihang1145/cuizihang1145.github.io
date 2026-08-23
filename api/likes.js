import { Redis } from '@upstash/redis';
import Pusher from 'pusher';
import crypto from 'crypto';

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
    res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`);
  }

  if (req.method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      
      // 生成一次性随机号（Nonce），存进Redis，300秒过期，然后返回给前端
      const nonce = crypto.randomBytes(16).toString('hex');
      await kv.set(`auth_nonce:${nonce}`, 'valid', 'EX', 300);

      return res.status(200).json({ success: true, data: counts, nonce: nonce });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  if (req.method === 'POST') {
    const { id, action } = req.body || {};
    const userNonce = req.headers['x-nonce'];
    if (!userNonce || !id || !action) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const shortKey = `rate:short:${clientIP}:${id}`;
    const sessionKey = `rate:session:${sessionId}`;
    // 新增：拼接 Nonce 的 Redis Key
    const nonceKey = `auth_nonce:${userNonce}`;
    const now = Date.now();
    const delta = action === 'like' ? 1 : -1;

    const luaScript = `
      local shortKey = KEYS[1]
      local sessionKey = KEYS[2]
      local countKey = KEYS[3]
      local nonceKey = KEYS[4]

      local now = tonumber(ARGV[1])
      local delta = tonumber(ARGV[2])
      local rateLimitMs = tonumber(ARGV[3])
      local sessionLimit = tonumber(ARGV[4])
      local field = ARGV[5]
      local nonce = ARGV[6]

      -- 第一步：验证并删除 Nonce（防重放，原子操作）
      if redis.call('GET', nonceKey) == false then
        return {0, 'invalid_nonce'}
      end
      redis.call('DEL', nonceKey)

      -- 第二步：原有的限流逻辑（只有验证通过才会走到这里）
      local shortVal = redis.call('GET', shortKey)
      if shortVal then
        local lastTime = tonumber(shortVal)
        if (now - lastTime) < rateLimitMs then
          return {0, 'rate'}
        end
      end

      local sessionVal = redis.call('GET', sessionKey)
      if sessionVal then
        local count = tonumber(sessionVal)
        if count >= sessionLimit then
          return {0, 'limit'}
        end
      end

      redis.call('SET', shortKey, now, 'PX', rateLimitMs)
      redis.call('INCR', sessionKey)
      redis.call('EXPIRE', sessionKey, 300)
      local newVal = redis.call('HINCRBY', countKey, field, delta)

      if newVal < 0 then
        newVal = 0
        redis.call('HSET', countKey, field, 0)
      end

      return {newVal, 'ok'}
    `;

    try {
      const result = await kv.eval(
        luaScript,
        // 将 nonceKey 作为第4个参数传入
        [shortKey, sessionKey, 'likes:counts', nonceKey],
        // 将 userNonce 作为第6个参数传入
        [String(now), String(delta), String(RATE_LIMIT_MS), '30', id, userNonce]
      );

      const newVal = result[0];
      const status = result[1];

      if (status === 'invalid_nonce') {
        return res.status(403).json({ success: false, error: 'Invalid or expired nonce' });
      }
      if (status === 'rate') {
        return res.status(429).json({ success: false, error: '操作过快，请稍后再试' });
      }
      if (status === 'limit') {
        return res.status(429).json({ success: false, error: '操作过于频繁，请稍后再试' });
      }

      pusher.trigger('shuoshuo-channel', 'like-event', {
        id,
        likes: newVal,
        action,
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        id,
        likes: newVal,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}