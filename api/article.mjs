import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderMarkdown } from '../assets/markdown/markdown-node.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const userAgent = req.headers['user-agent'] || '';
  const id = req.query.id;
  if (!id) {
    return res.status(400).send('缺少 id');
  }

  // 统一用 __dirname 定位，不用 process.cwd()
  const projectRoot = path.resolve(__dirname, '..');
  const jsonPath = path.join(projectRoot, 'articles', `article-${id}.json`);
  const htmlPath = path.join(projectRoot, 'public', 'article.html');

  let article;
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    article = JSON.parse(raw);
  } catch {
    return res.status(404).send('文章不存在');
  }

  if (isCrawler(userAgent)) {
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

  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf-8');
  } catch {
    return res.status(404).send('页面文件缺失');
  }

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
}
