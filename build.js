const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// ===== 配置 =====
const SOURCE_DIR = './WENZHANG';
const OUTPUT_DIR = './_site';
const TEMPLATE_FILE = './post.html';
const HEAD_FILE = './Setting/head.html';

// ===== 读取模板 =====
const template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
const headHtml = fs.existsSync(HEAD_FILE) ? fs.readFileSync(HEAD_FILE, 'utf-8') : '';

// ===== 扫描 .md 文件 =====
if (!fs.existsSync(SOURCE_DIR)) {
  console.error('❌ WENZHANG 目录不存在，请创建');
  process.exit(1);
}

const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.md'));
if (files.length === 0) {
  console.log('⚠️ 没有找到 .md 文件');
  process.exit(0);
}

// ===== 生成标签 HTML =====
function generateTagsHtml(tags) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return '';
  let html = '<div class="detail-tags">';
  tags.forEach(tag => {
    const safe = tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += `<span class="tag"><i class="fas fa-tag"></i> ${safe}</span>`;
  });
  html += '</div>';
  return html;
}

// ===== 遍历生成 =====
files.forEach(file => {
  const filePath = path.join(SOURCE_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const dateStr = data.date || file.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '2026-01-01';
  const [year, month, day] = dateStr.split('-');
  const slug = data.slug || file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace('.md', '');

  const htmlContent = marked.parse(content);
  const tagsHtml = generateTagsHtml(data.tags);

  const page = template
    .replaceAll('{{global_head}}', headHtml)
    .replaceAll('{{post_title}}', data.title || '无标题')
    .replaceAll('{{post_date}}', dateStr)
    .replaceAll('{{post_tags}}', tagsHtml)
    .replaceAll('{{post_content}}', htmlContent)
    .replaceAll('{{base}}', '/');

  const outDir = path.join(OUTPUT_DIR, 'post', year, month, day);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${slug}.html`), page);
});

console.log(`✅ 已生成 ${files.length} 篇文章`);
