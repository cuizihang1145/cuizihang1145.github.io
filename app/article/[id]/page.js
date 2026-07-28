import fs from 'fs';
import path from 'path';

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

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderMarkdown(md) {
  if (!md) return '';
  
  // 简化版Markdown渲染（只处理基本语法）
  let html = md;
  // 标题
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  // 粗体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // 斜体
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  // 代码块
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 分割线
  html = html.replace(/^---$/gim, '<hr />');
  // 段落（简单处理）
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  // 清理空标签
  html = html.replace(/<p><\/p>/g, '');
  
  return html;
}

export default function ArticlePage({ params }) {
  const posts = getAllPosts();
  const id = parseInt(params.id);
  const post = posts[id];

  if (!post || post.delete === true) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <h1>404</h1>
        <p style={{ color: '#8A8AB5' }}>文章不存在或已被删除</p>
      </div>
    );
  }

  const title = post.title || '无标题';
  const date = post.date || '';
  const content = post.content || '（暂无内容）';
  const tags = post.tags || [];
  
  // 计算字数和阅读时间
  const wordCount = content.replace(/```[\s\S]*?```/g, '').replace(/[#*\`\[\]()>]/g, '').length;
  const readTime = Math.ceil(wordCount / 300) || 1;

  let tagsHtml = '';
  if (tags.length > 0) {
    tagsHtml = '<div class="detail-tags">';
    tags.forEach(function(tag) {
      tagsHtml += '<span class="tag"><i class="fas fa-tag"></i> ' + escapeHtml(tag) + '</span>';
    });
    tagsHtml += '</div>';
  }

  const renderedContent = renderMarkdown(content);

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
        <title>{escapeHtml(title)} · ks</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" />
        <link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
        <style dangerouslySetInnerHTML={{
          __html: `
            * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
            body { font-family:'Inter',-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; background:#FAFAFE; color:#1A1A2E; line-height:1.8; min-height:100vh; transition:background 0.4s ease,color 0.3s ease; }
            body.dark { background:#14131F; color:#E8E6F0; }
            .reading-progress { position:fixed; top:0; left:0; width:100%; height:3px; background:rgba(0,0,0,0.08); z-index:9999; pointer-events:none; opacity:1; transition:opacity 0.3s ease; }
            body.dark .reading-progress { background:rgba(255,255,255,0.1); }
            .reading-progress .progress-bar { height:100%; width:0%; background:#4A90D9; border-radius:0 4px 4px 0; transition:width 0.05s linear; }
            body.dark .reading-progress .progress-bar { background:#60A5FA; }
            .bg-glow { position:fixed; top:0; left:0; width:100%; height:100%; z-index:-2; background:radial-gradient(circle at 30% 30%, #F6F2FF, #FFFFFF); transition:background 0.5s ease; }
            body.dark .bg-glow { background:radial-gradient(circle at 30% 30%, #28253D, #0E0D18); }
            .glow-soft { position:fixed; width:70vw; height:70vw; background:radial-gradient(circle, rgba(160,130,230,0.15), rgba(210,190,255,0) 70%); border-radius:50%; top:-25vh; right:-20vw; z-index:-1; filter:blur(80px); animation:floatGlow 20s infinite alternate ease-in-out; transition:background 0.5s ease; }
            body.dark .glow-soft { background:radial-gradient(circle, rgba(120,100,200,0.20), rgba(60,40,120,0) 70%); }
            .glow-soft-2 { position:fixed; width:50vw; height:50vw; background:radial-gradient(circle, rgba(200,180,255,0.10), rgba(255,240,255,0) 70%); border-radius:50%; bottom:-15vh; left:-10vw; z-index:-1; filter:blur(70px); animation:floatGlow2 22s infinite alternate ease-in-out; transition:background 0.5s ease; }
            body.dark .glow-soft-2 { background:radial-gradient(circle, rgba(90,70,160,0.15), rgba(30,20,60,0) 70%); }
            @keyframes floatGlow { 0% { transform:translate(0,0) scale(1); opacity:0.3; } 100% { transform:translate(5%,8%) scale(1.2); opacity:0.7; } }
            @keyframes floatGlow2 { 0% { transform:translate(0,0) scale(1); opacity:0.2; } 100% { transform:translate(-6%,-5%) scale(1.3); opacity:0.6; } }
            .container { max-width:700px; margin:0 auto; padding:2.8rem 1.8rem 2rem; display:flex; flex-direction:column; min-height:100vh; position:relative; }
            .top-buttons { position:fixed; top:20px; left:20px; right:20px; z-index:50; display:flex; justify-content:space-between; align-items:center; pointer-events:none; }
            .top-buttons .left, .top-buttons .right { pointer-events:auto; display:flex; align-items:center; gap:0.5rem; }
            .back-btn { background:rgba(255,255,255,0.6); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,0.8); border-radius:60px; padding:0.5rem 1.2rem 0.5rem 1rem; display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; font-weight:500; color:#4F4F78; text-decoration:none; transition:0.25s ease; box-shadow:0 6px 20px rgba(80,60,160,0.10); cursor:pointer; font-family:'Inter',sans-serif; }
            body.dark .back-btn { background:rgba(30,28,50,0.7); border-color:rgba(255,255,255,0.08); color:#D0CAF0; box-shadow:0 6px 20px rgba(0,0,0,0.3); }
            .back-btn:hover { background:rgba(255,255,255,0.85); transform:translateY(-2px) scale(1.02); }
            body.dark .back-btn:hover { background:rgba(50,45,80,0.8); }
            .back-btn i { font-size:0.9rem; }
            .share-btn { background:rgba(255,255,255,0.6); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,0.8); border-radius:60px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; color:#4F4F78; transition:0.25s ease; box-shadow:0 6px 20px rgba(80,60,160,0.10); cursor:pointer; font-family:'Inter',sans-serif; }
            body.dark .share-btn { background:rgba(30,28,50,0.7); border-color:rgba(255,255,255,0.08); color:#D0CAF0; box-shadow:0 6px 20px rgba(0,0,0,0.3); }
            .share-btn:hover { background:rgba(255,255,255,0.85); transform:scale(1.05); }
            body.dark .share-btn:hover { background:rgba(50,45,80,0.8); }
            .share-btn i { font-size:1.2rem; }
            .back-to-top-btn { position:fixed; top:20px; right:80px; z-index:49; width:48px; height:48px; border:none; border-radius:50%; background:rgba(255,255,255,0.6); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.8); color:#4F4F78; font-size:1.2rem; cursor:pointer; transition:opacity 0.35s ease,transform 0.25s ease,background 0.3s ease,box-shadow 0.3s ease; box-shadow:0 6px 20px rgba(80,60,160,0.10); opacity:0; pointer-events:none; user-select:none; display:flex; align-items:center; justify-content:center; }
            .back-to-top-btn:hover { transform:scale(1.05); background:rgba(255,255,255,0.85); box-shadow:0 10px 28px rgba(80,60,160,0.18); }
            .back-to-top-btn.show { opacity:1; pointer-events:auto; }
            body.dark .back-to-top-btn { background:rgba(30,28,50,0.7); border-color:rgba(255,255,255,0.08); color:#D0CAF0; box-shadow:0 6px 20px rgba(0,0,0,0.3); }
            body.dark .back-to-top-btn:hover { background:rgba(50,45,80,0.8); }
            .theme-toggle { position:fixed; top:20px; right:24px; z-index:50; background:rgba(255,255,255,0.6); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.8); border-radius:60px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; color:#4F4F78; cursor:pointer; transition:0.3s ease; box-shadow:0 6px 20px rgba(80,60,160,0.10); user-select:none; }
            .theme-toggle:hover { transform:scale(1.05) rotate(8deg); background:rgba(255,255,255,0.85); box-shadow:0 10px 28px rgba(80,60,160,0.18); }
            body.dark .theme-toggle { background:rgba(30,28,50,0.7); border-color:rgba(255,255,255,0.08); color:#D0CAF0; box-shadow:0 6px 20px rgba(0,0,0,0.3); }
            body.dark .theme-toggle:hover { background:rgba(50,45,80,0.8); }
            .theme-toggle:active { transform:scale(0.92); }
            @media (max-width:560px) { .back-to-top-btn { top:14px; right:66px; width:42px; height:42px; font-size:1rem; } .theme-toggle { top:14px; right:16px; width:42px; height:42px; font-size:1.2rem; } .share-btn { width:42px; height:42px; font-size:1rem; } .share-btn i { font-size:1rem; } .top-buttons { top:14px; left:14px; right:14px; } .back-btn { padding:0.4rem 1rem 0.4rem 0.8rem; font-size:0.75rem; } .back-btn i { font-size:0.8rem; } .reading-progress { height:2px; } }
            .article-detail { max-width:640px; margin:0 auto; padding-top:2rem; width:100%; }
            .article-detail .detail-title { font-size:2rem; font-weight:700; color:#1A1A2E; margin-bottom:0.3rem; line-height:1.3; transition:color 0.3s ease; }
            body.dark .article-detail .detail-title { color:#E8E6F0; }
            .article-detail .detail-date { font-size:0.85rem; color:#8A8AB5; margin-bottom:0.6rem; display:block; transition:color 0.3s ease; }
            body.dark .article-detail .detail-date { color:#7A7AA0; }
            .article-detail .detail-tags { display:flex; flex-wrap:wrap; gap:0.4rem 0.6rem; margin-bottom:1rem; }
            .article-detail .detail-tags .tag { display:inline-flex; align-items:center; gap:0.25rem; font-size:0.75rem; font-weight:500; color:#6B5ACF; background:rgba(107,90,207,0.10); padding:0.1rem 0.7rem 0.1rem 0.5rem; border-radius:40px; transition:0.2s ease; cursor:pointer; user-select:none; text-decoration:none; }
            body.dark .article-detail .detail-tags .tag { color:#88ccff; background:rgba(136,204,255,0.10); }
            .article-detail .detail-tags .tag:hover { background:rgba(107,90,207,0.20); transform:scale(1.04); }
            body.dark .article-detail .detail-tags .tag:hover { background:rgba(136,204,255,0.20); }
            .article-detail .detail-tags .tag i { font-size:0.6rem; opacity:0.7; }
            .article-detail .detail-divider { border:none; border-top:1px solid rgba(0,0,0,0.06); margin-bottom:1.5rem; transition:border-color 0.3s ease; }
            body.dark .article-detail .detail-divider { border-top-color:rgba(255,255,255,0.06); }
            .article-detail .detail-content { font-size:1rem; line-height:1.9; color:#2D2D4A; word-break:break-word; transition:color 0.3s ease; }
            body.dark .article-detail .detail-content { color:#D0CAF0; }
            .article-detail .detail-content h1, .article-detail .detail-content h2, .article-detail .detail-content h3, .article-detail .detail-content h4, .article-detail .detail-content h5, .article-detail .detail-content h6 { font-weight:700; margin:1.2rem 0 0.6rem 0; line-height:1.3; color:#1A1A2E; transition:color 0.3s ease; }
            body.dark .article-detail .detail-content h1, body.dark .article-detail .detail-content h2, body.dark .article-detail .detail-content h3, body.dark .article-detail .detail-content h4, body.dark .article-detail .detail-content h5, body.dark .article-detail .detail-content h6 { color:#E8E6F0; }
            .article-detail .detail-content h1 { font-size:1.8rem; }
            .article-detail .detail-content h2 { font-size:1.5rem; }
            .article-detail .detail-content h3 { font-size:1.25rem; }
            .article-detail .detail-content h4 { font-size:1.1rem; }
            .article-detail .detail-content h5 { font-size:1rem; }
            .article-detail .detail-content h6 { font-size:0.9rem; opacity:0.7; }
            .article-detail .detail-content p { margin-bottom:0.8rem; transition:color 0.3s ease; }
            .article-detail .detail-content p:last-child { margin-bottom:0; }
            .article-detail .detail-content strong { color:#3D2D8A; font-weight:700; transition:color 0.3s ease; }
            body.dark .article-detail .detail-content strong { color:#C8C0F0; }
            .article-detail .detail-content em { font-style:italic; color:#6A6A92; transition:color 0.3s ease; }
            body.dark .article-detail .detail-content em { color:#A8A4C8; }
            .article-detail .detail-content a { color:#6B5ACF; text-decoration:underline; text-underline-offset:2px; transition:color 0.3s ease; }
            body.dark .article-detail .detail-content a { color:#88ccff; }
            .article-detail .detail-content ul, .article-detail .detail-content ol { padding-left:1.8rem; margin:0.6rem 0; word-break:break-word; }
            .article-detail .detail-content li { word-break:break-word; white-space:normal; max-width:100%; display:list-item; line-height:1.8; margin-bottom:0.2rem; }
            .article-detail .detail-content blockquote { border-left:4px solid #6B5ACF; padding-left:1.2rem; margin:0.8rem 0; color:#6A6A92; font-style:italic; transition:border-color 0.3s ease,color 0.3s ease; }
            body.dark .article-detail .detail-content blockquote { border-left-color:#88ccff; color:#A8A4C8; }
            .article-detail .detail-content hr { border:none; border-top:2px solid rgba(0,0,0,0.08); margin:1.5rem 0; transition:border-color 0.3s ease; }
            body.dark .article-detail .detail-content hr { border-top-color:rgba(255,255,255,0.08); }
            .article-detail .detail-content img { max-width:100%; height:auto; border-radius:12px; margin:0.8rem 0; display:block; box-shadow:0 4px 16px rgba(0,0,0,0.06); transition:box-shadow 0.3s ease; cursor:pointer; }
            body.dark .article-detail .detail-content img { box-shadow:0 4px 16px rgba(0,0,0,0.2); }
            .article-detail .detail-content code { font-family:'JetBrains Mono','Courier New',monospace; font-size:0.9em; background:rgba(0,0,0,0.06); padding:0.1rem 0.4rem; border-radius:4px; color:#D14C4C; transition:background 0.3s ease,color 0.3s ease; }
            body.dark .article-detail .detail-content code { background:rgba(255,255,255,0.06); color:#E8A87C; }
            .article-detail .detail-content pre { background:#0D1117; border-radius:12px; padding:1rem; overflow:auto; margin:0.8rem 0; }
            .article-detail .detail-content pre code { background:transparent; color:#E6EDF3; padding:0; }
            .not-found { text-align:center; padding:4rem 1rem; color:#8A8AB5; transition:color 0.3s ease; }
            body.dark .not-found { color:#8A8AB5; }
            .not-found i { font-size:3rem; display:block; margin-bottom:1rem; opacity:0.5; }
            #waline-comments { max-width:640px; margin:3rem auto 0; padding-top:1.5rem; border-top:1px solid rgba(0,0,0,0.06); }
            body.dark #waline-comments { border-top-color:rgba(255,255,255,0.06); }
            #waline-comments * { font-family:'Inter',-apple-system,"PingFang SC","Microsoft YaHei",sans-serif !important; }
            #waline-comments .wl-content a { word-break:break-all; overflow-wrap:break-word; max-width:100%; }
            .toast { position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(100px); background:rgba(28,26,44,0.92); backdrop-filter:blur(16px); padding:0.8rem 2.5rem; border-radius:60px; color:#EFEAFF; font-size:0.9rem; font-weight:500; font-family:'Inter',sans-serif; border:1px solid rgba(255,255,255,0.08); box-shadow:0 16px 40px rgba(0,0,0,0.3); opacity:0; transition:0.4s cubic-bezier(0.34,1.56,0.64,1); z-index:1000; pointer-events:none; white-space:nowrap; min-width:240px; text-align:center; }
            body.dark .toast { background:rgba(20,18,30,0.95); border-color:rgba(255,255,255,0.05); }
            .toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
            .toast i { margin-right:0.5rem; font-size:1rem; }
            .toast .fa-check-circle { color:#4ade80; }
            .toast .fa-info-circle { color:#60a5fa; }
            .toast .fa-exclamation-circle { color:#fbbf24; }
            @media (max-width:480px) { .toast { font-size:0.8rem; padding:0.6rem 1.5rem; min-width:180px; white-space:normal; } }
            .share-modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0); backdrop-filter:blur(0px); z-index:999; display:none; justify-content:center; align-items:center; padding:1.5rem; opacity:0; visibility:hidden; transition:opacity 0.3s ease,background 0.3s ease,backdrop-filter 0.3s ease,visibility 0.3s ease; }
            .share-modal-overlay.active { display:flex; opacity:1; visibility:visible; background:rgba(0,0,0,0.5); backdrop-filter:blur(8px); }
            .share-modal-overlay .share-modal-box { max-width:480px; width:100%; background:rgba(255,255,255,0.85); backdrop-filter:blur(24px); border-radius:2rem; padding:2rem 1.8rem 1.8rem; border:1px solid rgba(255,255,255,0.5); box-shadow:0 24px 60px rgba(0,0,0,0.15); text-align:center; animation:modalFadeIn 0.3s ease; transition:background 0.4s ease,border-color 0.3s ease,box-shadow 0.3s ease; max-height:90vh; overflow-y:auto; }
            body.dark .share-modal-overlay .share-modal-box { background:rgba(30,28,50,0.92); border-color:rgba(255,255,255,0.08); box-shadow:0 24px 60px rgba(0,0,0,0.5); }
            @keyframes modalFadeIn { 0% { opacity:0; transform:scale(0.92) translateY(20px); } 100% { opacity:1; transform:scale(1) translateY(0); } }
            .share-modal-overlay .share-modal-title { font-size:1.1rem; font-weight:600; color:#1a1a2e; margin-bottom:0.8rem; letter-spacing:0.3px; transition:color 0.3s ease; text-align:center; }
            body.dark .share-modal-overlay .share-modal-title { color:#fff; }
            .share-modal-overlay .share-modal-title i { margin-right:0.5rem; color:#624ed0; }
            body.dark .share-modal-overlay .share-modal-title i { color:#88ccff; }
            #sharePreviewWrap { border-radius:0.8rem; overflow:hidden; background:#fff; border:1px solid rgba(0,0,0,0.06); margin-bottom:0.8rem; }
            #sharePreviewWrap img { width:100%; display:block; }
            .share-modal-actions { display:flex; gap:0.6rem; }
            .share-modal-actions button { flex:1; padding:0.7rem 1.2rem; border-radius:60px; border:none; font-size:0.9rem; font-weight:600; cursor:pointer; transition:0.2s ease; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:0.4rem; }
            .share-modal-actions .btn-text { background:rgba(0,0,0,0.06); color:#6a6a92; border:1px solid rgba(0,0,0,0.06); transition:background 0.3s ease,color 0.3s ease,border-color 0.3s ease; }
            .share-modal-actions .btn-text:hover { background:rgba(0,0,0,0.1); }
            body.dark .share-modal-actions .btn-text { background:rgba(255,255,255,0.08); color:#9a96b8; border-color:rgba(255,255,255,0.06); }
            body.dark .share-modal-actions .btn-text:hover { background:rgba(255,255,255,0.15); }
            .share-modal-actions .btn-image { background:linear-gradient(145deg, #7A6BCF, #624ED0); color:#fff; box-shadow:0 8px 24px rgba(90,70,170,0.2); }
            .share-modal-actions .btn-image:hover { transform:scale(1.02); box-shadow:0 12px 32px rgba(90,70,170,0.3); }
            body.dark .share-modal-actions .btn-image { box-shadow:0 8px 24px rgba(0,0,0,0.3); }
            body.dark .share-modal-actions .btn-image:hover { box-shadow:0 12px 32px rgba(0,0,0,0.4); }
            .share-modal-actions .btn-image i { font-size:0.9rem; }
            .share-close-btn { margin-top:0.6rem; padding:0.5rem; background:none; border:none; color:#8a8ab5; font-size:0.85rem; cursor:pointer; width:100%; font-family:'Inter',sans-serif; transition:0.2s ease; }
            .share-close-btn:hover { color:#4a4a6e; }
            body.dark .share-close-btn:hover { color:#d0caf0; }
            @media (max-width:480px) { .share-modal-overlay .share-modal-box { padding:1.6rem 1.4rem 1.4rem; } .share-modal-actions button { font-size:0.8rem; padding:0.6rem 1rem; } }
            .share-text-box { background:rgba(0,0,0,0.04); border-radius:12px; padding:0.8rem 1rem; text-align:left; font-size:0.82rem; line-height:1.8; color:#4a4a6e; word-break:break-all; margin-bottom:1rem; border:1px solid rgba(0,0,0,0.04); max-height:200px; overflow-y:auto; font-family:'Inter',sans-serif; }
            body.dark .share-text-box { background:rgba(255,255,255,0.06); color:#b0a8d0; border-color:rgba(255,255,255,0.06); }
          `
        }} />
      </head>
      <body>
        <div className="reading-progress" id="readingProgress">
          <div className="progress-bar" id="progressBar"></div>
        </div>

        <div className="bg-glow"></div>
        <div className="glow-soft"></div>
        <div className="glow-soft-2"></div>

        <div className="top-buttons">
          <div className="left">
            <a href="/?return=articles" className="back-btn" id="backButton">
              <i className="fas fa-arrow-left"></i> 返回
            </a>
            <button className="share-btn" id="shareButton">
              <i className="fas fa-share-alt"></i>
            </button>
          </div>
          <div className="right">
            <button className="back-to-top-btn" id="backToTopBtn">
              <i className="fas fa-arrow-up"></i>
            </button>
            <button className="theme-toggle" id="themeToggle">
              <i className="fas fa-moon" id="themeIcon"></i>
            </button>
          </div>
        </div>

        <div className="container">
          <div id="appContent">
            <div className="article-detail">
              <h1 className="detail-title">{escapeHtml(title)}</h1>
              <span className="detail-date">{date ? escapeHtml(date) + '  ·  ' : ''}大约 {readTime} 分钟 · {wordCount} 字</span>
              <div dangerouslySetInnerHTML={{ __html: tagsHtml }} />
              <hr className="detail-divider" />
              <div className="detail-content" dangerouslySetInnerHTML={{ __html: renderedContent }} />
            </div>
          </div>
          <div id="waline-comments"></div>
        </div>

        <div className="share-modal-overlay" id="shareModal">
          <div className="share-modal-box">
            <div className="share-modal-title"><i className="fas fa-share-alt"></i> 分享</div>
            <div id="sharePreviewWrap">
              <img id="sharePreviewImg" src="" alt="分享图预览" />
            </div>
            <div className="share-modal-actions">
              <button className="btn-text" id="shareCopyBtn"><i className="fas fa-copy"></i> 复制文字</button>
              <button className="btn-image" id="shareSaveBtn"><i className="fas fa-download"></i> 保存图片</button>
            </div>
            <button className="share-close-btn" id="shareCloseBtn">关闭</button>
          </div>
        </div>

        <div className="share-modal-overlay" id="textModal" style={{ zIndex: 1000 }}>
          <div className="share-modal-box" style={{ maxWidth: '420px' }}>
            <div className="share-modal-title"><i className="fas fa-copy"></i> 复制内容</div>
            <div className="share-text-box" id="shareTextDisplay">加载中...</div>
            <div className="share-modal-actions">
              <button className="btn-text" id="textModalCancel" style={{ flex: 1 }}>取消</button>
              <button className="btn-image" id="textModalCopy" style={{ flex: 1 }}><i className="fas fa-copy"></i> 复制</button>
            </div>
          </div>
        </div>

        <div className="toast" id="toast"></div>
        <div id="qrTemp"></div>

        <script dangerouslySetInnerHTML={{
          __html: `
            // 所有 JS 代码和您 article.html 里的一模一样
            function getParam(name) {
              const url = new URL(window.location.href);
              return url.searchParams.get(name);
            }

            function escapeHtml(text) {
              if (!text) return '';
              const div = document.createElement('div');
              div.textContent = text;
              return div.innerHTML;
            }

            function markdownToPlainText(md) {
              if (!md) return '';
              let text = md;
              text = text.replace(/\\\`\\\`\\\`[\\s\\S]*?\\\`\\\`\\\`/g, '');
              text = text.replace(/\\\`([^\\\`]+)\\\`/g, '$1');
              text = text.replace(/\\*\\*(.*?)\\*\\*/g, '$1');
              text = text.replace(/\\*([^*]+)\\*/g, '$1');
              text = text.replace(/~~(.*?)~~/g, '$1');
              text = text.replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g, '');
              text = text.replace(/\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1');
              text = text.replace(/^#{1,6}\\s+/gm, '');
              text = text.replace(/^-\\s+/gm, '');
              text = text.replace(/^\\d+\\.\\s+/gm, '');
              text = text.replace(/^>\\s+/gm, '');
              text = text.replace(/^---$/gm, '');
              text = text.replace(/\\n/g, ' ');
              text = text.replace(/\\s{2,}/g, ' ');
              return text.trim();
            }

            function showToast(message, icon) {
              icon = icon || 'fa-info-circle';
              const toast = document.getElementById('toast');
              toast.innerHTML = '<i class="fas ' + icon + '"></i> ' + message;
              toast.classList.add('show');
              clearTimeout(toast._hideTimer);
              toast._hideTimer = setTimeout(function() {
                toast.classList.remove('show');
              }, 2000);
            }

            const progressWrap = document.getElementById('readingProgress');
            const progressBar = document.getElementById('progressBar');
            let lastProgress = 0;
            let hideTimer = null;
            let isProgressLocked = false;

            function updateReadingProgress() {
              if (isProgressLocked) return;
              const articleDetail = document.querySelector('.article-detail');
              if (!articleDetail) {
                progressBar.style.width = '0%';
                return;
              }
              const rect = articleDetail.getBoundingClientRect();
              const articleHeight = rect.height;
              const articleTop = rect.top + window.scrollY;
              const windowHeight = window.innerHeight;
              const maxScroll = articleHeight - windowHeight;

              let progress = 0;
              if (maxScroll <= 0) {
                progress = 100;
              } else {
                const currentScroll = window.scrollY - articleTop;
                progress = Math.min(Math.max((currentScroll / maxScroll) * 100, 0), 100);
              }

              progressBar.style.width = progress + '%';

              if (progress >= 100 && lastProgress < 100) {
                if (hideTimer) {
                  clearTimeout(hideTimer);
                  hideTimer = null;
                }
                hideTimer = setTimeout(() => {
                  progressWrap.style.transition = 'opacity 0.8s ease';
                  progressWrap.style.opacity = '0';
                  setTimeout(() => {
                    progressWrap.style.display = 'none';
                  }, 800);
                }, 600);
              }

              if (progress < 100) {
                if (hideTimer) {
                  clearTimeout(hideTimer);
                  hideTimer = null;
                }
                progressWrap.style.display = 'block';
                progressWrap.style.opacity = '1';
                progressWrap.style.transition = 'opacity 0.3s ease';
              }

              lastProgress = progress;
            }

            window.addEventListener('scroll', updateReadingProgress);
            window.addEventListener('resize', updateReadingProgress);
            window.addEventListener('load', updateReadingProgress);

            const themeToggle = document.getElementById('themeToggle');
            const themeIcon = document.getElementById('themeIcon');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            let currentTheme = localStorage.getItem('ks-theme') || (prefersDark ? 'dark' : 'light');

            function setTheme(theme) {
              document.body.classList.toggle('dark', theme === 'dark');
              themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
              localStorage.setItem('ks-theme', theme);
              currentTheme = theme;
            }
            setTheme(currentTheme);
            themeToggle.addEventListener('click', function() {
              setTheme(currentTheme === 'dark' ? 'light' : 'dark');
            });

            const backToTopBtn = document.getElementById('backToTopBtn');
            let isScrollingToTop = false;

            window.addEventListener('scroll', function() {
              const scrollY = window.scrollY || window.pageYOffset;
              if (scrollY > 300 && !isScrollingToTop) {
                backToTopBtn.classList.add('show');
              } else if (!isScrollingToTop) {
                backToTopBtn.classList.remove('show');
              }
            });

            function fastScrollToTop() {
              const startY = window.scrollY || window.pageYOffset;
              if (startY === 0) return;
              const duration = 300;
              const startTime = performance.now();

              function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                const nextY = startY * (1 - ease);
                window.scrollTo(0, nextY);
                if (progress < 1) {
                  requestAnimationFrame(step);
                } else {
                  window.scrollTo(0, 0);
                  isScrollingToTop = false;
                  backToTopBtn.classList.remove('disabled');
                  backToTopBtn.classList.remove('show');
                }
              }
              requestAnimationFrame(step);
            }

            backToTopBtn.addEventListener('click', function() {
              if (isScrollingToTop) return;
              const scrollY = window.scrollY || window.pageYOffset;
              if (scrollY === 0) return;
              isScrollingToTop = true;
              backToTopBtn.classList.add('disabled');
              fastScrollToTop();
            });

            const backBtn = document.getElementById('backButton');
            const from = getParam('from');
            const page = getParam('page');
            const folder = getParam('folder');
            let returnUrl = '/?return=articles';
            if (page) returnUrl += '&page=' + page;
            if (from === 'archive' && folder === 'articles') {
              returnUrl = '/?return=archive&folder=articles';
            } else if (from === 'archive') {
              returnUrl = '/?return=archive';
            }
            backBtn.href = returnUrl;

            let currentArticle = null;
            let currentShareText = '';
            let walineInitialized = false;

            function countWords(markdown) {
              if (!markdown) return 0;
              let text = markdown
                .replace(/\\\`\\\`\\\`[\\s\\S]*?\\\`\\\`\\\`/g, '')
                .replace(/\\\`[^\\\`]+\\\`/g, '')
                .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
                .replace(/\\*([^*]+)\\*/g, '$1')
                .replace(/~~(.*?)~~/g, '$1')
                .replace(/\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1')
                .replace(/!\\[([^\\]]*)\\]\\([^)]*\\)/g, '')
                .replace(/^#{1,6}\\s+/gm, '')
                .replace(/^-\\s+/gm, '')
                .replace(/^\\d+\\.\\s+/gm, '')
                .replace(/^>\\s+/gm, '')
                .replace(/^---$/gm, '')
                .replace(/^\\s*[-*+]\\s+\\[[ x]\\]\\s+/gm, '')
                .replace(/\\s+/g, ' ')
                .trim();
              return text.length;
            }

            function getPlainPreview(content, maxLength) {
              maxLength = maxLength || 80;
              const plain = markdownToPlainText(content);
              const chars = [...plain];
              if (chars.length <= maxLength) return plain;
              const truncated = chars.slice(0, maxLength).join('');
              return truncated + '…';
            }

            let lbImageData = [];
            let currentLbIndex = 0;
            let isPlaying = false;
            let lbIsOpen = false;
            let lbProgressRAF = null;
            let lbIntervalId = null;

            function initWaline(articleId) {
              if (walineInitialized) return;
              const commentEl = document.getElementById('waline-comments');
              if (!commentEl) return;
              walineInitialized = true;
              import('https://unpkg.com/@waline/client@v3/dist/waline.js')
                .then((module) => {
                  const { init } = module;
                  init({
                    el: '#waline-comments',
                    serverURL: 'https://comment.cuizi.top',
                    lang: 'zh-CN',
                    path: '/article/' + articleId,
                    dark: 'body.dark',
                    emoji: ['https://unpkg.com/@waline/emojis@1.4.0/alus', 'https://unpkg.com/@waline/emojis@1.4.0/bilibili', 'https://unpkg.com/@waline/emojis@1.4.0/bmoji', 'https://unpkg.com/@waline/emojis@1.4.0/qq', 'https://unpkg.com/@waline/emojis@1.4.0/tieba'],
                    requiredMeta: ['nick', 'mail']
                  });
                })
                .catch((err) => {
                  console.error('Waline 加载失败:', err);
                  walineInitialized = false;
                });
            }

            function generateQRCanvas(text, size) {
              return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                  const canvas = document.createElement('canvas');
                  canvas.width = size;
                  canvas.height = size;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, size, size);
                  resolve(canvas);
                };
                img.onerror = function() {
                  reject(new Error('二维码图片加载失败'));
                };
                img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text);
              });
            }

            function wrapText(ctx, text, maxWidth) {
              const chars = [...text];
              const lines = [];
              let current = '';
              for (const ch of chars) {
                if (ctx.measureText(current + ch).width > maxWidth) {
                  lines.push(current);
                  current = ch;
                } else {
                  current += ch;
                }
              }
              if (current) lines.push(current);
              return lines;
            }

            function truncateLines(lines, maxLines) {
              if (lines.length <= maxLines) return lines;
              const result = lines.slice(0, maxLines);
              const last = result[result.length - 1];
              const trimmed = last.slice(0, -1) + '…';
              result[result.length - 1] = trimmed;
              return result;
            }

            function initImageLazyLoad() {
              const placeholders = document.querySelectorAll('.img-placeholder');
              placeholders.forEach(function(container) {
                const img = container.querySelector('img');
                if (!img) return;
                if (img.complete && img.naturalWidth !== 0) {
                  container.classList.add('loaded');
                  img.classList.add('loaded');
                  const loading = container.querySelector('.img-loading');
                  if (loading) loading.style.display = 'none';
                  return;
                }
                img.addEventListener('load', function() {
                  container.classList.add('loaded');
                  img.classList.add('loaded');
                  const loading = container.querySelector('.img-loading');
                  if (loading) loading.style.display = 'none';
                });
                img.addEventListener('error', function() {
                  container.classList.add('loaded');
                  const loading = container.querySelector('.img-loading');
                  if (loading) loading.style.display = 'none';
                });
              });
            }

            let lbProgressEl = null;
            let lbProgressBarEl = null;

            function createLbProgress() {
              if (document.querySelector('.lightbox-progress')) return;
              const div = document.createElement('div');
              div.className = 'lightbox-progress';
              div.innerHTML = '<div class="lb-progress-bar"></div>';
              document.body.appendChild(div);
              lbProgressEl = div;
              lbProgressBarEl = div.querySelector('.lb-progress-bar');
            }

            function showLbProgress(show) {
              if (!lbProgressEl) return;
              if (show) {
                lbProgressEl.classList.add('active');
              } else {
                lbProgressEl.classList.remove('active');
              }
            }

            function resetLbProgress() {
              if (lbProgressBarEl) {
                lbProgressBarEl.style.width = '0%';
              }
            }

            function openLightbox(index) {
              if (lbImageData.length === 0 || lbIsOpen) return;
              lbIsOpen = true;
              currentLbIndex = index;

              createLbProgress();

              const existing = document.querySelector('.lightbox-overlay');
              if (existing) existing.remove();

              const overlay = document.createElement('div');
              overlay.className = 'lightbox-overlay';
              overlay.innerHTML = \`
                <button class="lightbox-close">&times;</button>
                <button class="lightbox-nav prev" id="lbPrev"><i class="fas fa-chevron-left"></i></button>
                <button class="lightbox-nav next" id="lbNext"><i class="fas fa-chevron-right"></i></button>
                <button class="lightbox-play" id="lbPlay"><i class="fas fa-play"></i></button>
                <div class="lightbox-container">
                  <div class="lightbox-img-wrapper">
                    <img src="" alt="" />
                  </div>
                  <div class="lightbox-alt"></div>
                </div>
                <div class="lightbox-counter"></div>
              \`;
              document.body.appendChild(overlay);
              document.body.style.overflow = 'hidden';

              let scale = 1;
              let translateX = 0;
              let translateY = 0;
              let isDragging = false;
              let mouseDown = false;
              let mouseStartX = 0, mouseStartY = 0;
              let mouseLastX = 0, mouseLastY = 0;
              let touchStartDist = 0, touchStartScale = 1;
              let touchStartX = 0, touchStartY = 0;
              let touchLastX = 0, touchLastY = 0;

              const imgWrapper = overlay.querySelector('.lightbox-img-wrapper');
              const img = overlay.querySelector('img');
              const altEl = overlay.querySelector('.lightbox-alt');
              const counterEl = overlay.querySelector('.lightbox-counter');
              const prevBtn = overlay.querySelector('.lightbox-nav.prev');
              const nextBtn = overlay.querySelector('.lightbox-nav.next');
              const playBtn = overlay.querySelector('.lightbox-play');
              const closeBtn = overlay.querySelector('.lightbox-close');

              let playIntervalId = null;
              let progressAnimId = null;
              const PLAY_DELAY = 3000;

              function updateLightbox() {
                const data = lbImageData[currentLbIndex];
                if (!data) return;
                img.src = data.src;
                img.alt = data.alt || '';
                altEl.textContent = data.alt || '';
                counterEl.textContent = (currentLbIndex + 1) + ' / ' + lbImageData.length;

                if (lbImageData.length <= 1) {
                  prevBtn.disabled = true;
                  nextBtn.disabled = true;
                } else {
                  prevBtn.disabled = isPlaying;
                  nextBtn.disabled = isPlaying;
                }

                scale = 1;
                translateX = 0;
                translateY = 0;
                updateTransform(false);

                resetLbProgress();
                showLbProgress(isPlaying);
                updatePlayButtonState();
              }

              function updateTransform(animate) {
                animate = animate || false;
                img.style.transition = animate ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none';
                img.style.transform = 'scale(' + scale + ') translate(' + translateX + 'px, ' + translateY + 'px)';
              }

              function updatePlayButtonState() {
                if (lbImageData.length <= 1) {
                  playBtn.disabled = true;
                  playBtn.innerHTML = '<i class="fas fa-play"></i>';
                  return;
                }
                if (currentLbIndex === lbImageData.length - 1 && !isPlaying) {
                  playBtn.disabled = true;
                  playBtn.innerHTML = '<i class="fas fa-play"></i>';
                  return;
                }
                playBtn.disabled = false;
                if (isPlaying) {
                  playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                } else {
                  playBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
              }

              function stopPlayback() {
                isPlaying = false;
                if (playIntervalId) {
                  clearInterval(playIntervalId);
                  playIntervalId = null;
                }
                if (progressAnimId) {
                  cancelAnimationFrame(progressAnimId);
                  progressAnimId = null;
                }
                if (lbImageData.length > 1) {
                  prevBtn.disabled = false;
                  nextBtn.disabled = false;
                }
                showLbProgress(false);
                resetLbProgress();
                updatePlayButtonState();
              }

              function startProgressAnimation() {
                if (progressAnimId) {
                  cancelAnimationFrame(progressAnimId);
                  progressAnimId = null;
                }
                resetLbProgress();
                const startTime = performance.now();

                function updateProgress(currentTime) {
                  if (!isPlaying) {
                    progressAnimId = null;
                    return;
                  }
                  const elapsed = currentTime - startTime;
                  const progress = Math.min((elapsed / PLAY_DELAY) * 100, 100);
                  if (lbProgressBarEl) {
                    lbProgressBarEl.style.width = progress + '%';
                  }
                  if (progress < 100) {
                    progressAnimId = requestAnimationFrame(updateProgress);
                  } else {
                    progressAnimId = null;
                  }
                }
                progressAnimId = requestAnimationFrame(updateProgress);
              }

              function startPlayback() {
                if (isPlaying) return;
                if (lbImageData.length <= 1) return;
                if (currentLbIndex === lbImageData.length - 1) {
                  updatePlayButtonState();
                  return;
                }

                if (playIntervalId) {
                  clearInterval(playIntervalId);
                  playIntervalId = null;
                }
                if (progressAnimId) {
                  cancelAnimationFrame(progressAnimId);
                  progressAnimId = null;
                }

                isPlaying = true;
                if (lbImageData.length > 1) {
                  prevBtn.disabled = true;
                  nextBtn.disabled = true;
                }
                showLbProgress(true);
                resetLbProgress();
                updatePlayButtonState();

                startProgressAnimation();

                playIntervalId = setInterval(function() {
                  if (!isPlaying) return;

                  if (currentLbIndex < lbImageData.length - 1) {
                    currentLbIndex++;
                    updateLightbox();
                    resetLbProgress();
                    startProgressAnimation();
                    updatePlayButtonState();
                  } else {
                    stopPlayback();
                  }
                }, PLAY_DELAY);
              }

              function togglePlay() {
                if (lbImageData.length <= 1) return;
                if (currentLbIndex === lbImageData.length - 1 && !isPlaying) {
                  updatePlayButtonState();
                  return;
                }
                if (isPlaying) {
                  stopPlayback();
                } else {
                  startPlayback();
                }
              }

              function closeLightbox() {
                if (!lbIsOpen) return;
                lbIsOpen = false;
                isPlaying = false;
                if (playIntervalId) {
                  clearInterval(playIntervalId);
                  playIntervalId = null;
                }
                if (progressAnimId) {
                  cancelAnimationFrame(progressAnimId);
                  progressAnimId = null;
                }
                showLbProgress(false);
                resetLbProgress();
                isProgressLocked = false;
                progressWrap.style.transition = 'opacity 0.3s ease';
                overlay.classList.remove('active');
                setTimeout(function() {
                  if (overlay.parentNode) overlay.remove();
                  document.body.style.overflow = '';
                  document.removeEventListener('keydown', escHandler);
                  updateReadingProgress();
                  if (lbProgressEl && lbProgressEl.parentNode) {
                    lbProgressEl.parentNode.removeChild(lbProgressEl);
                    lbProgressEl = null;
                    lbProgressBarEl = null;
                  }
                }, 350);
              }

              function escHandler(e) {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft' && !isPlaying) {
                  e.preventDefault();
                  if (lbImageData.length > 1) {
                    currentLbIndex = (currentLbIndex - 1 + lbImageData.length) % lbImageData.length;
                    updateLightbox();
                    updatePlayButtonState();
                  }
                }
                if (e.key === 'ArrowRight' && !isPlaying) {
                  e.preventDefault();
                  if (lbImageData.length > 1) {
                    currentLbIndex = (currentLbIndex + 1) % lbImageData.length;
                    updateLightbox();
                    updatePlayButtonState();
                  }
                }
              }

              img.addEventListener('wheel', function(e) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const newScale = Math.min(Math.max(0.5, scale + delta), 5);
                const rect = img.getBoundingClientRect();
                const ratioX = (e.clientX - rect.left) / rect.width;
                const ratioY = (e.clientY - rect.top) / rect.height;
                const oldScale = scale;
                scale = newScale;
                translateX += (1 - newScale / oldScale) * (rect.width / 2 - rect.width * ratioX);
                translateY += (1 - newScale / oldScale) * (rect.height / 2 - rect.height * ratioY);
                updateTransform(false);
              }, { passive: false });

              imgWrapper.addEventListener('touchstart', function(e) {
                if (e.touches.length === 2) {
                  const t = e.touches;
                  touchStartDist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
                  touchStartScale = scale;
                } else if (e.touches.length === 1) {
                  isDragging = true;
                  touchStartX = e.touches[0].clientX;
                  touchStartY = e.touches[0].clientY;
                  touchLastX = translateX;
                  touchLastY = translateY;
                  imgWrapper.style.cursor = 'grabbing';
                }
              }, { passive: true });

              imgWrapper.addEventListener('touchmove', function(e) {
                if (e.touches.length === 2) {
                  const t = e.touches;
                  const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
                  scale = Math.min(Math.max(0.5, touchStartScale * (dist / touchStartDist)), 5);
                  updateTransform(false);
                } else if (e.touches.length === 1 && isDragging) {
                  const dx = e.touches[0].clientX - touchStartX;
                  const dy = e.touches[0].clientY - touchStartY;
                  translateX = touchLastX + dx;
                  translateY = touchLastY + dy;
                  updateTransform(false);
                }
              }, { passive: true });

              imgWrapper.addEventListener('touchend', function(e) {
                isDragging = false;
                imgWrapper.style.cursor = 'grab';
                if (scale < 0.6) {
                  scale = 0.6;
                  translateX = 0;
                  translateY = 0;
                  updateTransform(true);
                } else if (scale < 1) {
                  scale = 1;
                  translateX = 0;
                  translateY = 0;
                  updateTransform(true);
                } else if (scale > 3) {
                  scale = 3;
                  updateTransform(true);
                }
                if (Math.abs(translateX) > 300 || Math.abs(translateY) > 300) {
                  translateX = 0;
                  translateY = 0;
                  updateTransform(true);
                }
              }, { passive: true });

              imgWrapper.addEventListener('mousedown', function(e) {
                mouseDown = true;
                mouseStartX = e.clientX;
                mouseStartY = e.clientY;
                mouseLastX = translateX;
                mouseLastY = translateY;
                imgWrapper.style.cursor = 'grabbing';
                e.preventDefault();
              });

              document.addEventListener('mousemove', function(e) {
                if (mouseDown) {
                  const dx = e.clientX - mouseStartX;
                  const dy = e.clientY - mouseStartY;
                  translateX = mouseLastX + dx;
                  translateY = mouseLastY + dy;
                  updateTransform(false);
                }
              });

              document.addEventListener('mouseup', function() {
                if (mouseDown) {
                  mouseDown = false;
                  imgWrapper.style.cursor = 'grab';
                  if (scale < 0.6) {
                    scale = 0.6;
                    translateX = 0;
                    translateY = 0;
                    updateTransform(true);
                  } else if (scale < 1) {
                    scale = 1;
                    translateX = 0;
                    translateY = 0;
                    updateTransform(true);
                  } else if (scale > 3) {
                    scale = 3;
                    updateTransform(true);
                  }
                  if (Math.abs(translateX) > 300 || Math.abs(translateY) > 300) {
                    translateX = 0;
                    translateY = 0;
                    updateTransform(true);
                  }
                }
              });

              closeBtn.addEventListener('click', closeLightbox);
              overlay.addEventListener('click', function(e) {
                if (e.target === this) closeLightbox();
              });

              prevBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isPlaying) {
                  stopPlayback();
                }
                if (lbImageData.length > 1) {
                  currentLbIndex = (currentLbIndex - 1 + lbImageData.length) % lbImageData.length;
                  updateLightbox();
                  updatePlayButtonState();
                }
              });

              nextBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isPlaying) {
                  stopPlayback();
                }
                if (lbImageData.length > 1) {
                  currentLbIndex = (currentLbIndex + 1) % lbImageData.length;
                  updateLightbox();
                  updatePlayButtonState();
                }
              });

              playBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                togglePlay();
              });

              document.addEventListener('keydown', escHandler);

              isProgressLocked = true;
              progressWrap.style.display = 'block';
              progressWrap.style.opacity = '1';
              if (lbProgressBarEl) {
                lbProgressBarEl.style.width = '0%';
              }
              if (lbProgressRAF) {
                cancelAnimationFrame(lbProgressRAF);
                lbProgressRAF = null;
              }

              updateLightbox();

              if (lbImageData.length <= 1) {
                playBtn.disabled = true;
                showLbProgress(false);
              }

              requestAnimationFrame(function() {
                overlay.classList.add('active');
              });
            }

            let currentShareImageDataUrl = '';

            async function generateShareImage() {
              if (!currentArticle) return;

              const title = currentArticle.title || '无标题';
              const date = currentArticle.date || '';
              const plainContent = markdownToPlainText(currentArticle.content || '');
              let desc = plainContent.substring(0, 80);
              if (plainContent.length > 80) {
                desc = desc + '…';
              }
              desc = desc.replace(/[,，、。.；;：:！!？?…~～]+$/, '');
              if (plainContent.length > 80 && !desc.endsWith('…')) {
                desc = desc + '…';
              }
              const url = window.location.href;

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              const W = 900, H = 540;
              canvas.width = W;
              canvas.height = H;

              const grad = ctx.createLinearGradient(0, 0, W, H);
              grad.addColorStop(0, '#f8f5ff');
              grad.addColorStop(1, '#e8e0ff');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, W, H);

              ctx.globalAlpha = 0.05;
              for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.arc(60 + i * 160, 40 + (i % 3) * 30, 80, 0, Math.PI * 2);
                ctx.fillStyle = '#7a6bcf';
                ctx.fill();
              }
              ctx.globalAlpha = 1;

              ctx.textAlign = 'right';
              ctx.textBaseline = 'top';
              ctx.font = '400 14px "Inter", sans-serif';
              ctx.fillStyle = '#8a8ab5';
              ctx.fillText(date || '', W - 40, 28);

              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.font = '700 52px "Inter", "PingFang SC", sans-serif';
              ctx.fillStyle = '#1a1a2e';
              const titleLines = wrapText(ctx, title || '无标题', W - 260);
              const titleDisplay = truncateLines(titleLines, 2);
              titleDisplay.forEach((line, i) => {
                ctx.fillText(line, 40, 70 + i * 60);
              });

              let subY = 70 + Math.min(titleDisplay.length, 2) * 60 + 20;
              ctx.font = '400 22px "Inter", "PingFang SC", sans-serif';
              ctx.fillStyle = '#4a4a6e';
              const descLines = wrapText(ctx, desc || ' ', W - 260);
              const descDisplay = truncateLines(descLines, 4);
              descDisplay.forEach((line, i) => {
                ctx.fillText(line, 40, subY + 10 + i * 34);
              });

              const bottomY = H - 44;
              ctx.font = '500 16px "Inter", "PingFang SC", sans-serif';
              ctx.fillStyle = '#6a6a92';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              ctx.fillText('ks', 40, bottomY);

              const qrSize = 180;
              const qrX = W - qrSize - 40;
              const qrY = H - qrSize - 40;

              try {
                const qrCanvas = await generateQRCanvas(url, qrSize);
                ctx.shadowColor = 'rgba(0,0,0,0.06)';
                ctx.shadowBlur = 16;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 4;
                ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
              } catch (e) {
                ctx.fillStyle = '#f0edff';
                ctx.fillRect(qrX, qrY, qrSize, qrSize);
                ctx.fillStyle = '#aaa';
                ctx.font = '16px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('二维码失败', qrX + qrSize / 2, qrY + qrSize / 2);
              }

              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.font = '400 13px "Inter", sans-serif';
              ctx.fillStyle = '#aaaacc';
              ctx.fillText('扫码观看全文', qrX + qrSize / 2, qrY + qrSize + 10);

              ctx.textAlign = 'right';
              ctx.textBaseline = 'bottom';
              ctx.font = '400 13px "Inter", sans-serif';
              ctx.fillStyle = '#c8c8e0';
              ctx.fillText('cuizi.top', W - 40, 18);

              currentShareImageDataUrl = canvas.toDataURL('image/png');
              document.getElementById('sharePreviewImg').src = currentShareImageDataUrl;
            }

            // 初始化
            const articleId = window.location.pathname.split('/').pop();
            currentArticle = {
              title: '{escapeHtml(title)}',
              date: '{escapeHtml(date)}',
              content: \`${content.replace(/\\`/g, '\\\\`').replace(/\\$/g, '\\\\$')}\`,
              tags: ${JSON.stringify(tags)}
            };
            currentShareText = '{escapeHtml(title)}：' + getPlainPreview(\`${content.replace(/\\`/g, '\\\\`').replace(/\\$/g, '\\\\$')}\`, 80) + '\\n查看完整内容？请访问：' + window.location.href;

            setTimeout(updateReadingProgress, 100);
            generateShareImage();

            // 图片灯箱
            const images = document.querySelectorAll('.detail-content img');
            const allImages = [];
            images.forEach(img => {
              const src = img.getAttribute('src');
              const alt = img.getAttribute('alt') || '';
              if (src) {
                allImages.push({ src: src, alt: alt, el: img });
              }
            });
            lbImageData = allImages;

            images.forEach((img, index) => {
              img.style.cursor = 'pointer';
              img.addEventListener('click', function(e) {
                e.stopPropagation();
                openLightbox(index);
              });
            });

            // 分享按钮
            document.getElementById('shareButton').addEventListener('click', function() {
              if (!currentArticle) {
                showToast('文章未加载', 'fa-exclamation-circle');
                return;
              }
              document.getElementById('shareModal').classList.add('active');
              document.body.style.overflow = 'hidden';
            });

            document.getElementById('shareCloseBtn').addEventListener('click', function() {
              document.getElementById('shareModal').classList.remove('active');
              document.body.style.overflow = '';
            });

            document.getElementById('shareModal').addEventListener('click', function(e) {
              if (e.target === this) {
                this.classList.remove('active');
                document.body.style.overflow = '';
              }
            });

            document.getElementById('shareCopyBtn').addEventListener('click', function() {
              document.getElementById('shareTextDisplay').textContent = currentShareText || '暂无内容';
              document.getElementById('textModal').classList.add('active');
            });

            document.getElementById('textModalCancel').addEventListener('click', function() {
              document.getElementById('textModal').classList.remove('active');
            });

            document.getElementById('textModal').addEventListener('click', function(e) {
              if (e.target === this) {
                this.classList.remove('active');
              }
            });

            document.getElementById('textModalCopy').addEventListener('click', function() {
              const text = document.getElementById('shareTextDisplay').textContent;
              navigator.clipboard.writeText(text).then(() => {
                showToast('已复制', 'fa-check-circle');
                document.getElementById('textModal').classList.remove('active');
                document.getElementById('shareModal').classList.remove('active');
                document.body.style.overflow = '';
              }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast('已复制', 'fa-check-circle');
                document.getElementById('textModal').classList.remove('active');
                document.getElementById('shareModal').classList.remove('active');
                document.body.style.overflow = '';
              });
            });

            document.getElementById('shareSaveBtn').addEventListener('click', function() {
              if (!currentShareImageDataUrl) {
                showToast('图片未生成', 'fa-exclamation-circle');
                return;
              }
              const a = document.createElement('a');
              a.href = currentShareImageDataUrl;
              const now = new Date();
              const ts = now.getFullYear().toString().slice(2) +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0');
              a.download = '分享图_' + ts + '.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              showToast('已保存', 'fa-check-circle');
            });

            // 评论
            initWaline(articleId);
          `
        }} />
      </body>
    </html>
  );
}
