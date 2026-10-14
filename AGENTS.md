# games 工作区规范（唯一规则源）

> 本文件是游戏工作区的**唯一规则源**。规则变更须人工审定后修改本文件。
> 最后审定：2026-10-14

## 1. 定位

本目录是网页小游戏的统一工作区：开发、运行、发布都在这里，一个目录就是一个可独立运行的游戏。

## 2. 目录结构

```
games/
├── AGENTS.md              # 本文件：唯一规则源
├── README.md              # 项目简介
├── LICENSE                # MIT
├── games/                 # 所有游戏，一游戏一目录
│   └── <game-id>/
│       ├── game.json      # ★ 唯一状态源，dashboard 的接入契约
│       ├── README.md      # 简介 / 操作说明 / 截图
│       ├── cover.png      # 封面（dashboard 卡片用）
│       ├── src/...        # 源码
│       └── docs/          # 游戏设计文档
├── dashboard/             # 管理面板 = 全局入口（渲染产物，状态不在这里）
└── tools/                 # new / ports / check / qa 全局脚本
```

## 3. 核心制度

1. **路径即接口**：已在 `games/` 注册的游戏目录禁止改名、移动、删除。dashboard 端口、入口链接都锚定路径。
2. **状态只进 game.json**：状态、端口、启动命令只改 `game.json`；dashboard 是它的渲染产物，不在别处维护平行状态表。
3. **迭代直接覆盖**，不留 v2/v3 文件；确需多版对比才保留并注明用途。
4. **新游戏一律脚手架创建**：`node tools/new.mjs <id> --name <中文名>`，禁止手工裸建目录。
5. **端口只经 tools/new.mjs 分配**，禁止手挑顺眼数字。

## 4. game.json 契约

```jsonc
{
  "id": "snake",                // 必填，=目录名，小写字母数字连字符
  "name": "贪吃蛇",             // 必填，展示名
  "description": "一句话简介",   // 必填
  "status": "playable",         // idea | prototype | demo | playable | archived
  "type": "web",                // web | native（native 指 pygame/Godot/Unity 等窗口程序）
  "tags": ["arcade"],
  "port": 4121,                 // web 必填，由 tools/new 自动分配；native 留 null
  "run": "npm run dev -- --port {port}",  // 启动命令，{port} 会被替换
  "entry": "/",                 // 打开时的子路径
  "cover": "cover.png",         // 缺省时卡片显示占位图
  "prefix": true,               // 可选，vite 等依赖 base 前缀的游戏设 true，代理不剥离 /g/<id> 前缀
  "root": "web"                 // 可选，静态资源根目录（默认仓库根；入口校验按此目录解析）
}
```

## 5. 端口规范

- 游戏专用段 **4100–4999**，dashboard 本体固定 **4000**
- 分配只经 `tools/new.mjs`（扫描已注册端口 + 实时探测空闲），禁止手挑顺眼数字
- 排查占用：`node tools/ports.mjs`；健康审计：`node tools/check.mjs`

## 6. 脚本动词约定

每个 web 游戏的 package.json 只认这四个动词，dashboard 与文档都按此约定：

| 动词 | 含义 |
|---|---|
| `dev` | 本地运行（接受 `-- --port <n>`） |
| `build` | 构建产物 |
| `test` | 测试 |
| `lint` | 类型检查/静态检查 |

纯静态游戏（无 package.json）用 `python3 -m http.server {port}` 即可。

## 7. 状态生命周期

```
idea → prototype → demo → playable → archived
```

- 完成度变化时改 `game.json` 的 `status`，不删项目
- `archived` = 不再维护但保留可玩历史；dashboard 中灰显

## 8. Dashboard 使用

```bash
node dashboard/server.mjs        # 启动面板，浏览器开 http://localhost:4000
```

- 面板每 3 秒轮询刷新；卡片上可启动/停止/打开游戏
- 统一入口走代理：`http://localhost:4000/g/<id>/`，无需记端口
- 「直连」按钮直达 `127.0.0.1:<port>`，排查代理问题时用

机器可读接口：

- `GET /api/games`（全量状态）、`GET /api/games/:id/devlog`、`POST /api/games/:id/start|stop`、`GET /api/check`
