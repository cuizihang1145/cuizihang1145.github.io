(function (global) {
  'use strict';

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function markdownToPlainText(md) {
    if (!md) return '';
    let text = md;
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/!video\[[^\]]*\]\([^)]*\)/g, '');
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/~~(.*?)~~/g, '$1');
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/^#{1,6}\s+/gm, '');
    text = text.replace(/^-\s+/gm, '');
    text = text.replace(/^\d+\.\s+/gm, '');
    text = text.replace(/^>\s+/gm, '');
    text = text.replace(/^---$/gm, '');
    text = text.replace(/\n/g, ' ');
    text = text.replace(/\s{2,}/g, ' ');
    return text.trim();
  }

  function countWords(md) {
    if (!md) return 0;
    const text = md
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/!video\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^-\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/^---$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length;
  }

  function renderMarkdown(md) {
    if (!md) return '';

    const escMap = {};
    let escCounter = 0;
    md = md.replace(/\\([\\`*_{}\[\]()#+\-.!|$])/g, function (match, char) {
      const key = '\uE000' + (escCounter++) + '\uE001';
      escMap[key] = char;
      return key;
    });

    const safeTags = [];
    const footnotes = {};
    let footnoteCounter = 0;
    const footnoteIdMap = {};

    function getFootnoteId(key) {
      if (!footnoteIdMap[key]) {
        footnoteCounter++;
        footnoteIdMap[key] = footnoteCounter;
      }
      return footnoteIdMap[key];
    }

    function restoreEscapes(text) {
      let r = text;
      for (const [key, char] of Object.entries(escMap)) {
        r = r.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), char);
      }
      return r;
    }

    function renderInline(text) {
      let html = text;
      html = html.replace(/<([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s<>]+)>/g, '<a href="$1">$1</a>');

      const tagMap = {};
      let tagIndex = 0;
      html = html.replace(/<[^>]+>/g, function (match) {
        const key = '\uE002' + (tagIndex++) + '\uE003';
        tagMap[key] = match;
        return key;
      });

      html = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>(.*?)<\/\1>/gs, function (match, tag, attrs, content) {
        if (safeTags.includes(tag.toLowerCase())) {
          return '<' + tag + attrs + '>' + renderInline(content) + '</' + tag + '>';
        }
        return match;
      });

      html = html.replace(/<br\s*\/?>/gi, '<br>');
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

      html = html.replace(/!\[([^\]]*)\]\(([^)]*?)(?:\s+"([^"]*)")?(?:\s+=\s*(\d*)(?:x(\d+))?)?\)/g,
        function (match, alt, src, title, w, h) {
          let style = '';
          if (w && h) style = ' style="width:' + w + 'px; height:' + h + 'px;"';
          else if (w) style = ' style="width:' + w + 'px; height:auto;"';
          else if (h) style = ' style="height:' + h + 'px; width:auto;"';
          const titleAttr = title ? ' title="' + title + '"' : '';
          return '<img src="' + src + '" alt="' + alt + '" loading="lazy"' + style + titleAttr + ' />';
        });

      html = html.replace(
        /!video\[([^\]]*)\]\(([^)]*?)(?:\s+"([^"]*)")?(?:\s+=\s*(\d*)(?:x(\d+))?)?\)/g,
        function (match, desc, src, title, w, h) {
          let style = '';
          if (w && h) style = ' style="width:' + w + 'px; height:' + h + 'px;"';
          else if (w) style = ' style="width:' + w + 'px; height:auto;"';
          else if (h) style = ' style="height:' + h + 'px; width:auto;"';
          const descHtml = desc ? '<div class="video-alt-text">' + desc + '</div>' : '';

          const youtubeMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (youtubeMatch) {
            return '<div class="video-placeholder"><span class="video-loading"><i class="fas fa-spinner fa-spin"></i></span><iframe src="https://www.youtube.com/embed/' + youtubeMatch[1] + '" frameborder="0" allowfullscreen' + style + '></iframe>' + descHtml + '</div>';
          }
          const bilibiliMatch = src.match(/(?:bilibili\.com\/video\/)(BV[a-zA-Z0-9]+)/);
          if (bilibiliMatch) {
            return '<div class="video-placeholder"><span class="video-loading"><i class="fas fa-spinner fa-spin"></i></span><iframe src="https://player.bilibili.com/player.html?bvid=' + bilibiliMatch[1] + '" frameborder="0" allowfullscreen' + style + '></iframe>' + descHtml + '</div>';
          }
          return '<div class="video-placeholder"><video src="' + src + '" controls' + style + '></video>' + descHtml + '</div>';
        });

      html = html.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      html = html.replace(/\[\^([^\]]+)\]/g, function (match, key) {
        const id = getFootnoteId(key);
        return '<sup class="footnote-ref"><a data-footnote-ref="' + id + '">' + id + '</a></sup>';
      });

      html = restoreEscapes(html);
      for (const key in tagMap) {
        if (Object.prototype.hasOwnProperty.call(tagMap, key)) {
          html = html.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tagMap[key]);
        }
      }
      return html;
    }

    function renderBlock(content) {
      if (!content) return '';
      const lines = content.split('\n');
      let result = '';
      let inList = false;
      let listStack = [];
      let paragraph = [];

      function flushList() {
        if (!inList) return;
        let html = '';
        for (let i = listStack.length - 1; i >= 0; i--) {
          const list = listStack[i];
          const tag = list.type === 'ol' ? 'ol' : 'ul';
          const cls = list.type === 'task' ? ' class="task-list"' : '';
          const startAttr = (list.type === 'ol' && list.start !== null && list.start !== 1) ? ' start="' + list.start + '"' : '';
          html = '<' + tag + cls + startAttr + '>\n' + list.items.join('\n') + '\n</' + tag + '>\n' + html;
        }
        result += html;
        inList = false;
        listStack = [];
      }

      function flushParagraph() {
        if (paragraph.length > 0) {
          result += '<p>' + paragraph.map(line => renderInline(line)).join('<br>') + '</p>\n';
          paragraph = [];
        }
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim() === '') {
          flushList();
          flushParagraph();
          result += '\n';
          continue;
        }

        if (/^CODEBLOCK_\d+$/.test(line.trim())) {
          flushList();
          flushParagraph();
          result += line.trim() + '\n';
          continue;
        }

        const footnoteDefMatch = line.match(/^\[\^([^\]]+)\]:\s*(.*)/);
        if (footnoteDefMatch) {
          flushList();
          flushParagraph();
          const fnId = getFootnoteId(footnoteDefMatch[1]);
          footnotes[fnId] = { key: footnoteDefMatch[1], content: footnoteDefMatch[2] };
          continue;
        }

        const blockquoteMatch = line.match(/^(>+)\s?(.*)/);
        if (blockquoteMatch) {
          flushList();
          flushParagraph();
          const quoteLines = [];
          let j = i;
          while (j < lines.length) {
            const qm = lines[j].match(/^((?:>\s*)+)(.*)/);
            if (qm) {
              quoteLines.push({ level: (qm[1].match(/>/g) || []).length, content: qm[2] });
              j++;
            } else if (lines[j].trim() === '') break;
            else break;
          }
          i = j - 1;

          function buildLevel(startIdx, currentLevel) {
            let html = '';
            let k = startIdx;
            while (k < quoteLines.length) {
              if (quoteLines[k].level < currentLevel) break;
              if (quoteLines[k].level === currentLevel) {
                const parts = [];
                while (k < quoteLines.length && quoteLines[k].level === currentLevel) {
                  parts.push(renderInline(quoteLines[k].content));
                  k++;
                }
                html += parts.join('<br>');
              } else if (quoteLines[k].level > currentLevel) {
                const nested = buildLevel(k, quoteLines[k].level);
                html += nested.html;
                k = nested.newIndex;
              }
            }
            return { html: '<blockquote>' + html + '</blockquote>', newIndex: k };
          }

          const minLevel = Math.min(...quoteLines.map(q => q.level));
          result += buildLevel(0, minLevel).html + '\n';
          continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
          flushList();
          flushParagraph();
          result += '<h' + headingMatch[1].length + '>' + renderInline(headingMatch[2]) + '</h' + headingMatch[1].length + '>\n';
          continue;
        }

        if (/^---$/.test(line.trim()) || /^\*\*\*$/.test(line.trim()) || /^___$/.test(line.trim())) {
          flushList();
          flushParagraph();
          result += '<hr />\n';
          continue;
        }

        const tableLineMatch = line.match(/^\|(.+)\|$/);
        if (tableLineMatch) {
          flushList();
          flushParagraph();
          const tableRows = [];
          let j = i;
          while (j < lines.length) {
            const tmatch = lines[j].match(/^\|(.+)\|$/);
            if (tmatch) { tableRows.push(tmatch[1]); j++; }
            else break;
          }
          i = j - 1;
          if (tableRows.length >= 2) {
            const headerCells = tableRows[0].split('|').map(c => c.trim());
            const alignRow = tableRows[1].split('|').map(c => c.trim());
            const isAlignRow = alignRow.every(c => /^:?-+:?$/.test(c));
            const dataStart = isAlignRow ? 2 : 1;
            const alignments = isAlignRow ? alignRow.map(c => /^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : 'left') : headerCells.map(() => 'left');

            let tableHtml = '<table><thead><tr>';
            headerCells.forEach((cell, ci) => {
              tableHtml += '<th style="text-align:' + alignments[ci] + ';">' + renderInline(cell) + '</th>';
            });
            tableHtml += '</tr></thead><tbody>';
            for (let ri = dataStart; ri < tableRows.length; ri++) {
              const rowCells = tableRows[ri].split('|').map(c => c.trim());
              tableHtml += '<tr>';
              for (let rci = 0; rci < headerCells.length; rci++) {
                const cell = rci < rowCells.length ? rowCells[rci] : '';
                tableHtml += '<td style="text-align:' + alignments[rci] + ';">' + renderInline(cell) + '</td>';
              }
              tableHtml += '</tr>';
            }
            tableHtml += '</tbody></table>';
            result += tableHtml + '\n';
            continue;
          }
        }

        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
        if (listMatch) {
          flushParagraph();
          const indent = listMatch[1].length;
          const marker = listMatch[2];
          let listContent = listMatch[3];
          const isTask = listContent.match(/^\[([ x])\]\s+(.*)/);
          const taskChecked = isTask ? isTask[1] === 'x' : false;
          const taskContent = isTask ? isTask[2] : listContent;
          const isOrdered = /^\d+\.$/.test(marker);
          const listType = isOrdered ? 'ol' : (isTask ? 'task' : 'ul');
          const currentLevel = Math.floor(indent / 2);

          if (!inList) {
            inList = true;
            listStack = [{ type: listType, items: [], level: currentLevel, start: isOrdered ? parseInt(marker) : null }];
          } else {
            while (listStack.length > 0 && listStack[listStack.length - 1].level > currentLevel) {
              const last = listStack.pop();
              if (listStack.length > 0 && last.items.length > 0) {
                listStack[listStack.length - 1].items.push(last.items.join(''));
              }
            }
            if (listStack.length === 0 || listStack[listStack.length - 1].level < currentLevel) {
              listStack.push({ type: listType, items: [], level: currentLevel, start: isOrdered ? parseInt(marker) : null });
            }
          }

          const itemHtml = isTask
            ? '<li data-checked="' + (taskChecked ? 'true' : 'false') + '">' + renderInline(taskContent) + '</li>'
            : '<li>' + renderInline(listContent) + '</li>';
          listStack[listStack.length - 1].items.push(itemHtml);

          const subItems = [];
          let k = i + 1;
          while (k < lines.length) {
            const nm = lines[k].match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
            if (nm && parseInt(nm[1].length) > indent) {
              const subContent = nm[3];
              const subTask = subContent.match(/^\[([ x])\]\s+(.*)/);
              subItems.push(subTask
                ? '<li data-checked="' + (subTask[1] === 'x' ? 'true' : 'false') + '">' + renderInline(subTask[2]) + '</li>'
                : '<li>' + renderInline(subContent) + '</li>');
              k++;
            } else break;
          }

          if (subItems.length > 0) {
            const hasCheckbox = subItems.some(item => item.includes('data-checked'));
            const subHtml = '<ul class="' + (hasCheckbox ? 'task-list' : '') + '">\n' + subItems.join('\n') + '\n</ul>';
            const currentList = listStack[listStack.length - 1];
            currentList.items[currentList.items.length - 1] = currentList.items[currentList.items.length - 1].replace(/<\/li>$/, subHtml + '</li>');
          }
          i = k - 1;
          continue;
        }

        if (inList) {
          flushList();
        }

        const dlMatch = line.match(/^([^:]+):\s+(.*)/);
        if (dlMatch && i + 1 < lines.length && lines[i + 1].match(/^:\s+/)) {
          flushParagraph();
          const term = renderInline(dlMatch[1]);
          const defs = [];
          i++;
          while (i < lines.length && lines[i].match(/^:\s+/)) {
            defs.push(renderInline(lines[i].replace(/^:\s+/, '')));
            i++;
          }
          while (i < lines.length && lines[i].trim() === '') i++;
          result += '<dl><dt>' + term + '</dt>' + defs.map(d => '<dd>' + d + '</dd>').join('') + '</dl>\n';
          continue;
        }

        paragraph.push(line);
      }

      if (inList) flushList();
      flushParagraph();
      return result;
    }

    const codeBlockRegex = /^(\s*)```(\w*)\s*\n([\s\S]*?)\1```/gm;
    const codeBlocks = [];
    let codeIndex = 0;
    md = md.replace(codeBlockRegex, function (match, indent, lang, code) {
      const id = 'CODEBLOCK_' + (codeIndex++);
      codeBlocks.push({ id: id, lang: lang, code: code.replace(/^\n+|\n+$/g, '') });
      return id;
    });

    let html = renderBlock(md);

    codeBlocks.forEach((block, b) => {
      const copyId = 'code-' + Date.now() + '-' + b;
      const lines = block.code.split('\n');
      const lineCount = lines.length;
      let maxLineLength = 0;
      let totalChars = 0;
      lines.forEach(line => {
        maxLineLength = Math.max(maxLineLength, line.length);
        totalChars += line.length;
      });
      totalChars += lineCount > 0 ? lineCount - 1 : 0;

      let codeHtml = '';
      lines.forEach((line, j) => {
        codeHtml += '<span class="code-line"><span class="line-number">' + (j + 1) + '</span><span class="hljs">' + escapeHtml(line) + '</span></span>';
      });

      const statsHtml = '<span>' + lineCount + ' 行</span> · <span>' + maxLineLength + ' 列</span> · <span>' + totalChars + ' 字符</span>';
      const codeBlockHtml = `
        <div class="code-block-wrapper" id="cbw-${copyId}">
          <div class="code-block-header">
            <span class="lang-label">${escapeHtml(block.lang || 'text')}</span>
            <span class="code-stats">${statsHtml}</span>
            <span class="header-actions">
              <button class="copy-btn" data-copy="${copyId}"><i class="fas fa-copy"></i> 复制</button>
              <button class="collapse-btn" data-target="cbw-${copyId}"><i class="fas fa-chevron-up"></i></button>
            </span>
          </div>
          <div class="code-block-body-wrapper">
            <div class="code-block-body" id="code-body-${copyId}">${codeHtml}</div>
          </div>
        </div>`;
      html = html.replace(block.id, codeBlockHtml);
    });

    if (Object.keys(footnotes).length > 0) {
      let footnotesHtml = '<div class="footnotes">';
      for (let fnId = 1; fnId <= footnoteCounter; fnId++) {
        if (footnotes[fnId]) {
          footnotesHtml += '<div class="footnote-def" id="footnote-def-' + fnId + '">';
          footnotesHtml += '<a class="footnote-back" data-footnote-back="' + fnId + '">↩</a> ';
          footnotesHtml += '<span class="footnote-number">[' + fnId + ']</span> ';
          footnotesHtml += renderInline(footnotes[fnId].content);
          footnotesHtml += '</div>';
        }
      }
      footnotesHtml += '</div>';
      html += footnotesHtml;
    }

    return html.replace(/\n{3,}/g, '\n\n');
  }

  function initImageLazyLoad(container) {
    container.querySelectorAll('.img-placeholder').forEach(function (wrapper) {
      const img = wrapper.querySelector('img');
      if (!img) return;
      const done = () => {
        wrapper.classList.add('loaded');
        img.classList.add('loaded');
        const loading = wrapper.querySelector('.img-loading');
        if (loading) loading.style.display = 'none';
      };
      if (img.complete && img.naturalWidth !== 0) {
        done();
      } else {
        img.addEventListener('load', done);
        img.addEventListener('error', done);
      }
    });
  }

  function initVideoLazyLoad(container) {
    container.querySelectorAll('.video-placeholder').forEach(function (wrapper) {
      const iframe = wrapper.querySelector('iframe');
      if (!iframe) return;
      const loadingEl = wrapper.querySelector('.video-loading');
      const done = () => {
        wrapper.classList.add('loaded');
        if (loadingEl) loadingEl.style.display = 'none';
      };
      iframe.addEventListener('load', done);
      setTimeout(() => {
        if (!wrapper.classList.contains('loaded')) done();
      }, 8000);
    });
  }

  function initCodeHighlight(container) {
    if (!global.hljs) return;
    container.querySelectorAll('.code-line .hljs').forEach(el => {
      try { global.hljs.highlightElement(el); } catch (e) {}
    });
  }

  function wrapImagesInPlaceholders(container) {
    container.querySelectorAll('img').forEach(img => {
      if (img.closest('.img-placeholder')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'img-placeholder';
      wrapper.innerHTML = '<span class="img-loading"><i class="fas fa-spinner fa-spin"></i></span>';
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      const alt = img.getAttribute('alt') || '';
      if (alt) {
        const altSpan = document.createElement('span');
        altSpan.className = 'img-alt-text';
        altSpan.textContent = alt;
        wrapper.appendChild(altSpan);
      }
    });
  }

  // ========= 修改点：使用 Fancybox 替换原有灯箱 =========
  function bindImageLightbox(container) {
    // 收集当前容器内所有图片数据
    const images = [];
    container.querySelectorAll('.img-placeholder img').forEach(img => {
      const src = img.getAttribute('src');
      if (src) {
        images.push({
          src: src,
          alt: img.getAttribute('alt') || ''
        });
      }
    });

    if (images.length === 0) return;

    // 为每个图片绑定点击事件
    container.querySelectorAll('.img-placeholder img').forEach((img, index) => {
      img.style.cursor = 'pointer';
      // 移除原有事件避免重复绑定
      img.removeEventListener('click', handleClick);
      img.addEventListener('click', handleClick);

      function handleClick(e) {
        e.stopPropagation();

        // 检查 Fancybox 是否可用
        if (typeof window.Fancybox === 'undefined') {
          console.warn('Fancybox is not loaded');
          return;
        }

        // 构造 Fancybox 需要的 slides 数据，保留 alt 作为 caption
        const slides = images.map(({ src, alt }) => ({
          src: src,
          caption: alt || '',   // Fancybox 会显示在底部
          alt: alt || ''        // 保留 alt 属性备用
        }));

        // 调用 Fancybox
        window.Fancybox.show(slides, {
          startIndex: index,
          // 可选：自定义 caption 渲染（默认已使用 slide.caption）
          caption: (fancybox, slide) => slide.caption || '',
          // 保持与原来类似的行为
          mainClass: 'fancybox-theme-custom',
          // 可根据需要开启缩略图、自动播放等
          // Thumbs: { autoStart: false },
          // Autoplay: { timeout: 3000 },
        });
      }
    });
  }
  // ========= 修改结束 =========

  function mountMarkdown(container, markdownText) {
    if (!container) return;
    container.innerHTML = renderMarkdown(markdownText || '');
    container.classList.add('markdown-body');
    wrapImagesInPlaceholders(container);
    initImageLazyLoad(container);
    initVideoLazyLoad(container);
    initCodeHighlight(container);
    bindImageLightbox(container);
    return container;
  }

  // 保留原 openLightbox 函数（备而不用，但保留以防其他代码调用）
  // 如果不希望保留，可以注释或删除
  let lbIsOpen = false;
  function openLightbox(images, index) {
    // 这个函数现在不再被 bindImageLightbox 调用
    // 但保留以兼容可能的外部调用
    if (typeof window.Fancybox !== 'undefined') {
      const slides = images.map(img => ({ src: img.src, caption: img.alt || '' }));
      window.Fancybox.show(slides, { startIndex: index || 0 });
    } else {
      console.warn('Fancybox not available, fallback to nothing');
    }
  }

  // 注意：原有的 lightbox-overlay 相关代码（如 openLightbox 中的 overlay 逻辑）已被移除，
  // 但若你有其他依赖，可以保留。这里我们仅保留 openLightbox 作为兼容。

  document.addEventListener('click', function (e) {
    const footnoteRef = e.target.closest('[data-footnote-ref]');
    if (footnoteRef) {
      e.preventDefault();
      scrollToFootnote('footnote-def-' + footnoteRef.getAttribute('data-footnote-ref'));
      return;
    }

    const footnoteBack = e.target.closest('[data-footnote-back]');
    if (footnoteBack) {
      e.preventDefault();
      const backId = footnoteBack.getAttribute('data-footnote-back');
      const refLink = document.querySelector('[data-footnote-ref="' + backId + '"]');
      if (refLink) {
        const targetY = refLink.getBoundingClientRect().top + window.scrollY - 80;
        const startY = window.scrollY || window.pageYOffset;
        const distance = targetY - startY;
        if (Math.abs(distance) < 5) return;
        const duration = 350;
        const startTime = performance.now();
        function step(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          window.scrollTo(0, startY + distance * ease);
          if (progress < 1) requestAnimationFrame(step);
          else window.scrollTo(0, targetY);
        }
        requestAnimationFrame(step);
      }
      return;
    }

    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      const targetId = copyBtn.dataset.copy;
      const wrapper = document.getElementById('cbw-' + targetId);
      if (!wrapper) return;
      let text = '';
      wrapper.querySelectorAll('.code-line').forEach(line => {
        const clone = line.cloneNode(true);
        const lineNum = clone.querySelector('.line-number');
        if (lineNum) lineNum.remove();
        text += clone.textContent + '\n';
      });
      text = text.replace(/\n$/, '');
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      ta.style.width = '1px';
      ta.style.height = '1px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        const success = document.execCommand('copy');
        if (success) {
          copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> 复制';
            copyBtn.classList.remove('copied');
          }, 2000);
        }
      } catch (err) {}
      document.body.removeChild(ta);
      return;
    }

    const collapseBtn = e.target.closest('.collapse-btn');
    if (collapseBtn) {
      const targetId = collapseBtn.dataset.target;
      const wrapper = document.getElementById(targetId);
      if (!wrapper) return;
      const icon = collapseBtn.querySelector('i');
      wrapper.classList.toggle('collapsed');
      icon.className = wrapper.classList.contains('collapsed') ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      return;
    }
  });

  // 保留 scrollToFootnote 辅助函数（可能被上面使用）
  function scrollToFootnote(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const targetY = el.getBoundingClientRect().top + window.scrollY - 80;
    const startY = window.scrollY || window.pageYOffset;
    const distance = targetY - startY;
    if (Math.abs(distance) < 5) return;
    const duration = 350;
    const startTime = performance.now();
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, startY + distance * ease);
      if (progress < 1) requestAnimationFrame(step);
      else window.scrollTo(0, targetY);
    }
    requestAnimationFrame(step);
  }

  global.KSMarkdown = {
    renderMarkdown: renderMarkdown,
    mountMarkdown: mountMarkdown,
    markdownToPlainText: markdownToPlainText,
    countWords: countWords,
    openLightbox: openLightbox,   // 保留出口，但实际内部可能用 Fancybox
    initImageLazyLoad: initImageLazyLoad,
    initVideoLazyLoad: initVideoLazyLoad,
    initCodeHighlight: initCodeHighlight
  };
})(window);