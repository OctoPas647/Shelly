/* ================= Rich text: markdown-lite + math =================
   rich(text)        -> block HTML (paragraphs, lists, headings, quotes)
   richInline(text)  -> inline HTML (for options, chips, short labels)
   Everything is escaped first, so a shared module can never inject HTML or scripts. */
const mathCache = new Map();
function mathHTML(src, display) {
  const k = (display ? 'D' : 'I') + src;
  if (mathCache.has(k)) return mathCache.get(k);
  let html;
  try { html = katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html', strict: false }); }
  catch (e) { html = `<code class="mathfail">${esc(src)}</code>`; }
  if (mathCache.size > 800) mathCache.clear();
  mathCache.set(k, html); return html;
}

/* Pull math and code out before escaping, put them back at the end */
function protect(text) {
  const keep = [];
  const put = html => '\u0000' + (keep.push(html) - 1) + '\u0000';
  let s = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\\\$/g, () => put('$'));
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m, x) => put('\u0001' + mathHTML(x.trim(), true)));
  s = s.replace(/\$([^$\n]+?)\$/g, (m, x) => put(mathHTML(x.trim(), false)));
  s = s.replace(/`([^`\n]+)`/g, (m, x) => put(`<code>${esc(x)}</code>`));
  return { s, restore: h => h.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i].replace(/^\u0001/, '')), keep };
}
function inlineMarks(h) {
  return h
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([\s\S]*?\S)__/g, '<u>$1</u>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
    .replace(/(^|[^*\p{L}\p{N}])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}])/gu, '$1<em>$2</em>');
}
function richInline(text) {
  const p = protect(text);
  return p.restore(inlineMarks(esc(p.s)).replace(/\n/g, '<br>'));
}
function rich(text) {
  const p = protect(text), blocks = p.s.replace(/^(#{1,4}[ \t]+.+)$/gm, '\n\n$1\n\n').split(/\n{2,}/), out = [];
  const isItem = l => /^\s*([-•*]|\d+[.)])\s+/.test(l);
  for (let k = 0; k < blocks.length; k++) {
    let b = blocks[k].replace(/^\n+|\n+$/g, ''); if (!b) continue;
    let lines = b.split('\n');
    /* "Some text:" followed straight away by list lines -> a paragraph and then the list */
    const first = lines.findIndex(isItem);
    if (first > 0 && lines.slice(first).every(isItem)) { blocks.splice(k + 1, 0, lines.slice(first).join('\n')); lines = lines.slice(0, first); b = lines.join('\n'); }
    if (/^\u0000\d+\u0000$/.test(b) && p.keep[+b.slice(1, -1)].startsWith('\u0001')) { out.push(`<div class="mathblock">${b}</div>`); continue; }
    const hm = b.match(/^(#{1,4})\s+(.+)$/);
    if (hm && lines.length === 1) { const n = hm[1].length < 4 ? 3 : 4; out.push(`<h${n}>${inlineMarks(esc(hm[2]))}</h${n}>`); continue; }
    if (lines.every(l => /^\s*[-•*]\s+/.test(l))) { out.push('<ul>' + lines.map(l => `<li>${inlineMarks(esc(l.replace(/^\s*[-•*]\s+/, '')))}</li>`).join('') + '</ul>'); continue; }
    if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) { const start = parseInt(lines[0], 10); out.push(`<ol${start !== 1 ? ` start="${start}"` : ''}>` + lines.map(l => `<li>${inlineMarks(esc(l.replace(/^\s*\d+[.)]\s+/, '')))}</li>`).join('') + '</ol>'); continue; }
    if (lines.every(l => /^>\s?/.test(l))) { out.push(`<blockquote>${inlineMarks(esc(lines.map(l => l.replace(/^>\s?/, '')).join('\n'))).replace(/\n/g, '<br>')}</blockquote>`); continue; }
    out.push(`<p>${inlineMarks(esc(b)).replace(/\n/g, '<br>')}</p>`);
  }
  return p.restore(out.join(''));
}
