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

// 读取原始数组，并给每个文章打上原始索引作为 id
let rawArticles = (data.announcements || []).map((article, index) => {
    return { ...article, id: index };
});

// 过滤 delete: true 的文章
let articles = rawArticles.filter(a => a.delete !== true);

if (articles.length === 0) {
    console.log('没有文章，跳过拆分');
    process.exit(0);
}

// 按日期升序排序（旧→新）
const sorted = articles.slice().sort((a, b) => {
    const da = a.date || '1970-01-01';
    const db = b.date || '1970-01-01';
    return da.localeCompare(db);
});

const total = sorted.length;
const totalPages = Math.ceil(total / PAGE_SIZE);

// 生成分页文件
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

// 生成 all.json（完整数据，包含 id）
fs.writeFileSync(
    path.join(outputDir, 'all.json'),
    JSON.stringify({ total, list: sorted }, null, 2)
);
console.log(`生成 all.json (${total} 篇)`);

// 生成 archive.json（轻量数据，不含正文，但保留 id）
const archiveList = sorted.map(a => ({
    id: a.id,
    title: a.title || '无标题',
    date: a.date || '1970-01-01',
    tags: a.tags || []
}));
fs.writeFileSync(
    path.join(outputDir, 'archive.json'),
    JSON.stringify({ total, list: archiveList }, null, 2)
);
console.log(`生成 archive.json (${total} 篇，无正文)`);

// 生成单篇文章文件，文件名使用原始 id
sorted.forEach(article => {
    fs.writeFileSync(
        path.join(outputDir, `article-${article.id}.json`),
        JSON.stringify(article, null, 2)
    );
});
console.log(`生成 ${total} 个独立文章文件`);

// 元数据
fs.writeFileSync(
    path.join(outputDir, 'meta.json'),
    JSON.stringify({ total, totalPages }, null, 2)
);
console.log(`生成 meta.json (总页数 ${totalPages})`);

console.log(`拆分完成：${total} 篇文章，${totalPages} 页`);
