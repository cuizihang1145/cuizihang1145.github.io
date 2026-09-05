import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getArticleRoutes() {
  try {
    const allJsonPath = path.join(__dirname, 'articles', 'all.json');
    if (!fs.existsSync(allJsonPath)) return [{ route: '/', output: 'index.html' }];
    const data = JSON.parse(fs.readFileSync(allJsonPath, 'utf-8'));
    const articles = data.list || [];
    
    // 每篇文章生成独立的 HTML，放到 post/ 目录
    return [
      { route: '/', output: 'index.html' },
      ...articles.map(a => ({
        route: `/article.html?id=${a.id}`,
        output: `post/${a.id}.html`
      }))
    ];
  } catch {
    return [{ route: '/', output: 'index.html' }];
  }
}

export default {
  routes: getArticleRoutes(),
  outDir: '.', // 输出到项目根目录（Vercel 会部署所有文件）
  render: {
    waitForSelector: '#appContent[data-ready="true"]',
    maxWaitTime: 15000,
  },
  spa: true,
  ignoreConsoleErrors: true,
  puppeteer: {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
};
