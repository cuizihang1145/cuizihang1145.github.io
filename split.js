const fs = require('fs');
const path = require('path');

const PAGE_SIZE = 10;
const inputFile = path.join(__dirname, 'wenzhang.json');
const outputDir = path.join(__dirname, 'articles');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const raw = fs.readFileSync(inputFile, 'utf-8');
const data = JSON.parse(raw);
let articles = data.announcements || [];
articles = articles.filter(a => a.delete !== true);
articles.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const total = articles.length;
const totalPages = Math.ceil(total / PAGE_SIZE);

for (let i = 0; i < totalPages; i++) {
  const start = i * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageData = {
    total: total,
    totalPages: totalPages,
    page: i + 1,
    list: articles.slice(start, end)
  };
  fs.writeFileSync(
    path.join(outputDir, `page-${i + 1}.json`),
    JSON.stringify(pageData, null, 2),
    'utf-8'
  );
}

// 全量数据（用于搜索）
fs.writeFileSync(
  path.join(outputDir, 'all.json'),
  JSON.stringify({ total, list: articles }, null, 2),
  'utf-8'
);

// 元数据（只存总数和总页数）
fs.writeFileSync(
  path.join(outputDir, 'meta.json'),
  JSON.stringify({ total, totalPages }, null, 2),
  'utf-8'
);

console.log(`✅ 拆分完成：${total} 篇文章，${totalPages} 页`);
