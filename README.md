# 🕹️ 二十年小飞侠 · 小游戏作品集

[English](README.en.md) | 简体中文

> 19 个从原型到可发布的网页小游戏，外加一套游戏工程化管理体系——契约注册、端口自动分配、统一入口面板、交付质量门禁，全部开源。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Games](https://img.shields.io/badge/games-19-brightgreen.svg)
![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%7C%20Phaser%203%20%7C%20PixiJS%20%7C%20Vite%20%7C%20TS-orange.svg)

---

## 🎮 游戏总览

### 已发布（playable × 12）

| 游戏 | ID | 技术栈 | 玩法 |
|---|---|---|---|
| [海岸滑板跑酷](games/coastal-skate/) | `coastal-skate` | 原生 JS / ES 模块 · 零依赖 | 海岸主题滑板跑酷 |
| [生命游戏](games/conway-life/) | `conway-life` | 原生 Canvas · 零依赖 | 宇宙许愿池：写下心愿，看混沌为你凝出专属符号，同生日凝出同一个宇宙 |
| [情绪下锅](games/emotion-pot/) | `emotion-pot` | 原生 JS · 零依赖 | 把惹你生气的人或事扔进锅里，戳一戳、乱炖、加怪料，看它出糗出锅 |
| [热血足球·射门挑战](games/football-shootout/) | `football-shootout` | 原生 JS · 零依赖 | 热血风格足球射门挑战 |
| [花园保卫战](games/garden-defense/) | `garden-defense` | Phaser 3 + Vite | 竖屏 10 行网格种花：花粉进化到 Lv5 名品，追踪/旋风/激光/抛物多弹道 |
| [躺平](games/lying-flat/) | `lying-flat` | 原生 JS · 零依赖 | 猛鬼宿舍式单机复刻：躺床产金、矿脉加成、升门造炮、抗猎梦者 |
| [糖果连锁 Match3](games/match3/) | `match3` | Phaser 3 + TS + Vite | 30 关线性 + 每日挑战 + 成绩卡导出 |
| [像素机甲对决](games/mecha-duel/) | `mecha-duel` | 原生 JS · 零依赖 | 复古像素机甲对战，街霸式必杀（升龙/发波）+ 连段 |
| [植物大战僵尸·杂交版](games/pvz-hybrid/) | `pvz-hybrid` | Phaser 3 + TS + Vite | 17 种植物 + 传送带随机选卡 + 融合怪兽变异，10 类僵尸 10 波防守 |
| [皇后谜题·每日一题](games/queens-daily/) | `queens-daily` | Vite + TS | LinkedIn Queens 同类解谜：N×N 网格放 N 枚皇后，行列色区恰一枚且两两不相邻 |
| [滑雪大冒险](games/ski-adventure/) | `ski-adventure` | Vite + Canvas | 类地铁跑酷的 3 轨滑雪无尽跑酷 |
| [亲子象棋](games/xiangqi/) | `xiangqi` | 原生 JS + PWA | 亲子趣味对战中国象棋，Service Worker 可安装 |

### 演示版（demo × 3）

| 游戏 | ID | 技术栈 | 玩法 |
|---|---|---|---|
| [魂斗罗复刻](games/contra-remake/) | `contra-remake` | Phaser 3 + TS + Vite | 复刻魂斗罗第一关，工程化最完整的参考项目 |
| [无限进化](games/infinite-evolution/) | `infinite-evolution` | 原生 JS · 零依赖 | 进化主题网页游戏，含完整设计文档与开发计划 |
| [星际防线](games/star-defense/) | `star-defense` | Vite + Canvas | 太空科幻塔防：多路径、元素克制、塔组合、对战模式 |

### 原型（prototype × 3）

| 游戏 | ID | 技术栈 | 玩法 |
|---|---|---|---|
| [示例小游戏](games/hello-game/) | `hello-game` | 原生 JS · 零依赖 | 演示模板与面板联动的接球样例 |
| [Roguelite 换装](games/roguelite-dressup/) | `roguelite-dressup` | Vite + 原生 JS | Roguelite × 换装玩法，多模块实现，含设计文档 |
| [技能实验室](games/skill-lab/) | `skill-lab` | PixiJS + Vite | 角色·技能·特效试验场：物理行为基因融合实验室 |

### 已归档（archived × 1）

| 游戏 | ID | 技术栈 | 玩法 |
|---|---|---|---|
| [贪吃蛇](games/snake/) | `snake` | 原生 JS · 零依赖 | 经典贪吃蛇 |

---

## 🏗️ 工程化管理体系

这个仓库不只是游戏合集，更是一套可复用的游戏工作区方法论：

| 机制 | 说明 |
|---|---|
| **game.json 契约** | 每个游戏一个契约文件：id、状态、端口、启动命令的唯一真源，dashboard 与工具全部按契约渲染 |
| **端口自动分配** | 4100–4999 专用段，`tools/new.mjs` 扫描注册表 + 实时探测空闲后自动分配，杜绝手挑冲突 |
| **统一入口面板** | dashboard 管理面板代理 `/g/<id>/`，无需记端口；卡片可启停，每 3 秒健康轮询 |
| **四动词脚本约定** | 全仓统一 `dev` / `build` / `test` / `lint`，静态游戏用 `python3 -m http.server` 兜底 |
| **交付质量门禁** | `tools/check.mjs` 巡检（清单完整性 / 端口冲突 / 资产缺失），`tools/qa.mjs` 交付前契约 + lint/test + 质量标准自查 |
| **状态生命周期** | `idea → prototype → demo → playable → archived`，完成度变化只改 game.json，不删项目 |
| **规范唯一源** | [AGENTS.md](AGENTS.md)：目录结构、契约 schema、端口段、脚本动词、生命周期，全部规则集中一处 |

## 🚀 快速开始

```bash
# 方式一：管理面板（推荐）——统一入口、一键启停任意游戏
node dashboard/server.mjs        # 浏览器打开 http://localhost:4000

# 方式二：静态游戏直接开（10 个零依赖游戏，无需 npm install）
cd games/conway-life && python3 -m http.server 4100   # http://localhost:4100

# 方式三：Vite / Phaser 游戏
cd games/garden-defense && npm install && npm run dev
```

日常工具：

```bash
node tools/ports.mjs            # 查看端口分配表与在线状态
node tools/check.mjs            # 工作区健康审计
node tools/qa.mjs <game-id>     # 交付前自检
```

## 📁 目录结构

```
games/
├── games/              # 一游戏一目录，各自含 game.json / README / cover.png / docs
├── dashboard/          # 管理面板（全局入口，game.json 的渲染产物）
├── tools/              # new / ports / check / qa 全局脚本
└── AGENTS.md           # 工作区规范（唯一规则源）
```

## 📦 收录说明

- 仓库共收录 **19 个游戏**，覆盖原生 JS/Canvas、Phaser 3、PixiJS、Vite + TypeScript、PWA 五条技术线
- 每个游戏自带 game.json 契约、README、封面与设计文档，可独立运行
- 第三方版权素材与大体量素材未收录；游戏封面已统一压缩至 640px 宽，控制仓库体积

## 📄 License

[MIT](LICENSE) © 2026 二十年小飞侠
