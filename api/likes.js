import { kv } from '@vercel/kv';
import Pusher from 'pusher';

// ============ 轻量级随机（替代 crypto） ============
function generateSessionId() {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return now + rand;
}

// ============ 全局 HTTP Agent 复用连接 ============
import { Agent } from 'undici';
const globalDispatcher = new Agent({
  connections: 100,
  pipelining: 10,
});
// 让 @vercel/kv 底层 fetch 复用 TCP 连接
globalThis[Symbol.for('undici.globalDispatcher')] = globalDispatcher;

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
    sessionId = generateSessionId(); // 超轻量，不拖 CPU
    res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`);
  }

  // ==================== GET 请求（保持原样，已够快） ====================
  if (req.method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      return res.status(200).json({ success: true, data: counts });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  // ==================== POST 请求（全部压入 Pipeline） ====================
  if (req.method === 'POST') {
    const { id, action } = req.body || {};
    if (!id || !action) {
      return res.status(400).json({ success: false, error: 'Missing id or action' });
    }
    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    // ---- 第一步：一次性读取所有限频相关键（只花 1 次网络往返） ----
    const shortKey = `rate:short:${clientIP}:${id}`;
    const sessionKey = `rate:session:${sessionId}`;

    const pRead = kv.pipeline();
    pRead.get(shortKey);
    pRead.get(sessionKey);
    const [shortVal, sessionVal] = await pRead.exec();

    // ---- 内存判断（零网络开销） ----
    const now = Date.now();
    if (shortVal !== null && (now - Number(shortVal)) < RATE_LIMIT_MS) {
      return res.status(429).json({ success: false, error: '操作过快，请稍后再试' });
    }
    if (sessionVal !== null && Number(sessionVal) > 30) {
      return res.status(429).json({ success: false, error: '操作过于频繁，请稍后再试' });
    }

    // ---- 第二步：执行所有写操作（再次只花 1 次网络往返） ----
    const delta = action === 'like' ? 1 : -1;
    const pWrite = kv.pipeline();

    // 更新限频短键（IP 限频）
    pWrite.set(shortKey, String(now), { px: RATE_LIMIT_MS });

    // 更新会话计数（自增 + 刷新过期）
    pWrite.incr(sessionKey);
    pWrite.expire(sessionKey, 300);

    // 点赞总数增减（原子操作）
    pWrite.hincrby('likes:counts', id, delta);

    // 执行
    const results = await pWrite.exec();
    // results 顺序对应 pipeline 添加顺序
    // 第 3 个是 incr 的结果，第 4 个是 expire 的结果（返回 1/0），第 5 个是 hincrby 的结果
    let newVal = results[4]; // hincrby 的返回值

    // ---- 钳位（如果减到负数，修复，额外一次写，但概率极低） ----
    if (newVal < 0) {
      await kv.hset('likes:counts', { [id]: 0 });
      newVal = 0;
    }

    // ---- 触发 Pusher（不等待） ----
    pusher.trigger('shuoshuo-channel', 'like-event', {
      id: id,
      likes: newVal,
      action: action,
    }).catch(() => {});

    // ---- 返回结果 ----
    return res.status(200).json({
      success: true,
      id: id,
      likes: newVal,
    });
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}