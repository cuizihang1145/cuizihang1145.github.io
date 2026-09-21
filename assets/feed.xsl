<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom" exclude-result-prefixes="atom">
<xsl:output method="html" encoding="UTF-8"/>
<xsl:template match="/">
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="icon" type="image/png" href="/favicon.png"/>
<link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/font-awesome/7.0.1/css/all.css"/>
<title><xsl:choose><xsl:when test="/rss/channel">RSS · <xsl:value-of select="/rss/channel/title"/></xsl:when><xsl:when test="/atom:feed">Atom · <xsl:value-of select="/atom:feed/atom:title"/></xsl:when></xsl:choose></title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;outline:none!important}
body{font-family:'Inter',-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#FAFAFE;color:#1A1A2E;line-height:1.8;min-height:100vh;transition:background .4s ease,color .3s ease}
body.dark{background:#14131F;color:#E8E6F0}
.bg-glow{position:fixed;top:0;left:0;width:100%;height:100%;z-index:-2;background:radial-gradient(circle at 30% 30%,#F6F2FF,#FFFFFF);transition:background .5s ease}
body.dark .bg-glow{background:radial-gradient(circle at 30% 30%,#28253D,#0E0D18)}
.glow-soft{position:fixed;width:70vw;height:70vw;background:radial-gradient(circle,rgba(160,130,230,.15),rgba(210,190,255,0) 70%);border-radius:50%;top:-25vh;right:-20vw;z-index:-1;filter:blur(80px);transition:background .5s ease}
body.dark .glow-soft{background:radial-gradient(circle,rgba(120,100,200,.20),rgba(60,40,120,0) 70%)}
.top-bar{position:fixed;top:20px;left:20px;right:20px;z-index:50;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
.top-bar .left,.top-bar .right{pointer-events:auto;display:flex;align-items:center;gap:.5rem}
.back-btn{background:rgba(255,255,255,.6);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.8);border-radius:60px;padding:.5rem 1.2rem .5rem 1rem;display:inline-flex;align-items:center;gap:.5rem;font-size:.85rem;font-weight:500;color:#4F4F78;text-decoration:none;transition:.25s ease;box-shadow:0 6px 20px rgba(80,60,160,.10);cursor:pointer}
.back-btn:hover{background:rgba(255,255,255,.85);transform:translateY(-2px) scale(1.02)}
body.dark .back-btn{background:rgba(30,28,50,.7);border-color:rgba(255,255,255,.08);color:#D0CAF0;box-shadow:0 6px 20px rgba(0,0,0,.3)}
body.dark .back-btn:hover{background:rgba(50,45,80,.8)}
.back-btn i{font-size:.9rem}
.theme-toggle{background:rgba(255,255,255,.6);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.8);border-radius:60px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#4F4F78;cursor:pointer;transition:.3s ease;box-shadow:0 6px 20px rgba(80,60,160,.10);user-select:none}
.theme-toggle:hover{transform:scale(1.05) rotate(8deg);background:rgba(255,255,255,.85);box-shadow:0 10px 28px rgba(80,60,160,.18)}
body.dark .theme-toggle{background:rgba(30,28,50,.7);border-color:rgba(255,255,255,.08);color:#D0CAF0;box-shadow:0 6px 20px rgba(0,0,0,.3)}
body.dark .theme-toggle:hover{background:rgba(50,45,80,.8)}
@media (max-width:560px){.top-bar{top:14px;left:14px;right:14px}.back-btn{padding:.4rem 1rem .4rem .8rem;font-size:.75rem}.back-btn i{font-size:.8rem}.theme-toggle{width:42px;height:42px;font-size:1.2rem}}
.container{max-width:700px;margin:0 auto;padding:6rem 1.8rem 2rem;min-height:100vh;position:relative}
header{margin:0 0 1.8rem}
header h1{font-size:2rem;font-weight:700;letter-spacing:-.5px;background:linear-gradient(135deg,#201D3A,#5B4DAF);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.3}
body.dark header h1{background:linear-gradient(135deg,#C8C0F0,#8F7BE0);-webkit-background-clip:text;background-clip:text;color:transparent}
header .sub{color:#6A6A92;font-size:.9rem;margin-top:.5rem;transition:color .3s}
body.dark header .sub{color:#9A96B8}
.tip{display:flex;align-items:center;gap:.6rem;margin:0 0 1.5rem;padding:.7rem 1.1rem;background:rgba(255,255,255,.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.3);border-radius:1.2rem;font-size:.82rem;color:#6A6A92;transition:.3s}
body.dark .tip{background:rgba(40,38,65,.4);border-color:rgba(255,255,255,.05);color:#9A96B8}
.tip i{color:#6B5ACF}
body.dark .tip i{color:#A89FD0}
.list{display:flex;flex-direction:column;gap:.8rem}
.item{background:rgba(255,255,255,.5);backdrop-filter:blur(8px);border-radius:1.2rem;padding:1rem 1.4rem;border:1px solid rgba(255,255,255,.3);transition:.2s ease;display:flex;gap:1rem;align-items:flex-start}
body.dark .item{background:rgba(40,38,65,.4);border-color:rgba(255,255,255,.05)}
.item:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(80,60,160,.08)}
.num{flex-shrink:0;width:1.8rem;height:1.8rem;border-radius:50%;background:rgba(107,90,207,.1);color:#6B5ACF;font-size:.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:.2rem}
body.dark .num{background:rgba(136,204,255,.1);color:#88ccff}
.item .body{flex:1;min-width:0}
.item a{font-size:1.05rem;font-weight:600;color:#2D2D4A;text-decoration:none;transition:color .2s ease;word-break:break-word;display:block}
body.dark .item a{color:#D0CAF0}
.item a:hover{color:#6B5ACF}
body.dark .item a:hover{color:#A89FD0}
.item .meta{font-size:.75rem;color:#8A8AB5;margin-top:.3rem}
body.dark .item .meta{color:#7A7AA0}
.item .desc{margin-top:.4rem;font-size:.85rem;color:#5E5E88;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
body.dark .item .desc{color:#A8A4C8}
</style>
</head>
<body>
<div class="bg-glow"></div>
<div class="glow-soft"></div>
<div class="top-bar">
<div class="left"><a class="back-btn" href="https://cuizi.top"><i class="fas fa-arrow-left"></i> 返回</a></div>
<div class="right"><button class="theme-toggle" id="themeToggle"><i class="fas fa-moon" id="themeIcon"></i></button></div>
</div>
<div class="container">
<header>
<h1><xsl:choose><xsl:when test="/rss/channel"><xsl:value-of select="/rss/channel/title"/></xsl:when><xsl:when test="/atom:feed"><xsl:value-of select="/atom:feed/atom:title"/></xsl:when></xsl:choose></h1>
<p class="sub"><xsl:choose><xsl:when test="/rss/channel"><xsl:value-of select="/rss/channel/description"/></xsl:when><xsl:when test="/atom:feed"><xsl:value-of select="/atom:feed/atom:subtitle"/></xsl:when></xsl:choose></p>
</header>
<div class="tip"><i class="fas fa-rss"></i> 这是 RSS 订阅源，复制当前地址到阅读器即可订阅。</div>
<div class="list">
<xsl:for-each select="/rss/channel/item"><div class="item"><div class="num"><xsl:value-of select="position()"/></div><div class="body"><a href="{link}"><xsl:value-of select="title"/></a><div class="meta"><xsl:value-of select="pubDate"/></div><xsl:if test="description"><div class="desc"><xsl:value-of select="description"/></div></xsl:if></div></div></xsl:for-each>
<xsl:for-each select="/atom:feed/atom:entry"><div class="item"><div class="num"><xsl:value-of select="position()"/></div><div class="body"><a href="{atom:link[@rel='alternate']/@href}"><xsl:value-of select="atom:title"/></a><div class="meta"><xsl:value-of select="atom:updated"/></div><xsl:if test="atom:summary"><div class="desc"><xsl:value-of select="atom:summary"/></div></xsl:if></div></div></xsl:for-each>
</div>
</div>
<script>
(function(){var t=document.getElementById('themeToggle'),i=document.getElementById('themeIcon');var pd=window.matchMedia('(prefers-color-scheme: dark)').matches;var ct=localStorage.getItem('ks-theme')||(pd?'dark':'light');function s(x){document.body.classList.toggle('dark',x==='dark');i.className=x==='dark'?'fas fa-sun':'fas fa-moon';localStorage.setItem('ks-theme',x);ct=x}s(ct);t.addEventListener('click',function(){s(ct==='dark'?'light':'dark')});})();
</script>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
