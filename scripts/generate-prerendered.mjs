import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderMarkdown } from '../assets/markdown/markdown-node.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const ARTICLES_ALL = path.join(PROJECT_ROOT, 'articles/all.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public/prerendered');
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
  console.log('没有文章，跳过预渲染');
  process.exit(0);
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

console.log('预渲染完成！');
