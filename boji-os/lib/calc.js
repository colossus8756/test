'use strict';

const { num } = require('./md');

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };

// 默认热量缺口（kcal/天）。600 是硬上限：再大掉肌肉、伤恢复的风险明显上升
const DEFICIT = { cut: 400, recomp: 200, maintain: 0 };
const MAX_DEFICIT = 600;

// 体脂超过这个值时，蛋白质按"目标体脂下的体重"算，避免把脂肪也算进去
const HIGH_BF = { male: 25, female: 32 };
const TARGET_BF = { male: 15, female: 25 };

function normalizeProfile(raw) {
  const sex = /^(f|female|女)/i.test(raw.sex || '') ? 'female' : 'male';
  const p = {
    sex,
    age: num(raw.age),
    height_cm: num(raw.height_cm),
    weight_kg: num(raw.weight_kg),
    body_fat_pct: num(raw.body_fat_pct),
    activity: ACTIVITY[raw.activity] ? raw.activity : 'light',
    goal: DEFICIT[raw.goal] !== undefined ? raw.goal : 'cut',
    deficit_kcal: num(raw.deficit_kcal),
    timezone: raw.timezone || undefined,
  };
  const missing = ['age', 'height_cm', 'weight_kg'].filter((k) => !p[k]);
  if (missing.length) {
    throw new Error(`profile.md 缺少 ${missing.join(', ')}，先填好基本数据（或让 Claude 跑 setup 技能）`);
  }
  return p;
}

function leanMass(p) {
  return p.body_fat_pct ? p.weight_kg * (1 - p.body_fat_pct / 100) : null;
}

// 有体脂用 Katch-McArdle（按瘦体重算，更准），没有就用 Mifflin-St Jeor
function bmr(p) {
  const lbm = leanMass(p);
  if (lbm) return 370 + 21.6 * lbm;
  return 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

function targets(p) {
  const base = bmr(p);
  const tdee = base * ACTIVITY[p.activity];
  const deficit = Math.min(p.deficit_kcal ?? DEFICIT[p.goal], MAX_DEFICIT);
  const floor = Math.max(base, p.sex === 'male' ? 1500 : 1200);
  const kcal = Math.max(tdee - deficit, floor);

  const lbm = leanMass(p);
  const proteinWeight =
    lbm && p.body_fat_pct >= HIGH_BF[p.sex] ? lbm / (1 - TARGET_BF[p.sex] / 100) : p.weight_kg;

  return {
    bmr: Math.round(base),
    tdee: Math.round(tdee),
    deficit: Math.round(tdee - kcal),
    kcal: Math.round(kcal),
    kcalFloor: Math.round(floor),
    maxDeficit: MAX_DEFICIT,
    protein: {
      min: Math.round(proteinWeight * 1.6),
      target: Math.round(proteinWeight * 2.0),
      max: Math.round(proteinWeight * 2.2),
      basisKg: Math.round(proteinWeight * 10) / 10,
    },
    fatMin: Math.round(p.weight_kg * 0.6),
    // 减脂期理想掉重速度：每周 0.5%–1% 体重
    weeklyLossKg: {
      min: Math.round(p.weight_kg * 0.005 * 100) / 100,
      max: Math.round(p.weight_kg * 0.01 * 100) / 100,
    },
    leanMassKg: lbm ? Math.round(lbm * 10) / 10 : null,
  };
}

module.exports = { ACTIVITY, DEFICIT, MAX_DEFICIT, normalizeProfile, leanMass, bmr, targets };
