'use strict';

// 日志都是给人看的 Markdown，这里只做"够用"的解析：标题分节、表格、`- 键: 值` 列表、front matter。

// "450"、"约450"、"~450"、"1,200" → 数字；"400-500"、"400~500" 这种区间取中点
function num(text) {
  if (text == null) return null;
  const s = String(text).replace(/,/g, '').trim();
  if (!s) return null;
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–~～至]\s*(\d+(?:\.\d+)?)/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// "7h20m"、"7小时20分"、"7:20"、"7.3" → 小时数
function hours(text) {
  if (text == null) return null;
  const s = String(text).trim();
  if (!s) return null;
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|小时)\s*(?:(\d+)\s*(?:m|min|分钟?)?)?/i);
  if (m) return parseFloat(m[1]) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
  m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  return num(s);
}

// 取 "## 标题" 下面到下一个 "## " 之前的内容；标题按前缀匹配
function section(md, title) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+/.test(l) && l.replace(/^##\s+/, '').trim().startsWith(title));
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

// 第一张表格 → [{表头: 单元格}]；跳过分隔行和全空行
function table(text) {
  const rows = text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  if (rows.length < 2) return [];
  const header = splitRow(rows[0]);
  return rows
    .slice(1)
    .filter((l) => !/^\|?\s*:?-{2,}/.test(l.trim()))
    .map(splitRow)
    .filter((cells) => cells.some((c) => c !== ''))
    .map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])));
}

// 按关键词找列：col(row, '热量', 'kcal')
function col(row, ...keywords) {
  const key = Object.keys(row).find((k) => keywords.some((w) => k.toLowerCase().includes(w.toLowerCase())));
  return key === undefined ? '' : row[key];
}

// 两列表格和 "- 键: 值" 列表 → {键: 值}
function kv(text) {
  const out = {};
  for (const row of table(text)) {
    const [k, v] = Object.values(row);
    if (k) out[k] = v ?? '';
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s*([^:：]+)[:：]\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function pick(map, ...keywords) {
  const key = Object.keys(map).find((k) => keywords.some((w) => k.toLowerCase().includes(w.toLowerCase())));
  return key === undefined ? '' : map[key];
}

function frontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kvm = line.replace(/\s+#.*$/, '').match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (kvm && kvm[2] !== '') out[kvm[1]] = kvm[2];
  }
  return out;
}

// 用 start/end 标记替换一块内容；没有标记就追加到 "## 标题" 节末尾（没有该节则追加到文件末尾）
function replaceBlock(md, start, end, content, title) {
  const block = `${start}\n${content.trim()}\n${end}`;
  const s = md.indexOf(start);
  const e = md.indexOf(end);
  if (s !== -1 && e > s) return md.slice(0, s) + block + md.slice(e + end.length);
  const lines = md.split('\n');
  const idx = lines.findIndex((l) => /^##\s+/.test(l) && l.replace(/^##\s+/, '').trim().startsWith(title));
  if (idx === -1) return `${md.trimEnd()}\n\n## ${title}\n\n${block}\n`;
  let next = lines.findIndex((l, i) => i > idx && /^##\s+/.test(l));
  if (next === -1) next = lines.length;
  const before = lines.slice(0, next).join('\n').trimEnd();
  const after = lines.slice(next).join('\n');
  return `${before}\n\n${block}\n${after ? `\n${after}` : ''}`;
}

module.exports = { num, hours, section, table, col, kv, pick, frontMatter, replaceBlock };
