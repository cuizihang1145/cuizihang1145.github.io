const fs = require('fs');
const path = require('path');

const PAGE_SIZE = 10;
const inputFile = path.join(__dirname, 'wenzhang.json');
const outputDir = path.join(__dirname, 'articles');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

let raw;
try {
    raw = fs.readFileSync(inputFile, 'utf-8');
} catch {
    console.log('未找到 wenzhang.json，跳过拆分');
    process.exit(0);
}

let data;
try {
    data = JSON.parse(raw);
} catch {
    console.error('wenzhang.json 格式错误');
    process.exit(1);
}

let articles = (data.announcements || []).filter(a => a.delete !== true);

if (articles.length === 0) {
    console.log('没有文章，跳过拆分');
    process.exit(0);
}

// 按日期升序排列（旧→新），与归档页面“最早”排序一致
const sorted = articles.slice().sort((a, b) => {
    const da = a.date || '1970-01-01';
    const db = b.date || '1970-01-01';
    return da.localeCompare(db);
});

const total = sorted.length;
const totalPages = Math.ceil(total / PAGE_SIZE);

// 分页文件：每页 PAGE_SIZE 篇，包含完整正文
for (let i = 0; i < totalPages; i++) {
    const start = i * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const pageData = {
        total,
        totalPages,
        page: i + 1,
        list: sorted.slice(start, end)
    };
    fs.writeFileSync(
        path.join(outputDir, `page-${i + 1}.json`),
        JSON.stringify(pageData, null, 2)
    );
    console.log(`生成 page-${i + 1}.json (${end - start} 篇)`);
}

// 全部数据：用于文章详情页通过 id 索引取单篇
fs.writeFileSync(
    path.join(outputDir, 'all.json'),
    JSON.stringify({ total, list: sorted }, null, 2)
);
console.log(`生成 all.json (${total} 篇)`);

// 归档用轻量数据：只含标题、日期、标签，不含正文
const archiveList = sorted.map(a => ({
    title: a.title || '无标题',
    date: a.date || '1970-01-01',
    tags: a.tags || []
}));
fs.writeFileSync(
    path.join(outputDir, 'archive.json'),
    JSON.stringify({ total, list: archiveList }, null, 2)
);
console.log(`生成 archive.json (${total} 篇，无正文)`);

// 单篇文章独立文件：供 article.html 按需加载，避免全量拉取
sorted.forEach((article, index) => {
    fs.writeFileSync(
        path.join(outputDir, `article-${index}.json`),
        JSON.stringify(article, null, 2)
    );
});
console.log(`生成 ${total} 个独立文章文件`);

// 元数据：总文章数、总页数，供列表页快速判断
fs.writeFileSync(
    path.join(outputDir, 'meta.json'),
    JSON.stringify({ total, totalPages }, null, 2)
);
console.log(`生成 meta.json (总页数 ${totalPages})`);

console.log(`拆分完成：${total} 篇文章，${totalPages} 页`);
