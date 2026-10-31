const { renderMarkdown } = require('../assets/markdown/markdown-node.js');
const fs = require('fs/promises');
const path = require('path');

const SITE = {
  url: 'https://www.cuizi.top',
  title: 'ks的博客',
  subtitle: 'ks的个人博客。保持好奇，保持诚实。',
  author: 'ks',
  language: 'zh-CN',
  icon: 'https://www.cuizi.top/logo.png'
};

const SUMMARY_LEN = 200;
const CACHE_TTL = 60000;
let _cache = { list: null, stamp: 0 };

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function cdata(text) {
  if (text === null || text === undefined) return '<![CDATA[]]>';
  return '<![CDATA[' + String(text).split(']]>').join(']]]]><![CDATA[>') + ']]>';
}

function absolutize(html, base) {
  return String(html).replace(
    /(\s(?:src|href|poster|data-src))=(["'])(?!https?:|\/\/|data:|mailto:|tel:|#|javascript:)([^"']*)\2/gi,
    (m, attr, q, url) => {
      const full = url.startsWith('/') ? base + url : base + '/' + url;
      return attr + '=' + q + full + q;
    }
  );
}

function pickCover(html) {
  const m = String(html).match(/<img[^>]+src=(["'])([^"']+)\1/i);
  return m ? m[2] : '';
}

function visibleLength(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

function truncateHtml(html, maxVisible) {
  if (!html) return '';
  const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
  const stack = [];
  let visible = 0;
  let out = '';
  let i = 0;
  const len = html.length;
  while (i < len) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i);
      if (end === -1) break;
      const tag = html.slice(i, end + 1);
      const m = tag.match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/);
      if (m) {
        const isClose = !!m[1];
        const name = m[2].toLowerCase();
        if (isClose) {
          for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k] === name) { stack.splice(k, 1); break; }
          }
        } else if (!VOID.test(name) && !/\/\s*>$/.test(tag)) {
          stack.push(name);
        }
      }
      out += tag;
      i = end + 1;
    } else {
      if (visible >= maxVisible) break;
      out += html[i];
      visible++;
      i++;
    }
  }
  while (stack.length) out += '</' + stack.pop() + '>';
  return out + (i < len ? '…' : '');
}

async function loadArticles() {
  const filePath = path.join(__dirname, '..', 'articles', 'all.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data.list) ? data.list : [];
  return list.slice();
}

async function getArticles() {
  if (_cache.list && Date.now() - _cache.stamp < CACHE_TTL) return _cache.list;
  const raw = await loadArticles();
  const list = raw.map(item => {
    let html;
    try {
      html = renderMarkdown(item.content || '');
    } catch (e) {
      html = escapeXml(item.content || '');
    }
    html = absolutize(html, SITE.url);
    const visible = visibleLength(html);
    const isShort = visible <= SUMMARY_LEN;
    return Object.assign({}, item, {
      _html: html,
      _visible: visible,
      _isShort: isShort,
      _summary: isShort ? html : truncateHtml(html, SUMMARY_LEN),
      _cover: pickCover(html),
      _tagCount: Array.isArray(item.tags) ? item.tags.length : 0
    });
  });
  _cache = { list, stamp: Date.now() };
  return list;
}

function filterArticles(articles, q) {
  let list = articles;
  if (q.all && q.all !== '0') {
    list = list.filter(a => {
      const v = (a.all === undefined || a.all === null) ? '' : String(a.all);
      return v === q.all;
    });
  }
  if (q.tag) {
    list = list.filter(a => Array.isArray(a.tags) && a.tags.indexOf(q.tag) >= 0);
  }
  if (q.date) {
    list = list.filter(a => String(a.date || '').startsWith(q.date));
  }
  if (q.month) {
    list = list.filter(a => String(a.date || '').startsWith(q.month));
  }
  if (q.year) {
    list = list.filter(a => String(a.date || '').startsWith(q.year));
  }
  return list;
}

function sortArticles(articles, key, order) {
  const dir = order === 'asc' ? 1 : -1;
  const list = articles.slice();
  list.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'title':
        cmp = String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN');
        break;
      case 'id':
        cmp = (Number(a.id) || 0) - (Number(b.id) || 0);
        break;
      case 'length':
        cmp = (a._visible || 0) - (b._visible || 0);
        break;
      case 'tags':
        cmp = (a._tagCount || 0) - (b._tagCount || 0);
        break;
      case 'date':
      default:
        cmp = String(a.date || '').localeCompare(String(b.date || ''));
        break;
    }
    if (cmp === 0) {
      cmp = (Number(a.id) || 0) - (Number(b.id) || 0);
    }
    return dir * cmp;
  });
  return list;
}

function paginate(articles, limit, offset) {
  if (!limit && !offset) return articles;
  const start = offset > 0 ? offset : 0;
  if (limit > 0) return articles.slice(start, start + limit);
  return articles.slice(start);
}

