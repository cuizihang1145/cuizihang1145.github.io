// /api/config.js
const API_KEY = process.env.LIKE_API_KEY;

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!API_KEY) {
    return res.status(500).json({ error: 'LIKE_API_KEY 未设置' });
  }

  return res.status(200).json({ key: API_KEY });
};
