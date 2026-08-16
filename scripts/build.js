import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderMarkdown } from '../assets/markdown/markdown-node.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const articlesPath = path.join(__dirname, '../wenzhang.json');
const articlesData = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));

const templatePath = path.join(__dirname, '../article-ssr.html');
let template = fs.readFileSync(templatePath, 'utf-8');

const articles = articlesData.announcements || [];

articles.forEach((article, index) => {
  const renderedContent = renderMarkdown(article.content || '');
  let html = template
    .replace(/{TITLE}/g, article.title || '无标题')
    .replace(/{DATE}/g, article.date || '')
    .replace(/{CONTENT}/g, renderedContent)
    .replace(/{TAGS}/g, (article.tags || []).join('、'));
  const outputPath = path.join(__dirname, `../article-${index}.html`);
  fs.writeFileSync(outputPath, html);
  console.log(`Generated: article-${index}.html (${article.title})`);
});

console.log('All articles generated.');
