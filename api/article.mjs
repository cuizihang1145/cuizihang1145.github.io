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
  if (!userAgent) {
    console.log('[isCrawler] userAgent 为空');
    return false;
  }
  const result = CRAWLERS.some(regex => regex.test(userAgent));
  console.log('[isCrawler] userAgent:', userAgent, '结果:', result);
  return result;
}

export default function handler(req, res) {
  console.log('[handler] 请求到达');
  console.log('[handler] req.url:', req.url);
  console.log('[handler] req.method:', req.method);
  console.log('[handler] req.headers.user-agent:', req.headers['user-agent'] || '无');
  console.log('[handler] req.query:', req.query);

  const userAgent = req.headers['user-agent'] || '';
  const id = req.query.id;
  console.log('[handler] 提取到的 id:', id);

  if (!id) {
    console.log('[handler] id 缺失，返回 400');
    return res.status(400).send('缺少 id');
  }

  const projectRoot = path.resolve(__dirname, '..');
  const jsonPath = path.join(projectRoot, 'articles', `article-${id}.json`);
  const htmlPath = path.join(projectRoot, 'public', 'article.html');

  console.log('[handler] projectRoot:', projectRoot);
  console.log('[handler] jsonPath:', jsonPath);
  console.log('[handler] htmlPath:', htmlPath);

  console.log('[handler] 开始读取 JSON 文件');
  let raw;
  try {
    raw = fs.readFileSync(jsonPath, 'utf-8');
    console.log('[handler] JSON 文件读取成功，长度:', raw.length);
  } catch (err) {
    console.log('[handler] JSON 文件读取失败:', err.message);
    return res.status(404).send('文章不存在');
  }

  let article;
  try {
    article = JSON.parse(raw);
    console.log('[handler] JSON 解析成功，标题:', article.title);
  } catch (err) {
    console.log('[handler] JSON 解析失败:', err.message);
    return res.status(404).send('文章不存在');
  }

  const isCrawlerRequest = isCrawler(userAgent);
  console.log('[handler] 是否为爬虫:', isCrawlerRequest);

  if (isCrawlerRequest) {
    console.log('[handler] 进入爬虫分支，开始渲染 Markdown');
    const contentHtml = renderMarkdown(article.content || '');
    console.log('[handler] Markdown 渲染完成，内容长度:', contentHtml.length);
    const responseHtml = `
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
    `;
    console.log('[handler] 返回爬虫 HTML，状态 200');
    return res.send(responseHtml);
  }

  console.log('[handler] 进入真人分支，开始读取 HTML 模板');
  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf-8');
    console.log('[handler] HTML 模板读取成功，长度:', html.length);
  } catch (err) {
    console.log('[handler] HTML 模板读取失败:', err.message);
    return res.status(404).send('页面文件缺失');
  }

  console.log('[handler] 返回 SPA 模板，状态 200');
  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
}
