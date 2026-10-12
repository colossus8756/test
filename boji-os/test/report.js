'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeProfile, targets } = require('../lib/calc');
const { parseDay, parseReps, dailyReport, weeklyReview } = require('../lib/report');

const example = fs.readFileSync(path.join(__dirname, '../examples/me/days/2026-10-12.md'), 'utf8');
const profile = normalizeProfile({ sex: 'male', age: '36', height_cm: '172', weight_kg: '75', body_fat_pct: '29', goal: 'cut' });
const t = targets(profile);

function day({ weight, kcal = 1700, protein = 130, sleep = '7.5', trained = false, pain = '无' }) {
  return parseDay(`## 身体数据
| 指标 | 数值 |
|---|---|
| 晨重(kg) | ${weight ?? ''} |
| 睡眠(h) | ${sleep} |

## 饮食
| 时间 | 餐次 | 食物 | 热量(kcal) | 蛋白质(g) | 碳水(g) | 脂肪(g) | 照片 |
|---|---|---|---|---|---|---|---|
| 12:00 | 午餐 | 套餐 | ${kcal} | ${protein} | 150 | 60 | |

## 训练
| 动作 | 组数 | 次数 | 重量(kg) | RPE | 备注 |
|---|---|---|---|---|---|
${trained ? '| 深蹲 | 3 | 8 | 50 | 8 | |' : ''}

## 状态
- 疼痛/不适: ${pain}
`);
}

test('parseReps 支持统一次数和逐组次数', () => {
  assert.deepEqual(parseReps('8', 3), [8, 8, 8]);
  assert.deepEqual(parseReps('8/8/7', 3), [8, 8, 7]);
  assert.deepEqual(parseReps('10,9', 0), [10, 9]);
  assert.deepEqual(parseReps('', 3), []);
});

test('解析示例日志', () => {
  const d = parseDay(example);
  assert.equal(d.body.weight, 74.8);
  assert.ok(Math.abs(d.body.sleepH - 6.667) < 0.01);
  assert.equal(d.body.expenditure, 2350);
  assert.equal(d.meals.length, 3);
  assert.equal(d.meals[1].kcal, 660);
  assert.equal(d.training.length, 4);
  assert.deepEqual(d.training[0].reps, [8, 8, 7]);
  assert.equal(d.status.pain, '');
});

test('日报：缺口过大、低于基础代谢、睡眠不足都会提醒', () => {
  const { summary, flags } = dailyReport(parseDay(example), t);
  assert.equal(summary.intake.kcal, 1470);
  assert.equal(summary.deficit, 880);
  assert.equal(summary.volume, 50 * 23 + 40 * 24 + 20 * 30 + 6 * 45);
  assert.ok(flags.some((f) => f.includes('超过 600')));
  assert.ok(flags.some((f) => f.includes('低于基础代谢')));
  assert.ok(flags.some((f) => f.includes('睡眠')));
});

test('日报：记录疼痛会触发停训提醒；没有饮食记录不算缺口', () => {
  const painful = dailyReport(day({ pain: '右膝下蹲时刺痛' }), t);
  assert.ok(painful.flags.some((f) => f.includes('右膝下蹲时刺痛')));
  const empty = dailyReport(parseDay('## 饮食\n'), t);
  assert.equal(empty.summary.deficit, null);
  assert.ok(empty.flags[0].includes('还没有饮食记录'));
});

test('周报：按掉重速度给出调整建议', () => {
  const week = (w) => Array.from({ length: 7 }, (_, i) => ({ date: `d${i}`, day: day({ weight: w, trained: i % 2 === 0 }) }));
  const tooFast = weeklyReview(week(73.5), week(75), t, profile);
  assert.ok(tooFast.rate < -1);
  assert.ok(tooFast.advice[0].includes('加 150 kcal'));
  const ideal = weeklyReview(week(74.5), week(75), t, profile);
  assert.ok(ideal.advice[0].includes('保持不动'));
  const stalled = weeklyReview(week(75), week(75), t, profile);
  assert.ok(stalled.advice[0].includes('停滞'));
  assert.equal(stalled.sessions, 4);
});

test('周报：体重数据不足时不下结论', () => {
  const sparse = [{ date: 'd0', day: day({ weight: 75 }) }];
  const r = weeklyReview(sparse, [], t, profile);
  assert.equal(r.rate, null);
  assert.ok(r.advice[0].includes('体重数据不足'));
  assert.ok(r.advice.some((a) => a.includes('训练 0 次')));
});
