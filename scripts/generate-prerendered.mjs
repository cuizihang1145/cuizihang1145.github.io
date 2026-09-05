import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderMarkdown } from '../assets/markdown/markdown-node.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const ARTICLES_ALL = path.join(PROJECT_ROOT, 'articles/all.json');
const SHUOSHUO_JSON = path.join(PROJECT_ROOT, 'shuoshuo.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'prerendered');
const MARKDOWN_CSS = '/assets/markdown/markdown.css';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let allData;
try {
  allData = JSON.parse(fs.readFileSync(ARTICLES_ALL, 'utf-8'));
} catch (e) {
  console.error('未找到 articles/all.json，请先运行 split.js');
  process.exit(1);
}

const articles = allData.list || [];
if (articles.length === 0) {
  console.log('没有文章，跳过文章预渲染');
}

console.log(`共 ${articles.length} 篇文章，开始预渲染...`);

function generateArticleHTML(article) {
  const { id, title, date, tags = [], content = '' } = article;
  const contentHtml = renderMarkdown(content);
  const tagsHtml = tags.map(t => `<span class="tag">${t}</span>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} · ks</title>
  <meta name="description" content="文章详情">
  <link rel="stylesheet" href="${MARKDOWN_CSS}">
  <style>
    body { font-family: 'Inter', sans-serif; background: #FAFAFE; color: #1A1A2E; line-height: 1.8; padding: 2rem; max-width: 700px; margin: 0 auto; }
    .detail-title { font-size: 2rem; font-weight: 700; margin-bottom: 0.3rem; }
    .detail-date { color: #8A8AB5; display: block; margin-bottom: 0.6rem; }
    .detail-tags .tag { display: inline-block; background: rgba(107,90,207,0.1); color: #6B5ACF; padding: 0.1rem 0.7rem; border-radius: 40px; font-size: 0.75rem; margin-right: 0.3rem; }
    .detail-divider { border: none; border-top: 1px solid rgba(0,0,0,0.06); margin: 1.5rem 0; }
    .detail-content { font-size: 1rem; }
    .detail-content h1, .detail-content h2, .detail-content h3 { margin-top: 1.2rem; }
    .detail-content pre { background: #f4f4f8; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    .detail-content code { background: rgba(0,0,0,0.06); padding: 0.1rem 0.3rem; border-radius: 3px; }
    .detail-content a { color: #6B5ACF; text-decoration: underline; }
    .nav-link { margin-top: 2rem; display: block; color: #6B5ACF; }
  </style>
</head>
<body>
  <h1 class="detail-title">${title}</h1>
  <span class="detail-date">${date}</span>
  <div class="detail-tags">${tagsHtml}</div>
  <hr class="detail-divider">
  <div class="detail-content">${contentHtml}</div>
  <a class="nav-link" href="/">← 返回首页</a>
</body>
</html>`;
}

function generateIndexHTML(articles) {
  function getPlainSummary(md) {
    if (!md) return '';
    const plain = md.replace(/[#*`_\[\]\(\)!]/g, '').trim().slice(0, 120);
    return plain + (md.length > 120 ? '…' : '');
  }

  const shuoshuoEntry = `
    <div class="shuoshuo-entry">
      <a href="/prerendered/shuoshuo/index.html">💬 看看我的说说 →</a>
    </div>
  `;

  const listHtml = articles.map(a => {
    const summary = getPlainSummary(a.content || '');
    const tagsHtml = (a.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    return `
      <div class="article-item">
        <h2><a href="/prerendered/article/${a.id}.html">${a.title}</a></h2>
        <div class="meta">${a.date} · ${tagsHtml}</div>
        <div class="summary">${summary}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ks · 个人博客</title>
  <meta name="description" content="ks 的个人博客，记录生活和思考">
  <style>
    body { font-family: 'Inter', sans-serif; background: #FAFAFE; color: #1A1A2E; line-height: 1.6; padding: 2rem; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 2.2rem; margin-bottom: 0.2rem; }
    .sub { color: #8A8AB5; margin-bottom: 2rem; }
    .shuoshuo-entry { margin: 1.5rem 0; padding: 0.8rem 1.2rem; background: rgba(107,90,207,0.08); border-radius: 1rem; text-align: center; }
    .shuoshuo-entry a { color: #6B5ACF; text-decoration: none; font-weight: 600; font-size: 1.1rem; }
    .shuoshuo-entry a:hover { text-decoration: underline; }
    .article-item { margin-bottom: 1.8rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 1.2rem; }
    .article-item h2 { margin: 0; font-size: 1.3rem; }
    .article-item h2 a { color: #1A1A2E; text-decoration: none; }
    .article-item h2 a:hover { color: #6B5ACF; }
    .meta { font-size: 0.8rem; color: #8A8AB5; margin-top: 0.2rem; }
    .meta .tag { display: inline-block; background: rgba(107,90,207,0.1); color: #6B5ACF; padding: 0.05rem 0.5rem; border-radius: 40px; font-size: 0.7rem; margin-right: 0.2rem; }
    .summary { margin-top: 0.3rem; color: #4A4A6E; }
  </style>
</head>
<body>
  <h1>ks</h1>
  <div class="sub">Hi，这里是 ks 的个人站点</div>
  ${shuoshuoEntry}
  ${listHtml}
</body>
</html>`;
}

const articleDir = path.join(OUTPUT_DIR, 'article');
if (!fs.existsSync(articleDir)) {
  fs.mkdirSync(articleDir, { recursive: true });
}

articles.forEach(article => {
  const html = generateArticleHTML(article);
  const filePath = path.join(articleDir, `${article.id}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`  生成文章 ${article.id} -> ${filePath}`);
});

const indexHtml = generateIndexHTML(articles);
fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHtml, 'utf-8');
console.log(`  生成主页 -> ${path.join(OUTPUT_DIR, 'index.html')}`);

let shuoshuoData;
try {
  shuoshuoData = JSON.parse(fs.readFileSync(SHUOSHUO_JSON, 'utf-8'));
} catch (e) {
  console.log('未找到 shuoshuo.json，跳过说说预渲染');
  shuoshuoData = [];
}

const shuoshuoList = (shuoshuoData || []).filter(item => item.delete !== true);

if (shuoshuoList.length > 0) {
  console.log(`共 ${shuoshuoList.length} 条说说，开始预渲染...`);

  function generateShuoshuoHTML(items) {
    function renderShuoshuoContent(md) {
      if (!md) return '';
      let html = renderMarkdown(md);
      const imgRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;
      html = html.replace(imgRegex, (match, alt, src) => {
        return `<div class="shuoshuo-image"><img src="${src}" alt="${alt}" loading="lazy"></div>`;
      });
      return html;
    }

    const listHtml = items.map((item, idx) => {
      const date = item.date || '';
      const location = item.location || '';
      const tags = item.tags || [];
      const content = item.content || '';
      const contentHtml = renderShuoshuoContent(content);

      const tagsHtml = tags.map(t => `<span class="tag">${t}</span>`).join('');
      const locationHtml = location ? `<span class="location"><i class="fas fa-map-marker-alt"></i> ${location}</span>` : '';

      return `
        <div class="shuoshuo-item">
          <div class="shuoshuo-header">
            <img class="shuoshuo-avatar" src="https://www.cuizi.top/logo.png" alt="ks" loading="lazy">
            <div class="shuoshuo-header-info">
              <div class="shuoshuo-name">ks</div>
              <div class="shuoshuo-date-location">
                <span>${date}</span>
                ${location ? `<span class="sep">·</span> ${locationHtml}` : ''}
              </div>
            </div>
          </div>
          <div class="shuoshuo-content">${contentHtml}</div>
          ${tagsHtml ? `<div class="shuoshuo-footer"><div class="shuoshuo-tags">${tagsHtml}</div></div>` : ''}
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>说说 · ks</title>
  <meta name="description" content="ks 的说说列表">
  <link rel="stylesheet" href="${MARKDOWN_CSS}">
  <style>
    body { font-family: 'Inter', sans-serif; background: #FAFAFE; color: #1A1A2E; line-height: 1.8; padding: 2rem; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.2rem; }
    .sub { color: #8A8AB5; margin-bottom: 2rem; }
    .shuoshuo-item { padding: 1.4rem 0 1.2rem; border-top: 1px solid rgba(0,0,0,0.06); }
    .shuoshuo-item:last-child { border-bottom: 1px solid rgba(0,0,0,0.06); }
    .shuoshuo-header { display: flex; align-items: flex-start; gap: 0.9rem; margin-bottom: 0.6rem; }
    .shuoshuo-avatar { width: 48px; height: 48px; border-radius: 8px; flex-shrink: 0; object-fit: cover; background: #ddd; }
    .shuoshuo-header-info { flex: 1; min-width: 0; }
    .shuoshuo-name { font-size: 1rem; font-weight: 700; color: #1A1A2E; }
    .shuoshuo-date-location { font-size: 0.78rem; color: #8A8AB5; display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.3rem; }
    .shuoshuo-date-location .sep { color: #C0C0D8; }
    .shuoshuo-content { font-size: 1rem; line-height: 1.6; color: #2D2D4A; word-break: break-word; }
    .shuoshuo-content p { margin-bottom: 0.5rem; }
    .shuoshuo-image { margin: 0.5rem 0; }
    .shuoshuo-image img { max-width: 100%; max-height: 300px; border-radius: 12px; object-fit: contain; background: transparent; }
    .shuoshuo-footer { margin-top: 0.8rem; }
    .shuoshuo-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .shuoshuo-tags .tag { display: inline-block; font-size: 0.75rem; font-weight: 500; color: #6B5ACF; background: rgba(107,90,207,0.1); padding: 0.1rem 0.7rem; border-radius: 40px; }
    .shuoshuo-tags .tag i { margin-right: 0.2rem; }
    .nav-link { margin-top: 2rem; display: block; color: #6B5ACF; }
  </style>
</head>
<body>
  <h1>说说</h1>
  <div class="sub">ks 的碎碎念</div>
  ${listHtml}
  <a class="nav-link" href="/">← 返回首页</a>
</body>
</html>`;
  }

  const shuoshuoDir = path.join(OUTPUT_DIR, 'shuoshuo');
  if (!fs.existsSync(shuoshuoDir)) {
    fs.mkdirSync(shuoshuoDir, { recursive: true });
  }

  const shuoshuoHtml = generateShuoshuoHTML(shuoshuoList);
  fs.writeFileSync(path.join(shuoshuoDir, 'index.html'), shuoshuoHtml, 'utf-8');
  console.log(`  生成说说 -> ${path.join(shuoshuoDir, 'index.html')}`);
} else {
  console.log('没有说说，跳过说说预渲染');
}

console.log('预渲染完成！');
