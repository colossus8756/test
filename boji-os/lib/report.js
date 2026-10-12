'use strict';

const { num, hours, section, table, col, kv, pick } = require('./md');

const NO_PAIN = /^(无|没有|没|否|none|no|n\/a|0|-|—)?$/i;

function parseReps(text, sets) {
  const s = String(text || '').trim();
  if (!s) return [];
  if (/[\/,，、]/.test(s)) return s.split(/[\/,，、]/).map(num).filter((n) => n != null);
  const reps = num(s);
  return reps == null ? [] : Array(Math.max(1, sets || 1)).fill(reps);
}

function parseDay(md) {
  const body = kv(section(md, '身体数据'));
  const status = kv(section(md, '状态'));

  const meals = table(section(md, '饮食'))
    .map((r) => ({
      time: col(r, '时间'),
      meal: col(r, '餐'),
      food: col(r, '食物', '内容'),
      kcal: num(col(r, '热量', 'kcal')),
      protein: num(col(r, '蛋白')),
      carbs: num(col(r, '碳水')),
      fat: num(col(r, '脂肪')),
    }))
    .filter((m) => m.food || m.kcal != null);

  const training = table(section(md, '训练'))
    .map((r) => {
      const sets = num(col(r, '组')) || 0;
      const reps = parseReps(col(r, '次数', 'reps'), sets);
      const weightText = col(r, '重量', 'kg');
      return {
        name: col(r, '动作'),
        sets: sets || reps.length,
        reps,
        weight: num(weightText) || 0,
        rpe: num(col(r, 'rpe')),
        note: col(r, '备注'),
      };
    })
    .filter((t) => t.name);

  const pain = pick(status, '疼痛', '不适');
  return {
    body: {
      weight: num(pick(body, '晨重', '体重', 'weight')),
      sleepH: hours(pick(body, '睡眠(h)', '睡眠时长', 'sleep')),
      sleepScore: num(pick(body, '睡眠评分', '睡眠分')),
      readiness: num(pick(body, '准备度', 'readiness')),
      rhr: num(pick(body, '静息心率', 'rhr')),
      hrv: num(pick(body, 'hrv')),
      expenditure: num(pick(body, '总消耗', 'total')),
      steps: num(pick(body, '步数', 'steps')),
    },
    meals,
    training,
    status: {
      pain: NO_PAIN.test(pain.trim()) ? '' : pain.trim(),
      energy: num(pick(status, '精力')),
      note: pick(status, '备注'),
    },
  };
}

function sum(list, key) {
  return list.reduce((acc, x) => acc + (x[key] || 0), 0);
}

function summarize(day, t) {
  const intake = {
    kcal: Math.round(sum(day.meals, 'kcal')),
    protein: Math.round(sum(day.meals, 'protein')),
    carbs: Math.round(sum(day.meals, 'carbs')),
    fat: Math.round(sum(day.meals, 'fat')),
  };
  const expenditure = day.body.expenditure || t.tdee;
  const sets = day.training.reduce((a, x) => a + x.sets, 0);
  const volume = Math.round(day.training.reduce((a, x) => a + x.weight * x.reps.reduce((s, r) => s + r, 0), 0));
  return {
    intake,
    expenditure,
    expenditureSource: day.body.expenditure ? '手环/戒指' : '估算 TDEE',
    deficit: day.meals.length ? Math.round(expenditure - intake.kcal) : null,
    sets,
    volume,
    trained: day.training.length > 0,
  };
}

function fmt(n) {
  return n == null ? '—' : Math.round(n).toLocaleString('en-US');
}

