import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 密钥校验（保留，如果你不用可删）
  const API_KEY = process.env.LIKE_API_KEY;
  const clientKey = req.headers['x-api-key'];
  if (API_KEY && (!clientKey || clientKey !== API_KEY)) {
    return res.status(403).json({ success: false, error: 'Invalid API Key' });
  }

  // GET：获取所有说说点赞数
  if (req.method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      return res.status(200).json({
        success: true,
        data: counts,
        key: API_KEY || ''
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  }

  // POST：点赞/取消点赞
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
