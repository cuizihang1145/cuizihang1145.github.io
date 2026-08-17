// /api/likes.js
// ============================================
// 环境变量（在 Vercel 后台设置）
// - GITHUB_TOKEN: GitHub Personal Access Token (repo 权限)
// - LIKE_API_KEY: 你自己生成的密钥，前后端保持一致
// ============================================

const TOKEN = process.env.GITHUB_TOKEN;
const API_KEY = process.env.LIKE_API_KEY;

// 写死：当前仓库
const REPO = 'cuizihang1145/cuizihang1145.github.io';
const FILE_PATH = 'likes.json';

const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ============================================
  // 校验密钥（所有请求都必须带 X-API-Key）
  // ============================================
  const clientKey = req.headers['x-api-key'];
  if (!clientKey || clientKey !== API_KEY) {
    return res.status(403).json({ success: false, error: '无效的 API 密钥' });
  }

  if (!TOKEN) {
    return res.status(500).json({ success: false, error: 'GITHUB_TOKEN 未设置' });
  }

  const headers = {
    'Authorization': `token ${TOKEN}`,
    'User-Agent': 'ks-like-api',
    'Accept': 'application/vnd.github+json'
  };

  // ============================================
  // 读取 likes.json
  // ============================================
  async function getFile() {
    const resp = await fetch(GITHUB_API, { headers });
    if (resp.status === 404) return { content: '{}', sha: null };
    if (!resp.ok) throw new Error(`读取失败: ${resp.status}`);
    const data = await resp.json();
    return {
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      sha: data.sha
    };
  }

  // ============================================
  // 写入 likes.json
  // ============================================
  async function putFile(content, sha) {
    const payload = {
      message: '👍 更新点赞',
      content: Buffer.from(content).toString('base64'),
      sha: sha || undefined
    };
    const resp = await fetch(GITHUB_API, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`写入失败: ${resp.status}`);
  }

  // ============================================
  // GET: 获取所有点赞数
  // ============================================
  if (req.method === 'GET') {
    try {
      const { content } = await getFile();
      const likes = JSON.parse(content);
      return res.status(200).json({
        success: true,
        data: likes,
        key: API_KEY
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ============================================
  // POST: 点赞/取消点赞
  // ============================================
  if (req.method === 'POST') {
    const { id, action } = req.body || {};

    if (id === undefined || id === null) {
      return res.status(400).json({ success: false, error: '缺少 id' });
    }
    if (action !== 'like' && action !== 'unlike') {
      return res.status(400).json({ success: false, error: 'action 必须是 like 或 unlike' });
    }

    try {
      const key = String(id);
      let resultLikes = 0;

      // 重试 3 次防并发冲突
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { content, sha } = await getFile();
          const likes = JSON.parse(content);

          const current = likes[key] || 0;
          let newCount;
          if (action === 'like') {
            newCount = current + 1;
          } else {
            newCount = Math.max(0, current - 1);
          }
          likes[key] = newCount;
          resultLikes = newCount;

          await putFile(JSON.stringify(likes, null, 2), sha);

          return res.status(200).json({
            success: true,
            id: key,
            likes: resultLikes,
            key: API_KEY
          });
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 300));
        }
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: '方法不允许' });
};