function dailyReport(day, t) {
  const s = summarize(day, t);
  const flags = [];

  if (!day.meals.length) {
    flags.push('📝 今天还没有饮食记录——拍照发给 Claude（meal 技能）就能记上');
  } else {
    if (s.intake.protein < t.protein.min) {
      flags.push(`🥩 蛋白质 ${s.intake.protein} g，低于下限 ${t.protein.min} g：还差 ${t.protein.target - s.intake.protein} g 到目标（约 ${Math.ceil((t.protein.target - s.intake.protein) / 25)} 份手掌大的肉/鱼/蛋白粉）`);
    }
    if (s.deficit > t.maxDeficit) {
      flags.push(`⚠️ 缺口 ${s.deficit} kcal 超过 ${t.maxDeficit} 上限，掉肌肉、睡不好、训练掉力的风险上升——加一份 ${s.deficit - t.deficit} kcal 左右的加餐（优先蛋白质）`);
    }
    if (s.intake.kcal < t.kcalFloor) {
      flags.push(`⚠️ 摄入 ${s.intake.kcal} kcal 低于基础代谢 ${t.kcalFloor}，长期这样会伤身体，不是更快变瘦`);
    }
    if (s.intake.fat && s.intake.fat < t.fatMin) {
      flags.push(`🥑 脂肪 ${s.intake.fat} g 低于 ${t.fatMin} g，长期过低影响激素`);
    }
  }
  if (day.body.sleepH != null && day.body.sleepH < 7) {
    flags.push(`😴 睡眠 ${day.body.sleepH.toFixed(1)} h（<7 h）：今天训练降一档强度（RPE 不超过 7），晚上提前 30 分钟上床`);
  }
  if (day.body.readiness != null && day.body.readiness < 70) {
    flags.push(`🔋 准备度 ${day.body.readiness}（<70）：今天做轻量或换成走路/拉伸`);
  }
  const maxRpe = Math.max(0, ...day.training.map((x) => x.rpe || 0));
  if (maxRpe >= 9.5) {
    flags.push(`🏋️ 有组做到 RPE ${maxRpe}（接近力竭）：新手阶段大重量动作留 2–3 次余力更安全`);
  }
  if (day.status.pain) {
    flags.push(`🛑 记录了疼痛/不适：「${day.status.pain}」——按 docs/safety.md 的疼痛规则处理；锐痛、麻木、胸痛请停止训练并就医`);
  }

  const lines = [
    `**能量**：摄入 ${fmt(s.intake.kcal)} / 目标 ${fmt(t.kcal)} kcal · 消耗 ${fmt(s.expenditure)}（${s.expenditureSource}）· 缺口 ${fmt(s.deficit)} kcal`,
    `**蛋白质**：${fmt(s.intake.protein)} / 目标 ${t.protein.target} g（下限 ${t.protein.min}）· 碳水 ${fmt(s.intake.carbs)} g · 脂肪 ${fmt(s.intake.fat)} g`,
    `**身体**：体重 ${day.body.weight ?? '—'} kg · 睡眠 ${day.body.sleepH != null ? day.body.sleepH.toFixed(1) : '—'} h · 步数 ${fmt(day.body.steps)}`,
    s.trained
      ? `**训练**：${day.training.length} 个动作 · ${s.sets} 组 · 总量 ${fmt(s.volume)} kg`
      : '**训练**：休息日（走路、拉伸也算数）',
    '',
    flags.length ? '**提醒**' : '**提醒**：今天各项都在安全范围内 ✅',
    ...flags.map((f) => `- ${f}`),
  ];
  return { markdown: lines.join('\n'), summary: s, flags };
}

