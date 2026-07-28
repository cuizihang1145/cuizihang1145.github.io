import fs from 'fs';
import path from 'path';
import Link from 'next/link';

function getAllPosts() {
  const filePath = path.join(process.cwd(), 'wenzhang.json');
  const jsonData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(jsonData);
  return data.announcements || [];
}

export default function Home() {
  const posts = getAllPosts();
  const visiblePosts = posts.filter(p => p.delete !== true);

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

      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '1.5rem' }}>文章列表</h1>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {visiblePosts.map((post) => {
          const realIndex = posts.indexOf(post);
          return (
            <li key={realIndex} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <Link href={`/article/${realIndex}`} style={{ textDecoration: 'none', color: '#1A1A2E', fontSize: '1.1rem', fontWeight: 500 }}>
                {post.title}
              </Link>
              <div style={{ color: '#8A8AB5', fontSize: '0.85rem', marginTop: '0.2rem' }}>{post.date}</div>
            </li>
          );
        })}
      </ul>

      <footer className="footer">
        <p>© ks · 个人博客 · 2026</p>
      </footer>
    </div>
  );
    }
