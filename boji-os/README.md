# 薄肌 OS

**用 Claude Code 管理身体：保护好身体 → 练出薄肌。**

仿照孙宇晨在 [邵艾伦访谈](https://www.youtube.com/watch?v=0Z-vhBvBmUY) 里公开的做法：饭前饭后拍照、训练视频、Oura 睡眠数据全部交给 Claude Code，记成本地 Markdown，每天出日报；在此基础上补了**安全守则**和**科学核对**——访谈里有几处说法会误导人（"有氧可以不做""70 岁练就晚了"），这里都做了纠正。

```
你：（发一张午饭照片）
Claude：午餐约 620–700 kcal，蛋白质 48 g。先吃鱼和虾仁，米饭吃一半就够。
        今天还剩 560 kcal、蛋白质还差 49 g → 晚饭加一块鸡胸或两个鸡蛋。

你：（晚上）出日报
Claude：摄入 1,470 / 1,690 kcal · 缺口 880 · 蛋白质 121 g · 睡眠 6.7 h
        ✅ 深蹲、卧推都按计划完成
        ⚠️ 缺口 880 超过 600 上限，容易掉肌肉
        👉 明天：训练后加一杯牛奶 + 一根香蕉
```

---

## 快速开始

需要 Node.js 18+，不需要装任何依赖。

```bash
cd boji-os
node bin/boji.js init          # 创建 me/ 目录（你的私人数据）
claude                         # 打开 Claude Code，说"帮我建档"
```

建完档之后，每天只做三件事：

1. **起床称重**，把 Oura/手表截图发给 Claude
2. **每餐拍照**，饭前一张、吃完一张
3. **训练后**发记录或视频

晚上说"出日报"，周日说"周报"。

> 想先看效果？`npm run demo` 会用示例数据生成一份日报。

## 能做什么

| 你说 / 你发 | Claude 做什么 | 技能 |
|---|---|---|
| "帮我建档"、"我膝盖有旧伤" | 安全筛查 → 档案 → 按伤病和器械定制训练计划 | `setup` |
| 饭菜照片 | 估热量和三大营养素、建议进食顺序、报告剩余预算 | `meal` |
| 训练视频 / 记录 | 记组数次数重量、抽帧检查动作、定下次重量 | `workout` |
| Oura / 手表 / 体脂秤截图 | 录入睡眠、准备度、心率、HRV、消耗、体重 | `body-data` |
| "出日报" | 汇总 + 风险提醒 + 明天一件事 | `daily-report` |
| "周报" | 体重趋势、蛋白质达标、训练次数、要不要调热量/减载 | `weekly-review` |
| 体检报告 | 结构化、对比上次、标异常、列出要问医生的问题 | `checkup` |

## 命令行

```bash
node bin/boji.js targets                 # 每日热量/蛋白质/脂肪目标
node bin/boji.js today [--date D]        # 创建当天日志
node bin/boji.js report [--date D]       # 日报写回日志
node bin/boji.js week [--date D]         # 周报
node bin/boji.js checkup [--date D]      # 新建体检记录
npm test                                 # 跑测试
```

计算口径：BMR 用 Katch-McArdle（有体脂时）或 Mifflin-St Jeor；减脂缺口默认 400、**上限 600**、不低于基础代谢；蛋白质 1.6–2.2 g/kg（高体脂按目标体重算）；每周掉重 0.5%–1%。详见 [CLAUDE.md](CLAUDE.md)。

## 目录

```
boji-os/
  CLAUDE.md / AGENTS.md   给 AI 的操作手册（同一份，换 Codex 也能接手）
  .claude/skills/         7 个技能
  bin/boji.js             命令行
  lib/                    解析、计算、日报/周报
  templates/              档案、每日日志、训练计划、体检、进度表模板
  docs/
    safety.md             ⚠️ 保护身体：红线症状、疼痛分级、减脂安全线
    三件套总览.md          孙学 · 薄肌 · 黄毛怎么组成一个系统 + 统一 90 天计划
    孙学.md                认知层：时间线、20 条原则、行动方案、矛盾与争议
    薄肌.md                身体层：邵艾伦原版 + 孙宇晨执行版 + 2024–2026 科学核对表
    黄毛理论.md            心态层：词源、两性版 vs 心态版、噪音/信号过滤工具
  examples/me/            示例数据
  me/                     你的数据（gitignore，不会提交）
```

## 隐私：你的数据不会进仓库

`me/` 已被 `.gitignore` 排除。**这个 GitHub 仓库是公开的**，体重、饭菜照片、体检报告都不应该提交上来。

- **在自己电脑上用**（推荐，和孙宇晨一样存本地）：直接用，数据就在 `boji-os/me/`。
- **想多设备同步**：建一个**私有**仓库或网盘文件夹放数据，设置 `export BOJI_HOME=/path/to/private/me`。
- **在 Claude Code 云端会话里用**：云端容器用完会回收，`me/` 里的东西会丢。要么用私有仓库存数据，要么只在本地用。

## 三件套提炼

孙宇晨和邵艾伦的"孙学、薄肌、黄毛"，按同一结构重写（v2，资料截至 2026-10-12）：一页速览 → 时间线 → 框架 → 原则逐条（原话 + 时间戳 / 白话 / 核对 / 怎么用）→ 行动方案 → 矛盾与批评 → 来源。每条都标了可信度（🟢 原话 · 🟡 二手 · ⚪ 评论 · ❓ 未证实）。

- [三件套总览](docs/三件套总览.md)——先读这篇：架构、互相强化的方式、统一 90 天计划、风险清单
- [孙学](docs/孙学.md)——认知层：认知决定命运、AI 化、先自由后财富、逐水草而居、先探路再下注
- [薄肌](docs/薄肌.md)——身体层：邵艾伦的"薄肌圣经"方法 + 孙宇晨的 AI 执行版 + **科学核对表**
- [黄毛理论](docs/黄毛理论.md)——心态层：屏蔽情绪噪音、保留事实信号，**不屏蔽身体信号**

## 免责声明

这是一个记录和分析工具，不是医疗服务。Claude 的估算有误差（研究显示大模型看照片估热量平均误差约 36–42%）。有病史、伤病，或者出现 [docs/safety.md](docs/safety.md) 里的任何红线症状，请先找医生。

## 资料来源

- 访谈原片：[孙宇晨 × 邵艾伦｜年轻人如何抓住 AI 时代的机会？](https://www.youtube.com/watch?v=0Z-vhBvBmUY)（4 小时 22 分钟，2026 年 10 月）
- 逐字精校稿：[AayuBal/shaoailun-sunyuchen-podcast](https://github.com/AayuBal/shaoailun-sunyuchen-podcast)（正文版权归孙宇晨、邵艾伦）
- 邵艾伦：[《薄肌指南》](https://x.com/AlanShao111/article/2100011450840526918)
- 孙宇晨：[X 帖子"版本答案"](https://x.com/sunyuchentron/status/2097637277375820038)
- 访谈整理：[BlockBeats](https://www.theblockbeats.info/news/63859)、[PANews](https://www.panewslab.com/zh/articles/01a12034-cb1d-7627-8e1f-52e048809ac1)、[TechFlow](https://www.techflowpost.com/article/34433)