function buildSelfUrl(type, q) {
  const params = ['type=' + encodeURIComponent(type)];
  if (q.all) params.push('all=' + encodeURIComponent(q.all));
  if (q.tag) params.push('tag=' + encodeURIComponent(q.tag));
  if (q.year) params.push('year=' + encodeURIComponent(q.year));
  if (q.month) params.push('month=' + encodeURIComponent(q.month));
  if (q.date) params.push('date=' + encodeURIComponent(q.date));
  if (q.sort !== 'date') params.push('sort=' + encodeURIComponent(q.sort));
  if (q.order !== 'desc') params.push('order=' + encodeURIComponent(q.order));
  if (q.limit > 0) params.push('limit=' + q.limit);
  if (q.offset > 0) params.push('offset=' + q.offset);
  if (!q.xsl) params.push('xsl=0');
  return SITE.url + '/api/feed?' + params.join('&');
}

function buildFeedTitle(q) {
  const parts = [SITE.title];
  if (q.all === '1') parts.push('精选');
  else if (q.all && q.all !== '0') parts.push('all=' + q.all);
  if (q.tag) parts.push('#' + q.tag);
  if (q.date) parts.push(q.date);
  else if (q.month) parts.push(q.month);
  else if (q.year) parts.push(q.year);
  if (q.sort === 'title') parts.push('按标题');
  else if (q.sort === 'id') parts.push('按编号');
  else if (q.sort === 'length') parts.push('按长度');
  else if (q.sort === 'tags') parts.push('按标签数');
  if (q.sort !== 'date') parts.push(q.order === 'asc' ? '升序' : '降序');
  if (q.limit > 0) {
    if (q.offset > 0) parts.push('第 ' + (Math.floor(q.offset / q.limit) + 1) + ' 页');
    else parts.push('前 ' + q.limit + ' 篇');
  }
  return parts.join(' · ');
}

function xmlHeader(xsl) {
  const base = '<?xml version="1.0" encoding="UTF-8" ?>\n';
  if (!xsl) return base;
  return base + '<?xml-stylesheet type="text/xsl" href="/assets/feed.xsl"?>\n';
}

function buildAtom(articles, selfUrl, feedTitle, xsl) {
  const now = new Date().toISOString();
  let entries = '';
  for (const item of articles) {
    const id = SITE.url + '/article.html?id=' + item.id;
    const updated = new Date(item.date || Date.now()).toISOString();
    entries += '\n  <entry>';
    entries += '\n    <id>' + escapeXml(id) + '</id>';
    entries += '\n    <title>' + escapeXml(item.title || '无标题') + '</title>';
    entries += '\n    <link href="' + escapeXml(id) + '" rel="alternate" type="text/html"/>';
    entries += '\n    <updated>' + updated + '</updated>';
    entries += '\n    <published>' + updated + '</published>';
    entries += '\n    <author><name>' + escapeXml(SITE.author) + '</name></author>';
    if (item._cover) entries += '\n    <link href="' + escapeXml(item._cover) + '" rel="enclosure" type="image/*"/>';
    if (Array.isArray(item.tags)) {
      for (const t of item.tags) entries += '\n    <category term="' + escapeXml(t) + '"/>';
    }
    if (item._isShort) {
      entries += '\n    <content type="html">' + cdata(item._summary) + '</content>';
    } else {
      entries += '\n    <summary type="html">' + cdata(item._summary) + '</summary>';
      entries += '\n    <content type="html">' + cdata(item._html) + '</content>';
    }
    entries += '\n  </entry>';
  }
  return xmlHeader(xsl) +
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="' + SITE.language + '">\n' +
    '  <id>' + escapeXml(selfUrl) + '</id>\n' +
    '  <title>' + escapeXml(feedTitle) + '</title>\n' +
    '  <subtitle>' + escapeXml(SITE.subtitle) + '</subtitle>\n' +
    '  <link href="' + escapeXml(selfUrl) + '" rel="self" type="application/atom+xml"/>\n' +
    '  <link href="' + escapeXml(SITE.url) + '" rel="alternate" type="text/html"/>\n' +
    '  <updated>' + now + '</updated>\n' +
    '  <icon>' + escapeXml(SITE.icon) + '</icon>\n' +
    '  <author><name>' + escapeXml(SITE.author) + '</name></author>' +
    entries + '\n</feed>';
}

