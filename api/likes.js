// ============ Edge Runtime 专用 ============
import { Redis } from '@upstash/redis';
import Pusher from 'pusher-http-edge';

// ---------- 初始化 KV ----------
const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ---------- 初始化 Pusher ----------
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || 'ap3',
  useTLS: true,
});

// ---------- 工具函数（无 Node.js 依赖） ----------
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

function isAllowedOrigin(request) {
  const referer = request.headers.get('referer') || '';
  try {
    const url = new URL(referer);
    return ['https://www.cuizi.top'].some(origin => url.origin === origin);
  } catch {
    return false;
  }
}

function isValidUserAgent(request) {
  const ua = request.headers.get('user-agent') || '';
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

// ---------- 主处理器 ----------
export default async function handler(request) {
  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // 安全校验
  if (!isAllowedOrigin(request)) {
    return jsonResponse(403, { success: false, error: 'Forbidden: Invalid Referer' });
  }
  if (!isValidUserAgent(request)) {
    return jsonResponse(403, { success: false, error: 'Forbidden: Unsupported User-Agent' });
  }

  const clientIP = getClientIP(request);
  const cookies = parseCookies(request.headers.get('cookie') || '');
  let sessionId = cookies.session_id;

  if (!sessionId) {
    sessionId = generateSessionId();
  }

  const url = new URL(request.url);
  const method = request.method;

  // ========== GET 请求 ==========
  if (method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      return jsonResponse(200, { success: true, data: counts });
    } catch (err) {
      console.error(err);
      return jsonResponse(500, { success: false, error: 'Internal error' });
    }
  }

  // ========== POST 请求 ==========
  if (method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { success: false, error: 'Invalid JSON' });
    }
    const { id, action } = body || {};

    if (!id || !action) {
      return jsonResponse(400, { success: false, error: 'Missing id or action' });
    }
    if (action !== 'like' && action !== 'unlike') {
      return jsonResponse(400, { success: false, error: 'Invalid action' });
    }

    const shortKey = `rate:short:${clientIP}:${id}`;
    const sessionKey = `rate:session:${sessionId}`;
    const now = Date.now();

    // 并行读取限频数据
    const [shortVal, sessionVal] = await Promise.all([
      kv.get(shortKey),
      kv.get(sessionKey),
    ]);

    if (shortVal !== null && (now - Number(shortVal)) < 300) {
      return jsonResponse(429, { success: false, error: '操作过快，请稍后再试' });
    }
    if (sessionVal !== null && Number(sessionVal) > 30) {
      return jsonResponse(429, { success: false, error: '操作过于频繁，请稍后再试' });
    }

    try {
      const delta = action === 'like' ? 1 : -1;
      // Pipeline 合并写入
      const pipeline = kv.pipeline();
      pipeline.set(shortKey, String(now), { px: 300 });
      pipeline.incr(sessionKey);
      pipeline.expire(sessionKey, 300);
      pipeline.hincrby('likes:counts', id, delta);
      const results = await pipeline.exec();
      let newVal = results[3]; // hincrby 结果

      if (newVal < 0) {
        await kv.hset('likes:counts', { [id]: 0 });
        newVal = 0;
      }

      // 触发 Pusher（不等待）
      pusher.trigger('shuoshuo-channel', 'like-event', {
        id,
        likes: newVal,
        action,
      }).catch(() => {});

      // 设置 Cookie（Edge 下通过 Set-Cookie 头）
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`,
      };
      return new Response(JSON.stringify({ success: true, id, likes: newVal }), {
        status: 200,
        headers,
      });
    } catch (err) {
      console.error(err);
      return jsonResponse(500, { success: false, error: 'Internal error' });
    }
  }

  return jsonResponse(405, { success: false, error: 'Method Not Allowed' });
}

// ---------- 辅助响应函数 ----------
function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}