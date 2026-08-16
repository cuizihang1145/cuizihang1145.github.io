import fs from 'fs';
import path from 'path';
import { renderMarkdown } from './assets/markdown/markdown-node.js';

const jsonData = JSON.parse(fs.readFileSync('wenzhang.json', 'utf-8'));
const articles = jsonData.announcements || [];

let template = fs.readFileSync('post.html', 'utf-8');

const outDir = 'dist/articles';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

articles.forEach((article, index) => {
  const renderedHTML = renderMarkdown(article.content || '');
  let html = template.replace(
    '<div class="detail-content" id="detailContent"></div>',
    `<div class="detail-content" id="detailContent">${renderedHTML}</div>`
  );
  const dataScript = `<script>window.__INITIAL_DATA__ = ${JSON.stringify(articles)};<\/script>`;
  html = html.replace('</head>', dataScript + '\n</head>');
  const title = article.title || '文章';
  html = html.replace(/<title>.*<\/title>/, `<title>${title} · ks</title>`);
  const fileName = `article_${index}.html`;
  fs.writeFileSync(path.join(outDir, fileName), html);
  console.log(`${fileName} (${title})`);
});

console.log(`共生成 ${articles.length} 个静态页面`);