function buildRSS(articles, selfUrl, feedTitle, xsl) {
  const now = new Date().toUTCString();
  let items = '';
  for (const item of articles) {
    const link = SITE.url + '/article.html?id=' + item.id;
    const pubDate = new Date(item.date || Date.now()).toUTCString();
    items += '\n  <item>';
    items += '\n    <title>' + escapeXml(item.title || '无标题') + '</title>';
    items += '\n    <link>' + escapeXml(link) + '</link>';
    items += '\n    <guid isPermaLink="true">' + escapeXml(link) + '</guid>';
    items += '\n    <pubDate>' + pubDate + '</pubDate>';
    items += '\n    <author>' + escapeXml(SITE.author) + '</author>';
    if (Array.isArray(item.tags)) {
      for (const t of item.tags) items += '\n    <category>' + escapeXml(t) + '</category>';
    }
    if (item._cover) items += '\n    <enclosure url="' + escapeXml(item._cover) + '" type="image/*" length="0"/>';
    items += '\n    <description>' + cdata(item._summary) + '</description>';
    if (!item._isShort) {
      items += '\n    <content:encoded>' + cdata(item._html) + '</content:encoded>';
    }
    items += '\n  </item>';
  }
  return xmlHeader(xsl) +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n' +
    '  <channel>\n' +
    '    <title>' + escapeXml(feedTitle) + '</title>\n' +
    '    <link>' + escapeXml(SITE.url) + '</link>\n' +
    '    <description>' + escapeXml(SITE.subtitle) + '</description>\n' +
    '    <language>' + SITE.language + '</language>\n' +
    '    <lastBuildDate>' + now + '</lastBuildDate>\n' +
    '    <atom:link href="' + escapeXml(selfUrl) + '" rel="self" type="application/rss+xml"/>' +
    items + '\n  </channel>\n</rss>';
}

function buildJSONFeed(articles, selfUrl, feedTitle) {
  const items = articles.map(item => {
    const entry = {
      id: SITE.url + '/article.html?id=' + item.id,
      url: SITE.url + '/article.html?id=' + item.id,
      title: item.title || '无标题',
      date_published: new Date(item.date || Date.now()).toISOString(),
      authors: [{ name: SITE.author }]
    };
    if (item._isShort) {
      entry.content_html = item._summary;
    } else {
      entry.summary = item._summary;
      entry.content_html = item._html;
    }
    if (item._cover) entry.image = item._cover;
    if (Array.isArray(item.tags)) entry.tags = item.tags.slice();
    return entry;
  });
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: feedTitle,
    home_page_url: SITE.url,
    feed_url: selfUrl,
    description: SITE.subtitle,
    language: SITE.language,
    authors: [{ name: SITE.author }],
    items
  };
}

function makeEtag(articles, type, rawUrl) {
  const n = articles.length;
  const first = articles[0] ? articles[0].date || '' : '';
  const last = articles.length ? articles[articles.length - 1].date || '' : '';
  return '"' + type + ':' + n + ':' + first + ':' + last + ':' + rawUrl + '"';
}

function pickValue(v) {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string') return v;
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const type = pickValue(req.query.type);
    if (!['atom', 'rss', 'json'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Use ?type=atom, ?type=rss, or ?type=json' });
    }

    const xslRaw = pickValue(req.query.xsl).toLowerCase();
    const xsl = xslRaw !== '0' && xslRaw !== 'no' && xslRaw !== 'false';

    const q = {
      all: pickValue(req.query.all),
      tag: pickValue(req.query.tag),
      year: pickValue(req.query.year),
      month: pickValue(req.query.month),
      date: pickValue(req.query.date),
      sort: pickValue(req.query.sort) || 'date',
      order: pickValue(req.query.order) || 'desc',
      limit: parseInt(pickValue(req.query.limit), 10) || 0,
      offset: parseInt(pickValue(req.query.offset), 10) || 0,
      xsl: xsl
    };

    if (!['date', 'title', 'id', 'length', 'tags'].includes(q.sort)) q.sort = 'date';
    if (q.order !== 'asc') q.order = 'desc';
    if (q.limit > 500) q.limit = 500;
    if (q.limit < 0) q.limit = 0;
    if (q.offset < 0) q.offset = 0;

    const all = await getArticles();
    const filtered = filterArticles(all, q);
    const sorted = sortArticles(filtered, q.sort, q.order);
    const sliced = paginate(sorted, q.limit, q.offset);

    const selfUrl = buildSelfUrl(type, q);
    const feedTitle = buildFeedTitle(q);

    const etag = makeEtag(sliced, type, req.url);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    let body, contentType;
    if (type === 'atom') {
      body = buildAtom(sliced, selfUrl, feedTitle, xsl);
      contentType = 'application/atom+xml; charset=utf-8';
    } else if (type === 'rss') {
      body = buildRSS(sliced, selfUrl, feedTitle, xsl);
      contentType = 'application/xml; charset=utf-8';
    } else {
      body = JSON.stringify(buildJSONFeed(sliced, selfUrl, feedTitle), null, 2);
      contentType = 'application/json; charset=utf-8';
    }

    res.setHeader('Content-Type', contentType);
    return res.status(200).send(body);
  } catch (error) {
    console.error('Feed 生成失败:', error.stack || error.message);
    res.status(500).send('Feed 生成失败');
  }
};
