import fs from 'fs';
import path from 'path';
import { renderMarkdown } from '../assets/markdown/markdown-node.js';

const CRAWLERS = [
  /Googlebot/i, /Googlebot-Image/i, /Googlebot-Video/i, /Googlebot-News/i,
  /GoogleOther/i, /GoogleOther-Image/i, /GoogleOther-Video/i,
  /AdsBot-Google/i, /AdsBot-Google-Mobile/i, /APIs-Google/i,
  /Google-InspectionTool/i, /Google-Read-Aloud/i, /Google-Extended/i,
  /Mediapartners-Google/i, /Storebot-Google/i,
  /bingbot/i, /msnbot/i, /BingPreview/i,
  /Slurp/i, /DuckDuckBot/i, /Baiduspider/i,
  /YandexBot/i, /Sogou web spider/i, /Exabot/i,
  /Qwantify/i, /PetalBot/i, /AspiegelBot/i,
  /SeznamBot/i, /Yeti/i, /NaverBot/i, /Daumoa/i,
  /Y!J/i, /360spider/i, /Sonic/i, /YoudaoBot/i,
  /GPTBot/i, /ChatGPT-User/i, /OAI-SearchBot/i,
  /ClaudeBot/i, /Claude-Web/i, /Claude-SearchBot/i, /Claude-User/i,
  /PerplexityBot/i, /Perplexity-User/i,
  /Cohere/i, /cohere-ai/i, /CCBot/i,
  /Meta-ExternalAgent/i, /Meta-ExternalFetcher/i,
  /Applebot/i, /Applebot-Extended/i, /AppleNewsBot/i,
  /facebookexternalhit/i, /Facebot/i, /Twitterbot/i,
  /LinkedInBot/i, /MojeekBot/i, /Google-CloudVertexBot/i,
  /Bytespider/i, /DuckAssistBot/i, /MistralAI-User/i,
  /Amazonbot/i, /FacebookBot/i,
  /AhrefsBot/i, /SemrushBot/i, /SemrushBot-SA/i,
  /MJ12bot/i, /BLEXBot/i, /DotBot/i, /DataForSeoBot/i,
  /Barkrowler/i, /linkdexbot/i, /AddSearchBot/i,
  /CazoodleBot/i, /Sosospider/i, /JikeSpider/i,
  /iaskspider/i, /ChatGLM-Spider/i, /TikTokSpider/i,
  /TavilyBot/i, /CragCrawler/i, /IbouBot/i,
  /ICC-Crawler/i, /ImagesiftBot/i, /VelenPublicWebCrawler/i,
  /BuddyBot/i, /Thinkbot/i, /TerraCotta/i
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  return CRAWLERS.some(regex => regex.test(userAgent));
}

export default function handler(req, res) {
  // ===== 日志：请求到达 =====
  console.log('=== article.mjs 被调用 ===');
  console.log('请求路径:', req.url);
  console.log('User-Agent:', req.headers['user-agent'] || '无');
  console.log('查询参数 id:', req.query.id);

  const userAgent = req.headers['user-agent'] || '';
  const id = req.query.id;

  if (!id) {
    console.log('❌ 缺少 id 参数');
    return res.status(400).send('缺少 id');
  }

  console.log('📂 尝试读取文件: articles/article-' + id + '.json');

  const filePath = path.join(process.cwd(), 'articles', 'article-' + id + '.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const article = JSON.parse(raw);
    console.log('✅ 文章加载成功:', article.title);

    const isCrawlerRequest = isCrawler(userAgent);
    console.log('🕷️ 是否爬虫:', isCrawlerRequest);

    if (isCrawlerRequest) {
      console.log('📤 返回完整 HTML（爬虫分支）');
      const contentHtml = renderMarkdown(article.content || '');
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${article.title}</title>
            <meta name="description" content="${article.summary || ''}" />
          </head>
          <body>
            <h1>${article.title}</h1>
            <div>${contentHtml}</div>
          </body>
        </html>
      `);
    }

    console.log('📤 返回 SPA 空壳（真人分支）');
    const html = fs.readFileSync(path.join(process.cwd(), 'public', 'article.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);

  } catch (err) {
    console.log('❌ 读取失败:', err.message);
    return res.status(404).send('文章不存在');
  }
                                }
