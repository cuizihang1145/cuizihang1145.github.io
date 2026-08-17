const fs = require('fs');
const path = require('path');

const PAGE_SIZE = 10;
const inputFile = path.join(__dirname, 'wenzhang.json');
const outputDir = path.join(__dirname, 'articles');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 读取原始数据
let raw;
try {
    raw = fs.readFileSync(inputFile, 'utf-8');
} catch (err) {
    console.log('⚠️ 未找到 wenzhang.json，跳过拆分（构建成功）');
    process.exit(0);
}

let data;
try {
    data = JSON.parse(raw);
} catch (err) {
    console.error('❌ wenzhang.json 格式错误，请检查 JSON 语法');
    process.exit(1);
}

let articles = data.announcements || [];
articles = articles.filter(a => a.delete !== true);

if (articles.length === 0) {
    console.log('⚠️ 没有文章，跳过拆分');
    process.exit(0);
}

// ★★★ 关键修改：按日期升序（最旧在前，最新在后）★★★
// 与 index.html 的 "最早" 按钮排序保持一致
const sortedArticles = articles.slice().sort((a, b) => {
    const dateA = a.date || '1970-01-01';
    const dateB = b.date || '1970-01-01';
    return dateA.localeCompare(dateB); // 升序，旧在前，新在后
});

const total = sortedArticles.length;
const totalPages = Math.ceil(total / PAGE_SIZE);

// 生成分页文件
for (let i = 0; i < totalPages; i++) {
    const start = i * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const pageData = {
        total: total,
        totalPages: totalPages,
        page: i + 1,
        list: sortedArticles.slice(start, end)
    };
    fs.writeFileSync(
        path.join(outputDir, `page-${i + 1}.json`),
        JSON.stringify(pageData, null, 2),
        'utf-8'
    );
    console.log(`✅ 生成 page-${i + 1}.json (${end - start} 篇)`);
}

// 生成全量数据（用于详情页、搜索、统计）
fs.writeFileSync(
    path.join(outputDir, 'all.json'),
    JSON.stringify({ total, list: sortedArticles }, null, 2),
    'utf-8'
);
console.log(`✅ 生成 all.json (全部 ${total} 篇)`);

// 生成元数据（总页数、总数）
fs.writeFileSync(
    path.join(outputDir, 'meta.json'),
    JSON.stringify({ total, totalPages }, null, 2),
    'utf-8'
);
console.log(`✅ 生成 meta.json (总页数 ${totalPages})`);

console.log(`🎉 拆分完成！共 ${total} 篇文章，${totalPages} 页，按日期升序排列（最旧在前）`);
