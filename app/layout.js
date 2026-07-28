// import './globals.css';

export const metadata = {
  title: 'ks · 个人博客',
  description: '个人博客',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
