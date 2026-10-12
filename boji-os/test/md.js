'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { num, hours, section, table, col, kv, frontMatter, replaceBlock } = require('../lib/md');

test('num 解析估算值和区间', () => {
  assert.equal(num('450'), 450);
  assert.equal(num('约 450 kcal'), 450);
  assert.equal(num('~450'), 450);
  assert.equal(num('1,200'), 1200);
  assert.equal(num('620-700'), 660);
  assert.equal(num('30～40'), 35);
  assert.equal(num(''), null);
  assert.equal(num('自重'), null);
});

test('hours 解析各种睡眠写法', () => {
  assert.equal(hours('7.5'), 7.5);
  assert.equal(hours('7:30'), 7.5);
  assert.equal(hours('7h30m'), 7.5);
  assert.equal(hours('7小时30分'), 7.5);
  assert.equal(hours('8h'), 8);
  assert.equal(hours(''), null);
});

test('section 只取到下一个二级标题', () => {
  const md = '# T\n\n## 饮食\nA\n### 小节\nB\n## 训练\nC';
  assert.equal(section(md, '饮食').trim(), 'A\n### 小节\nB');
  assert.equal(section(md, '训练').trim(), 'C');
  assert.equal(section(md, '不存在'), '');
});

test('table 跳过分隔行和空行，按表头取列', () => {
  const rows = table('| 食物 | 热量(kcal) |\n|:---|---:|\n| 米饭 | 200 |\n| | |\n| 鸡蛋 | 70 |');
  assert.equal(rows.length, 2);
  assert.equal(col(rows[0], '热量'), '200');
  assert.equal(col(rows[1], '食物'), '鸡蛋');
  assert.equal(col(rows[1], '不存在'), '');
});

test('kv 同时支持两列表格和列表', () => {
  const map = kv('| 指标 | 数值 |\n|---|---|\n| 晨重(kg) | 74.8 |\n\n- 疼痛/不适: 左膝\n- 精力(1-5)：4');
  assert.equal(map['晨重(kg)'], '74.8');
  assert.equal(map['疼痛/不适'], '左膝');
  assert.equal(map['精力(1-5)'], '4');
});

test('frontMatter 忽略注释和空值', () => {
  const fm = frontMatter('---\nsex: male   # 注释\nage:      # 岁\nheight_cm: 172\n---\n# 正文');
  assert.deepEqual(fm, { sex: 'male', height_cm: '172' });
});

test('replaceBlock 有标记就替换，没有就追加到对应小节', () => {
  const S = '<!-- s -->';
  const E = '<!-- e -->';
  const first = replaceBlock('# D\n\n## 日报\n\n## 附录\nx\n', S, E, 'v1', '日报');
  assert.match(first, /## 日报\n\n<!-- s -->\nv1\n<!-- e -->\n\n## 附录/);
  const second = replaceBlock(`${first}\n教练点评`, S, E, 'v2', '日报');
  assert.ok(second.includes('v2') && !second.includes('v1') && second.includes('教练点评'));
  assert.match(replaceBlock('# D', S, E, 'v', '日报'), /## 日报\n\n<!-- s -->\nv\n<!-- e -->/);
});
