import { defineConfig } from 'vite';
import prerenderStatic from 'vite-plugin-prerender-static';
import fs from 'fs';
import path from 'path';

function getArticleRoutes() {
  try {
    const allJsonPath = path.join(process.cwd(), 'articles', 'all.json');
    if (!fs.existsSync(allJsonPath)) return [];
    const data = JSON.parse(fs.readFileSync(allJsonPath, 'utf-8'));
    const articles = data.list || [];
    return articles.map(a => `/post/${a.id}`);
  } catch {
    return [];
  }
}

export default defineConfig({
  plugins: [
    prerenderStatic({
      routes: ['/', ...getArticleRoutes()],
      staticDir: '.',
    }),
  ],
});
