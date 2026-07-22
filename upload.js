export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { image, filename } = req.body;
  if (!image) return res.status(400).json({ error: '没有图片' });

  const name = filename || Date.now() + '.png';
  const TOKEN = process.env.TOKEN;

  const r = await fetch(
    `https://api.github.com/repos/cuizihang1145/comment-images/contents/uploads/${name}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'upload',
        content: image,
        branch: 'main',
      }),
    }
  );

  if (!r.ok) return res.status(500).json({ error: '上传失败' });

  return res.json({
    url: `https://cdn.jsdelivr.net/gh/cuizihang1145/comment-images@main/uploads/${name}`
  });
}