function avg(list) {
  const xs = list.filter((x) => x != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// days / prevDays: [{date, day}]，day 为 parseDay 的结果
function weeklyReview(days, prevDays, t, profile) {
  const sums = days.map(({ day }) => summarize(day, t));
  const logged = days.filter(({ day }) => day.meals.length);
  const loggedSums = logged.map(({ day }) => summarize(day, t));
  const weights = days.map(({ day }) => day.body.weight).filter((w) => w != null);
  const prevWeights = prevDays.map(({ day }) => day.body.weight).filter((w) => w != null);
  const wNow = avg(weights);
  const wPrev = avg(prevWeights);
  const rate = weights.length >= 3 && prevWeights.length >= 3 ? ((wNow - wPrev) / wPrev) * 100 : null;
  const sessions = sums.filter((s) => s.trained).length;
  const proteinOk = loggedSums.filter((s) => s.intake.protein >= t.protein.min).length;
  const sleep = avg(days.map(({ day }) => day.body.sleepH));
  const painDays = days.filter(({ day }) => day.status.pain);

  const advice = [];
  if (rate == null) {
    advice.push('体重数据不足（两周各需 ≥3 次晨重），先坚持每天起床空腹称重');
  } else if (profile.goal === 'cut') {
    if (rate < -1.0) advice.push(`掉重 ${rate.toFixed(2)}%/周，快于 1%：每天加 150 kcal（优先加在训练前后的碳水），保肌肉`);
    else if (rate <= -0.5) advice.push(`掉重 ${rate.toFixed(2)}%/周，在 0.5–1% 理想区间：保持不动`);
    else if (rate <= -0.25) advice.push(`掉重 ${rate.toFixed(2)}%/周，偏慢但可接受：可以每天多走 2000 步`);
    else advice.push(`掉重 ${rate.toFixed(2)}%/周，基本停滞：先核对饮食记录是否完整，确认后每天减 150 kcal 或多走 2000 步`);
  } else if (Math.abs(rate) > 0.25) {
    advice.push(`体重变化 ${rate.toFixed(2)}%/周，${profile.goal === 'recomp' ? '重组期' : '维持期'}希望在 ±0.25% 内：按方向微调 100–150 kcal`);
  } else {
    advice.push(`体重变化 ${rate.toFixed(2)}%/周，稳定 ✅`);
  }
  if (sessions < 3) advice.push(`本周训练 ${sessions} 次，薄肌计划需要每周 3 次全身力量训练`);
  if (logged.length && proteinOk < logged.length) {
    advice.push(`蛋白质达标 ${proteinOk}/${logged.length} 天：把蛋白质放在每餐第一口，早餐最容易缺`);
  }
  if (sleep != null && sleep < 7) advice.push(`平均睡眠 ${sleep.toFixed(1)} h：睡眠不足时减脂掉的更多是肌肉，这是本周优先级最高的事`);
  if (painDays.length) {
    advice.push(`有 ${painDays.length} 天记录了疼痛（${painDays.map((d) => d.date).join('、')}）：相关动作减重或替换，持续超过 1–2 周请看医生/康复师`);
  }
  if (logged.length < days.length) advice.push(`饮食记录 ${logged.length}/${days.length} 天，记录不全时以上结论会失真`);

  const lines = [
    `| 指标 | 本周 | 目标 |`,
    `|---|---|---|`,
    `| 平均体重 | ${wNow != null ? wNow.toFixed(1) : '—'} kg（上周 ${wPrev != null ? wPrev.toFixed(1) : '—'}） | 每周 -${t.weeklyLossKg.min}~-${t.weeklyLossKg.max} kg |`,
    `| 平均摄入 | ${fmt(avg(loggedSums.map((s) => s.intake.kcal)))} kcal | ${fmt(t.kcal)} kcal |`,
    `| 平均蛋白质 | ${fmt(avg(loggedSums.map((s) => s.intake.protein)))} g | ${t.protein.target} g |`,
    `| 平均缺口 | ${fmt(avg(loggedSums.map((s) => s.deficit)))} kcal | ${t.deficit}（≤${t.maxDeficit}） |`,
    `| 训练次数 | ${sessions} 次 · ${sums.reduce((a, s) => a + s.sets, 0)} 组 | 3 次 |`,
    `| 平均睡眠 | ${sleep != null ? sleep.toFixed(1) : '—'} h | ≥7 h |`,
    `| 平均步数 | ${fmt(avg(days.map(({ day }) => day.body.steps)))} | 8,000+ |`,
    '',
    '**调整建议**',
    ...advice.map((a) => `- ${a}`),
  ];
  return { markdown: lines.join('\n'), rate, sessions, advice };
}

module.exports = { parseDay, parseReps, summarize, dailyReport, weeklyReview };
