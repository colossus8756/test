'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProfile, bmr, targets } = require('../lib/calc');

const base = { sex: 'male', age: '36', height_cm: '172', weight_kg: '75', activity: 'light', goal: 'cut' };

test('有体脂用 Katch-McArdle，没有用 Mifflin-St Jeor', () => {
  assert.equal(Math.round(bmr(normalizeProfile({ ...base, body_fat_pct: '29' }))), 1520);
  // 10*75 + 6.25*172 - 5*36 + 5
  assert.equal(Math.round(bmr(normalizeProfile(base))), 1650);
  assert.equal(Math.round(bmr(normalizeProfile({ ...base, sex: 'female' }))), 1484);
});

test('高体脂时蛋白质按目标体脂下的体重算', () => {
  const t = targets(normalizeProfile({ ...base, body_fat_pct: '29' }));
  assert.equal(t.protein.basisKg, 62.6);
  assert.equal(t.protein.target, 125);
  const lean = targets(normalizeProfile({ ...base, body_fat_pct: '15' }));
  assert.equal(lean.protein.basisKg, 75);
  assert.equal(lean.protein.target, 150);
});

test('缺口不超过 600，热量不低于基础代谢', () => {
  const big = targets(normalizeProfile({ ...base, deficit_kcal: '1000' }));
  assert.ok(big.deficit <= 600);
  const small = targets(normalizeProfile({ ...base, body_fat_pct: '29', activity: 'sedentary', deficit_kcal: '600' }));
  assert.equal(small.kcal, small.kcalFloor);
  assert.ok(small.deficit < 600);
});

test('deficit_kcal 为 0 时不回退到默认值', () => {
  const t = targets(normalizeProfile({ ...base, deficit_kcal: '0' }));
  assert.equal(t.deficit, 0);
  assert.equal(t.kcal, t.tdee);
});

test('缺少基本数据时给出可读的错误', () => {
  assert.throws(() => normalizeProfile({ sex: 'male' }), /age, height_cm, weight_kg/);
});
