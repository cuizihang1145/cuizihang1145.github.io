// /api/config.js
const API_KEY = process.env.LIKE_API_KEY;

const ALLOWED_ORIGINS = ['https://www.cuizi.top'];

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

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 安全校验
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden: Invalid Referer' });
  }
  if (!isValidUserAgent(req)) {
    return res.status(403).json({ error: 'Forbidden: Unsupported User-Agent' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'LIKE_API_KEY 未设置' });
  }

  return res.status(200).json({ key: API_KEY });
};
