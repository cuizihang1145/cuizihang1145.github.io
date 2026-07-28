import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function getAllPosts() {
  const filePath = path.join(process.cwd(), 'wenzhang.json');
  const jsonData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(jsonData);
  return data.announcements || [];
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((_, index) => ({
    id: String(index),
  }));
}

function countWords(markdown) {
  if (!markdown) return 0;
  let text = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^---$/gm, '')
    .replace(/^\s*[-*+]\s+\[[ x]\]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length;
}

function calculateReadTime(wordCount) {
  const minutes = Math.ceil(wordCount / 300);
  return minutes < 1 ? 1 : minutes;
}

export default function ArticlePage({ params }) {
  const posts = getAllPosts();
  const id = parseInt(params.id);
  const post = posts[id];

  if (!post || post.delete === true) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <h1>404</h1>
        <p style={{ color: '#8A8AB5' }}>文章不存在或已被删除</p>
        <Link href="/" style={{ color: '#6B5ACF' }}>← 返回首页</Link>
      </div>
    );
  }

  const prevIndex = id - 1;
  const nextIndex = id + 1;
  const prevPost = prevIndex >= 0 && posts[prevIndex]?.delete !== true ? posts[prevIndex] : null;
  const nextPost = nextIndex < posts.length && posts[nextIndex]?.delete !== true ? posts[nextIndex] : null;

  const wordCount = countWords(post.content || '');
  const readTime = calculateReadTime(wordCount);

  return (
    <div className="container">
      <div className="site-header">
        <div className="avatar">
          <img className="avatar-img" src="https://s41.ax1x.com/2026/05/10/peOiehj.jpg" alt="ks头像" />
        </div>
        <div className="header-text">
          <h1 className="site-title">ks</h1>
          <div className="welcome-tag">
            <i className="far fa-smile"></i> Hi，这里是 ks 的个人站点
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#6B5ACF', textDecoration: 'none' }}>
          ← 返回列表
        </Link>
      </div>

      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1A1A2E', marginBottom: '0.3rem', lineHeight: 1.3 }}>
        {post.title}
      </h1>

      <div style={{ fontSize: '0.85rem', color: '#8A8AB5', marginBottom: '0.6rem' }}>
        {post.date} · 大约 {readTime} 分钟 · {wordCount} 字
      </div>

      {post.tags && post.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', marginBottom: '1rem' }}>
          {post.tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#6B5ACF',
                background: 'rgba(107, 90, 207, 0.10)',
                padding: '0.1rem 0.7rem 0.1rem 0.5rem',
                borderRadius: '40px',
              }}
            >
              <i className="fas fa-tag" style={{ fontSize: '0.6rem', opacity: 0.7 }}></i>
              {tag}
            </span>
          ))}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.06)', marginBottom: '1.5rem' }} />

      <div style={{ fontSize: '1rem', lineHeight: 1.9, color: '#2D2D4A', wordBreak: 'break-word' }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content || '（暂无内容）'}
        </ReactMarkdown>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.06)', margin: '2rem 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {prevPost ? (
          <Link href={`/article/${prevIndex}`} style={{ color: '#6B5ACF', textDecoration: 'none' }}>
            ← {prevPost.title}
          </Link>
        ) : (
          <span style={{ color: '#ccc' }}>已是最新</span>
        )}
        {nextPost ? (
          <Link href={`/article/${nextIndex}`} style={{ color: '#6B5ACF', textDecoration: 'none' }}>
            {nextPost.title} →
          </Link>
        ) : (
          <span style={{ color: '#ccc' }}>已是最后一篇</span>
        )}
      </div>

      <footer className="footer">
        <p>© ks · 个人博客 · 2026</p>
      </footer>
    </div>
  );
    }
