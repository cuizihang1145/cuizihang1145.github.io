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

function getPlainSummary(md, len = 80) {
  if (!md) return '';
  const plain = md.replace(/[#*`_\[\]\(\)!]/g, '').trim().slice(0, len);
  return plain + (md.length > len ? '…' : '');
}

function generateArticleHTML(article, allArticles, shuoshuoList) {
  const { id, title, date, tags = [], content = '' } = article;
  const contentHtml = renderMarkdown(content);
  const tagsHtml = tags.map(t => `<span class="tag">${t}</span>`).join('');
  
  const summary = getPlainSummary(content);
  const fullUrl = `https://www.cuizi.top/article.html?id=${id}`;

  const currentIndex = allArticles.findIndex(a => a.id === id);
  const prevArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const nextArticle = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

  const excludeIds = new Set([id]);
  if (prevArticle) excludeIds.add(prevArticle.id);
  if (nextArticle) excludeIds.add(nextArticle.id);
  
  const otherArticles = allArticles.filter(a => !excludeIds.has(a.id));
  const shuffled = otherArticles.sort(() => Math.random() - 0.5);
  const randomArticles = shuffled.slice(0, 3);

  let recommendHtml = '';
  const allRecommends = [];
  if (prevArticle) allRecommends.push({ type: 'prev', ...prevArticle });
  if (nextArticle) allRecommends.push({ type: 'next', ...nextArticle });
  allRecommends.push(...randomArticles.map(a => ({ type: 'random', ...a })));

  if (allRecommends.length > 0) {
    const itemsHtml = allRecommends.map((a, idx) => {
      const label = a.type === 'prev' ? '上一篇' : a.type === 'next' ? '下一篇' : '推荐';
      return `
        <div class="recommend-item">
          <span class="recommend-label">${label}</span>
          <a href="/prerendered/article/${a.id}.html">${a.title}</a>
        </div>
      `;
    }).join('');

    recommendHtml = `
      <div class="recommend-section">
        <h3>推荐阅读</h3>
        ${itemsHtml}
        <div class="recommend-shuoshuo">
          <a href="/prerendered/shuoshuo/index.html">去看看 ks 的碎碎念 →</a>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} · ks</title>
  <meta name="description" content="${summary}">
  <link rel="canonical" href="${fullUrl}" />
  <meta property="og:title" content="${title} · ks" />
  <meta property="og:description" content="${summary}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:image" content="https://www.cuizi.top/og-image.png" />
  <meta property="og:site_name" content="ks 的个人博客" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} · ks" />
  <meta name="twitter:description" content="${summary}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${title}",
    "datePublished": "${date}",
    "dateModified": "${date}",
    "author": {
      "@type": "Person",
      "name": "ks"
    },
    "description": "${summary}",
    "url": "${fullUrl}",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${fullUrl}"
    }
  }
  </script>
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
    .recommend-section { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 2px solid rgba(107,90,207,0.15); }
    .recommend-section h3 { font-size: 1.1rem; color: #6B5ACF; margin-bottom: 0.8rem; }
    .recommend-item { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.3rem 0; }
    .recommend-item .recommend-label { font-size: 0.7rem; background: rgba(107,90,207,0.1); color: #6B5ACF; padding: 0.05rem 0.5rem; border-radius: 20px; flex-shrink: 0; }
    .recommend-item a { color: #1A1A2E; text-decoration: none; }
    .recommend-item a:hover { color: #6B5ACF; text-decoration: underline; }
    .recommend-shuoshuo { margin-top: 0.8rem; padding-top: 0.6rem; border-top: 1px dashed rgba(107,90,207,0.2); }
    .recommend-shuoshuo a { color: #6B5ACF; text-decoration: none; font-weight: 500; }
    .recommend-shuoshuo a:hover { text-decoration: underline; }
    .nav-link { margin-top: 1rem; display: block; color: #6B5ACF; }
  </style>
</head>
<body>
  <h1 class="detail-title">${title}</h1>
  <span class="detail-date">${date}</span>
  <div class="detail-tags">${tagsHtml}</div>
  <hr class="detail-divider">
  <div class="detail-content">${contentHtml}</div>
  ${recommendHtml}
  <a class="nav-link" href="/">← 返回首页</a>
</body>
</html>`;
}

function generateIndexHTML(articles, shuoshuoItems) {
  const latestTwoShuoshuo = (shuoshuoItems || []).slice(0, 2);
  let desc = 'ks 的个人博客，记录生活与思考';
  
  if (latestTwoShuoshuo.length > 0) {
    const shuoshuoTexts = latestTwoShuoshuo.map(item => {
      const plain = item.content.replace(/[#*`_\[\]\(\)!]/g, '').trim();
      return plain.length > 30 ? plain.slice(0, 30) + '…' : plain;
    });
    desc = `💬 ${shuoshuoTexts.join(' | ')}`;
    if (desc.length > 80) {
      desc = desc.slice(0, 77) + '…';
    }
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
  <title>ks · 个人博客 · 保持好奇，保持诚实</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="https://www.cuizi.top/" />
  <meta property="og:title" content="ks · 个人博客 · 保持好奇，保持诚实" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.cuizi.top/" />
  <meta property="og:image" content="https://www.cuizi.top/og-image.png" />
  <meta property="og:site_name" content="ks 的个人博客" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="ks · 个人博客 · 保持好奇，保持诚实" />
  <meta name="twitter:description" content="${desc}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ks 的个人博客",
    "description": "记录生活与思考，保持好奇，保持诚实",
    "url": "https://www.cuizi.top/"
  }
  </script>
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

function generateShuoshuoHTML(items) {
  function renderShuoshuoContent(md) {
    if (!md) return '';
    let html = renderMarkdown(md);
    const imgRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;
    html = html.replace(imgRegex, (match, alt, src) => {
      const altText = alt || src.split('/').pop().split('.')[0] || '图片';
      return `<div class="shuoshuo-image"><img src="${src}" alt="${altText}" loading="lazy"></div>`;
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
          <img class="shuoshuo-avatar" src="https://www.cuizi.top/logo.png" alt="ks 的头像" loading="lazy">
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
  <meta name="description" content="ks 的日常碎碎念，记录生活点滴">
  <link rel="canonical" href="https://www.cuizi.top/shuoshuo.html" />
  <meta property="og:title" content="说说 · ks" />
  <meta property="og:description" content="ks 的日常碎碎念，记录生活点滴" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.cuizi.top/shuoshuo.html" />
  <meta property="og:image" content="https://www.cuizi.top/og-image.png" />
  <meta property="og:site_name" content="ks 的个人博客" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="说说 · ks" />
  <meta name="twitter:description" content="ks 的日常碎碎念，记录生活点滴" />
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

const articleDir = path.join(OUTPUT_DIR, 'article');
if (!fs.existsSync(articleDir)) {
  fs.mkdirSync(articleDir, { recursive: true });
}

let shuoshuoData;
try {
  shuoshuoData = JSON.parse(fs.readFileSync(SHUOSHUO_JSON, 'utf-8'));
} catch (e) {
  console.log('未找到 shuoshuo.json，跳过说说预渲染');
  shuoshuoData = [];
}

const shuoshuoList = (shuoshuoData || []).filter(item => item.delete !== true);

articles.forEach(article => {
  const html = generateArticleHTML(article, articles, shuoshuoList);
  const filePath = path.join(articleDir, `${article.id}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`  生成文章 ${article.id} -> ${filePath}`);
});

const indexHtml = generateIndexHTML(articles, shuoshuoList);
fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHtml, 'utf-8');
console.log(`  生成主页 -> ${path.join(OUTPUT_DIR, 'index.html')}`);

if (shuoshuoList.length > 0) {
  console.log(`共 ${shuoshuoList.length} 条说说，开始预渲染...`);

  const shuoshuoHtml = generateShuoshuoHTML(shuoshuoList);
  const shuoshuoDir = path.join(OUTPUT_DIR, 'shuoshuo');
  if (!fs.existsSync(shuoshuoDir)) {
    fs.mkdirSync(shuoshuoDir, { recursive: true });
  }
  fs.writeFileSync(path.join(shuoshuoDir, 'index.html'), shuoshuoHtml, 'utf-8');
  console.log(`  生成说说 -> ${path.join(shuoshuoDir, 'index.html')}`);
} else {
  console.log('没有说说，跳过说说预渲染');
}

console.log('预渲染完成！');