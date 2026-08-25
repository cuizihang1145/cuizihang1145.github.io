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

const RATE_LIMIT_MS = 300;
const GET_LIMIT_WINDOW = 10;
const GET_LIMIT_MAX = 3;
const SESSION_LIMIT = 30;
const SESSION_TTL = 300;
const RENEW_LIMIT = 3;
const RENEW_WINDOW = 10;

function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, ...meta };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function getClientIP(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp;
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
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
  const requestId = crypto.randomBytes(8).toString('hex');
  const method = req.method;
  const clientIP = getClientIP(req);

  log('info', 'Request started', { requestId, method, ip: clientIP, path: req.url });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nonce');

  if (req.method === 'OPTIONS') {
    log('info', 'OPTIONS request handled', { requestId });
    return res.status(200).end();
  }

  const cookies = parseCookies(req.headers.cookie || '');
  let sessionId = cookies.session_id;

  if (!sessionId) {
    sessionId = generateSessionId();
    res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}; Path=/`);
    log('info', 'New session created', { requestId, sessionId });
  } else {
    log('debug', 'Existing session', { requestId, sessionId });
  }

  if (req.method === 'GET') {
    try {
      const getLimitKey = `get:limit:${sessionId}`;
      const getCount = await kv.incr(getLimitKey);
      if (getCount === 1) {
        await kv.expire(getLimitKey, GET_LIMIT_WINDOW);
      }
      if (getCount > GET_LIMIT_MAX) {
        log('warn', 'GET rate limit exceeded', { requestId, sessionId, count: getCount, max: GET_LIMIT_MAX });
        return res.status(429).json({ success: false, error: '请求太频繁，请稍后再试' });
      }

      const nonce = crypto.randomBytes(16).toString('hex');
      const p = kv.pipeline();
      p.hgetall('likes:counts');
      p.set(`auth_nonce:${nonce}`, 'valid', { ex: SESSION_TTL });
      const result = await p.exec();
      const counts = result[0] || {};

      log('info', 'GET success', { requestId, sessionId, nonce: nonce.slice(0, 8) });
      return res.status(200).json({ success: true, data: counts, nonce: nonce });
    } catch (err) {
      log('error', 'GET error', { requestId, sessionId, error: err.message, stack: err.stack });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  if (req.method === 'POST') {
    const ua = req.headers['user-agent'] || '';

    if (ua.length < 10) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { id, action } = req.body || {};
    const userNonce = req.headers['x-nonce'];

    if (!/^\d+$/.test(String(id))) {
      log('warn', 'Invalid ID format', { requestId, id });
      return res.status(400).json({ success: false, error: 'ID must be numeric' });
    }
    if (!userNonce || !id || !action) {
      log('warn', 'Missing required fields', { requestId, hasNonce: !!userNonce, id, action });
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (action !== 'like' && action !== 'unlike') {
      log('warn', 'Invalid action', { requestId, action });
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const shortKey = `rate:short:${clientIP}:${id}`;
    const sessionKey = `rate:session:${sessionId}`;
    const nonceKey = `auth_nonce:${userNonce}`;
    const renewKey = `renew:count:${sessionId}`;
    const now = Date.now();
    const delta = action === 'like' ? 1 : -1;

    const luaScript = `
      local shortKey = KEYS[1]
      local sessionKey = KEYS[2]
      local countKey = KEYS[3]
      local nonceKey = KEYS[4]
      local renewKey = KEYS[5]

      local now = tonumber(ARGV[1])
      local delta = tonumber(ARGV[2])
      local rateLimitMs = tonumber(ARGV[3])
      local sessionLimit = tonumber(ARGV[4])
      local renewLimit = tonumber(ARGV[5])
      local renewWindow = tonumber(ARGV[6])
      local field = ARGV[7]
      local nonce = ARGV[8]

      if redis.call('GET', nonceKey) == false then
        return {0, 'invalid_nonce', 0}
      end
      redis.call('DEL', nonceKey)

      local shortVal = redis.call('GET', shortKey)
      if shortVal then
        local lastTime = tonumber(shortVal)
        if (now - lastTime) < rateLimitMs then
          return {0, 'rate', 0}
        end
      end

      local sessionVal = redis.call('GET', sessionKey)
      if sessionVal then
        local count = tonumber(sessionVal)
        if count >= sessionLimit then
          return {0, 'limit', 0}
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

      local renewCount = redis.call('INCR', renewKey)
      if renewCount == 1 then
        redis.call('EXPIRE', renewKey, renewWindow)
      end

      local shouldRenew = 0
      if renewCount <= renewLimit then
        shouldRenew = 1
      end

      return {newVal, 'ok', shouldRenew}
    `;

    try {
      const result = await kv.eval(
        luaScript,
        [shortKey, sessionKey, 'likes:counts', nonceKey, renewKey],
        [
          String(now),
          String(delta),
          String(RATE_LIMIT_MS),
          String(SESSION_LIMIT),
          String(RENEW_LIMIT),
          String(RENEW_WINDOW),
          id,
          userNonce
        ]
      );

      const newVal = result[0];
      const status = result[1];
      const shouldRenew = result[2];

      if (status === 'invalid_nonce') {
        log('warn', 'Invalid nonce', { requestId, ip: clientIP, nonce: userNonce.slice(0, 8) });
        return res.status(403).json({ success: false, error: 'Invalid or expired nonce' });
      }
      if (status === 'rate') {
        log('warn', 'Rate limit hit', { requestId, ip: clientIP, id });
        return res.status(429).json({ success: false, error: '操作过快，请稍后再试' });
      }
      if (status === 'limit') {
        log('warn', 'Session limit hit', { requestId, sessionId, id });
        return res.status(429).json({ success: false, error: '操作过于频繁，请稍后再试' });
      }

      let newNonce = null;
      if (shouldRenew === 1) {
        newNonce = crypto.randomBytes(16).toString('hex');
        await kv.set(`auth_nonce:${newNonce}`, 'valid', { ex: SESSION_TTL });
        log('debug', 'New nonce issued', { requestId, newNonce: newNonce.slice(0, 8) });
      }

      log('info', 'Like/unlike success', { requestId, id, action, newVal, ip: clientIP });

      setTimeout(() => {
        pusher.trigger('shuoshuo-channel', 'like-event', {
          id,
          likes: newVal,
          action,
        }).catch(() => {});
      }, 0);

      return res.status(200).json({
        success: true,
        id,
        likes: newVal,
        nonce: newNonce
      });
    } catch (err) {
      log('error', 'POST error', { requestId, error: err.message, stack: err.stack });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  log('warn', 'Method not allowed', { requestId, method });
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}