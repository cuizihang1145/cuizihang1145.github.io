// assets/markdown/markdown-node.js
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#039;');
}

function renderMarkdown(md) {
  if (!md) return '';

  const escMap = {};
  let escCounter = 0;
  md = md.replace(/\\([\\`*_{}\[\]()#+\-.!|$])/g, (match, char) => {
    const key = '\uE000' + (escCounter++) + '\uE001';
    escMap[key] = char;
    return key;
  });

  const safeTags = ['u', 'kbd', 'mark', 's', 'sub', 'sup', 'ins', 'del', 'b', 'i', 'em', 'strong', 'code', 'span', 'br', 'hr'];
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
    html = html.replace(/<[^>]+>/g, (match) => {
      const key = '\uE002' + (tagIndex++) + '\uE003';
      tagMap[key] = match;
      return key;
    });

    html = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>(.*?)<\/\1>/gs, (match, tag, attrs, content) => {
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
      (match, alt, src, title, w, h) => {
        let style = '';
        if (w && h) style = ' style="width:' + w + 'px; height:' + h + 'px;"';
        else if (w) style = ' style="width:' + w + 'px; height:auto;"';
        else if (h) style = ' style="height:' + h + 'px; width:auto;"';
        const titleAttr = title ? ' title="' + title + '"' : '';
        return '<img src="' + src + '" alt="' + alt + '" loading="lazy"' + style + titleAttr + ' />';
      });

    html = html.replace(
      /!video\[([^\]]*)\]\(([^)]*?)(?:\s+"([^"]*)")?(?:\s+=\s*(\d*)(?:x(\d+))?)?\)/g,
      (match, desc, src, title, w, h) => {
        let style = '';
        if (w && h) style = ' style="width:' + w + 'px; height:' + h + 'px;"';
        else if (w) style = ' style="width:' + w + 'px; height:auto;"';
        else if (h) style = ' style="height:' + h + 'px; width:auto;"';
        const descHtml = desc ? '<div class="video-alt-text">' + desc + '</div>' : '';
        const youtubeMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (youtubeMatch) {
          return '<div class="video-placeholder"><iframe src="https://www.youtube.com/embed/' + youtubeMatch[1] + '" frameborder="0" allowfullscreen' + style + '></iframe>' + descHtml + '</div>';
        }
        const bilibiliMatch = src.match(/(?:bilibili\.com\/video\/)(BV[a-zA-Z0-9]+)/);
        if (bilibiliMatch) {
          return '<div class="video-placeholder"><iframe src="https://player.bilibili.com/player.html?bvid=' + bilibiliMatch[1] + '" frameborder="0" allowfullscreen' + style + '></iframe>' + descHtml + '</div>';
        }
        return '<div class="video-placeholder"><video src="' + src + '" controls' + style + '></video>' + descHtml + '</div>';
      });

    html = html.replace(
      /!audio\[([^\]]*)\]\(([^)]*?)(?:\s+"([^"]*)")?(?:\s+=\s*([^)]+))?\)/g,
      (match, title, src, cover, extra) => {
        const titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
        const coverAttr = extra ? ' data-cover="' + escapeHtml(extra) + '"' : '';
        return '<audio controls src="' + src + '"' + titleAttr + coverAttr + '></audio>';
      }
    );

    html = html.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/\[\^([^\]]+)\]/g, (match, key) => {
      const id = getFootnoteId(key);
      return '<sup class="footnote-ref"><a data-footnote-ref="' + id + '">' + id + '</a></sup>';
    });

    html = restoreEscapes(html);
    for (const key in tagMap) {
      html = html.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tagMap[key]);
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
  md = md.replace(codeBlockRegex, (match, indent, lang, code) => {
    const id = 'CODEBLOCK_' + (codeIndex++);
    codeBlocks.push({ id: id, lang: lang, code: code.replace(/^\n+|\n+$/g, '') });
    return id;
  });

  let html = renderBlock(md);

  codeBlocks.forEach((block) => {
    const lines = block.code.split('\n');
    let codeHtml = '';
    lines.forEach((line) => {
      codeHtml += escapeHtml(line) + '\n';
    });
    const codeBlockHtml = `<pre><code class="language-${block.lang || 'text'}">${codeHtml}</code></pre>`;
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

export { renderMarkdown };