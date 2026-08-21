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

// 存储数学题会话，key 为 IP，value 为 { answer, expires }
const mathSessions = {};

// 生成一道 10~99 的加减法数学题
function generateMathQuestion() {
  let a, b, answer, op, question;
  const operators = ['+', '-'];

  do {
    a = Math.floor(Math.random() * 89) + 10;
    b = Math.floor(Math.random() * 89) + 10;
    op = operators[Math.floor(Math.random() * operators.length)];

    if (op === '+') {
      answer = a + b;
      if (answer > 99) {
        a = Math.floor(Math.random() * (99 - 10 - b)) + 10;
        answer = a + b;
      }
      question = a + ' + ' + b + ' = ?';
    } else {
      if (a < b) {
        const temp = a;
        a = b;
        b = temp;
      }
      if (a === b) {
        b = a - Math.floor(Math.random() * 20) - 1;
        if (b < 10) b = 10;
        if (a <= b) { a = b + Math.floor(Math.random() * 20) + 5; }
      }
      answer = a - b;
      question = a + ' - ' + b + ' = ?';
    }
  } while (answer < 10 || answer > 99 || a === b || b === 0 || a === 0);

  return { question, answer };
}

// 根据前端采集的行为数据计算风险分数，0-100，越高越可疑
function calculateRiskScore(behavior) {
  if (!behavior) return 60;

  let score = 0;

  // 鼠标路径点太少（< 3）→ 可疑
  if (!behavior.mousePoints || behavior.mousePoints < 3) score += 30;

  // 点击位置太正中心（偏移 < 10px）→ 可疑
  const dx = behavior.clickOffsetX || 0;
  const dy = behavior.clickOffsetY || 0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 10) score += 20;

  // 页面停留时间小于 2 秒 → 可疑
  if (behavior.stayTime && behavior.stayTime < 2000) score += 20;

  // 未滚动过 → 可疑
  if (!behavior.hasScrolled) score += 15;

  // 硬件并发数 ≤ 2（常见于无头浏览器）→ 可疑
  if (behavior.hardwareConcurrency && behavior.hardwareConcurrency <= 2) score += 15;

  return Math.min(score, 100);
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
    const { id, action, behavior, mathAnswer } = req.body || {};

    if (!id || !action) {
      return res.status(400).json({ success: false, error: 'Missing id or action' });
    }

    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const ipRate = await checkRateLimit(clientIP, id);
    if (!ipRate.allowed) {
      return res.status(429).json({ success: false, error: ipRate.reason });
    }

    const sessionRate = await checkSessionLimit(sessionId);
    if (!sessionRate.allowed) {
      return res.status(429).json({ success: false, error: sessionRate.reason });
    }

    // 如果带了 mathAnswer，优先验证数学题
    if (mathAnswer !== undefined && mathAnswer !== null) {
      const session = mathSessions[clientIP];
      if (!session || session.expires < Date.now() || session.answer !== mathAnswer) {
        return res.status(400).json({ success: false, error: '答案错误或已过期' });
      }
      delete mathSessions[clientIP];
    } else {
      // 没带 mathAnswer，走行为检测
      const riskScore = calculateRiskScore(behavior);
      if (riskScore >= 50) {
        const q = generateMathQuestion();
        mathSessions[clientIP] = {
          answer: q.answer,
          expires: Date.now() + 5 * 60 * 1000
        };
        return res.status(403).json({
          success: false,
          needMath: true,
          question: q.question
        });
      }
    }

    // 验证通过，执行点赞
    try {
      const key = 'likes:counts';
      const current = await kv.hget(key, id) || 0;
      const newVal = action === 'like' ? current + 1 : Math.max(0, current - 1);
      await kv.hset(key, { [id]: newVal });

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