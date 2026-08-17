// /api/likes.js
import { kv } from '@vercel/kv';

const API_KEY = process.env.LIKE_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 密钥校验（保留）
  const clientKey = req.headers['x-api-key'];
  if (!clientKey || clientKey !== API_KEY) {
    return res.status(403).json({ success: false, error: '无效的 API 密钥' });
  }

  const userId = req.query.userId || req.body?.userId || null;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId required' });
  }

  // GET 请求
  if (req.method === 'GET') {
    try {
      const counts = await kv.hgetall('likes:counts') || {};
      const userLikedIds = await kv.smembers(`likes:user:${userId}`) || [];
      return res.status(200).json({
        success: true,
        counts,
        userLikedIds
      });
    } catch (err) {
      console.error('KV GET error:', err);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }

  // POST 请求
  if (req.method === 'POST') {
    const { id, action } = req.body || {};
    if (!id || !action) {
      return res.status(400).json({ success: false, error: 'Missing id or action' });
    }
    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'action must be like or unlike' });
    }

    try {
      const countKey = 'likes:counts';
      const userKey = `likes:user:${userId}`;

      if (action === 'like') {
        await kv.hincrby(countKey, id, 1);
        await kv.sadd(userKey, id);
      } else {
        await kv.hincrby(countKey, id, -1);
        await kv.srem(userKey, id);
      }

      const newCounts = await kv.hgetall(countKey) || {};
      const userLikedIds = await kv.smembers(userKey) || [];
      return res.status(200).json({
        success: true,
        counts: newCounts,
        userLikedIds
      });
    } catch (err) {
      console.error('KV POST error:', err);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
