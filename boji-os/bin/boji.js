#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { frontMatter, replaceBlock } = require('../lib/md');
const { normalizeProfile, targets } = require('../lib/calc');
const { parseDay, dailyReport, weeklyReview } = require('../lib/report');

const ROOT = path.resolve(__dirname, '..');
const HOME = path.resolve(process.env.BOJI_HOME || path.join(ROOT, 'me'));
const TEMPLATES = path.join(ROOT, 'templates');
const REPORT_START = '<!-- boji:report:start -->';
const REPORT_END = '<!-- boji:report:end -->';
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const USAGE = `薄肌 OS —— 用 Markdown 记录、用 Claude 分析的身体管理系统

用法: node bin/boji.js <命令> [--date YYYY-MM-DD]

  init        初始化 me/ 目录（档案、训练计划、进度表）
  targets     根据 profile.md 算出每日热量/蛋白质目标
  today       创建（或找到）当天日志，打印路径
  report      汇总当天日志，把日报写回日志的「日报」一节
  week        汇总最近 7 天，写 me/weekly/<年>-W<周>.md
  checkup     新建一份体检记录

数据目录默认是 boji-os/me/，可用环境变量 BOJI_HOME 指到别处（比如私有仓库或网盘）。`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

function readProfile() {
  const file = path.join(HOME, 'profile.md');
  if (!fs.existsSync(file)) throw new Error(`找不到 ${file}，先运行: node bin/boji.js init`);
  return normalizeProfile(frontMatter(fs.readFileSync(file, 'utf8')));
}

function today(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isoWeek(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function resolveDate(args, profile) {
  const date = args.date || today(profile?.timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`日期格式应为 YYYY-MM-DD，收到 ${date}`);
  return date;
}

function dayFile(date) {
  return path.join(HOME, 'days', `${date}.md`);
}

function fill(template, date) {
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return fs.readFileSync(path.join(TEMPLATES, template), 'utf8').replace(/{{date}}/g, date).replace(/{{weekday}}/g, weekday);
}

function ensureDay(date) {
  const file = dayFile(date);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fill('day.md', date));
  }
  return file;
}

function loadDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const file = dayFile(d);
    if (fs.existsSync(file)) out.push({ date: d, day: parseDay(fs.readFileSync(file, 'utf8')) });
  }
  return out;
}

const commands = {
  init(args) {
    for (const dir of ['days', 'weekly', 'checkups/files', 'photos']) fs.mkdirSync(path.join(HOME, dir), { recursive: true });
    for (const name of ['profile.md', 'plan.md', 'progress.md']) {
      const dest = path.join(HOME, name);
      if (fs.existsSync(dest) && !args.force) {
        console.log(`已存在，跳过: ${path.relative(process.cwd(), dest)}`);
        continue;
      }
      fs.copyFileSync(path.join(TEMPLATES, name), dest);
      console.log(`创建: ${path.relative(process.cwd(), dest)}`);
    }
    console.log('\n下一步：填 me/profile.md 的基本数据（或对 Claude 说"帮我建档"），然后运行 targets。');
  },

  targets() {
    const p = readProfile();
    const t = targets(p);
    console.log(`基础代谢 BMR      ${t.bmr} kcal${p.body_fat_pct ? '（按瘦体重 ' + t.leanMassKg + ' kg 计算）' : ''}`);
    console.log(`日常总消耗 TDEE   ${t.tdee} kcal（估算，戒指/手环数据更准时以实测为准）`);
    console.log(`每日热量目标      ${t.kcal} kcal（缺口 ${t.deficit}，上限 ${t.maxDeficit}；最低不低于 ${t.kcalFloor}）`);
    console.log(`蛋白质            ${t.protein.target} g（区间 ${t.protein.min}–${t.protein.max}，按 ${t.protein.basisKg} kg 计算）`);
    console.log(`脂肪下限          ${t.fatMin} g`);
    if (p.goal === 'cut') console.log(`理想掉重          每周 ${t.weeklyLossKg.min}–${t.weeklyLossKg.max} kg`);
  },

  today(args) {
    let profile = null;
    try {
      profile = readProfile();
    } catch {
      // 没建档也允许先记日志
    }
    console.log(ensureDay(resolveDate(args, profile)));
  },

  report(args) {
    const profile = readProfile();
    const date = resolveDate(args, profile);
    const file = dayFile(date);
    if (!fs.existsSync(file)) throw new Error(`${date} 还没有日志，先运行: node bin/boji.js today --date ${date}`);
    const md = fs.readFileSync(file, 'utf8');
    const { markdown } = dailyReport(parseDay(md), targets(profile));
    if (!args['no-write']) fs.writeFileSync(file, replaceBlock(md, REPORT_START, REPORT_END, markdown, '日报'));
    console.log(`# ${date} 日报\n\n${markdown}`);
  },

  week(args) {
    const profile = readProfile();
    const end = resolveDate(args, profile);
    const days = loadDays(addDays(end, -6), end);
    const prev = loadDays(addDays(end, -13), addDays(end, -7));
    const { markdown } = weeklyReview(days, prev, targets(profile), profile);
    const name = isoWeek(end);
    const out = `# ${name} 周报（${addDays(end, -6)} ~ ${end}）\n\n${markdown}\n\n## 教练点评\n<!-- Claude 在这里写本周复盘和下周计划 -->\n`;
    const file = path.join(HOME, 'weekly', `${name}.md`);
    if (!args['no-write']) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file) && !args.force) {
        const existing = fs.readFileSync(file, 'utf8');
        const note = existing.indexOf('## 教练点评');
        fs.writeFileSync(file, note === -1 ? out : out.slice(0, out.indexOf('## 教练点评')) + existing.slice(note));
      } else fs.writeFileSync(file, out);
    }
    console.log(out);
    if (!args['no-write']) console.log(`已写入 ${path.relative(process.cwd(), file)}`);
  },

  checkup(args) {
    let profile = null;
    try {
      profile = readProfile();
    } catch {
      // 体检记录不依赖档案
    }
    const date = resolveDate(args, profile);
    const file = path.join(HOME, 'checkups', `${date}.md`);
    fs.mkdirSync(path.join(HOME, 'checkups', 'files'), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, fill('checkup.md', date));
    console.log(file);
  },
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = commands[args._[0]];
  if (!cmd) {
    console.log(USAGE);
    process.exitCode = args._[0] ? 1 : 0;
    return;
  }
  try {
    cmd(args);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { addDays, isoWeek };
