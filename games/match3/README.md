# 糖果连锁 Match3

Phaser/TypeScript 实现的三消网页游戏（`web/` 为可玩实现）。

## 运行

面板「启动」（等效 `GAME_BASE=/g/match3/ npm --prefix web run dev -- --port <n>`），或：

```bash
cd web && npm install && npm run dev
```

自检：

```bash
cd web && npx tsc --noEmit   # 类型检查
cd web && npm test           # vitest 单测（棋盘/关卡/会话/通关流）
```

## 操作

| 输入 | 动作 |
|---|---|
| 点击两枚相邻棋子 / 拖动 | 交换 |
| P 或「暂停」按钮 | 暂停面板 |
| R | 暂停/结算界面快速重玩本关 |
| M | 主静音（持久化，键 `match3:settings`） |

## 目录

- `web/` 可玩的 Phaser/TS 实现（入口、关卡、构建配置都在这里）
- `web/public/levels/` 关卡数据；目标字段规范：score→`target`、collect→`count`+`color`、frost→`target`
- `archive/godot/` 早期 Godot 工程留档（`project.godot`、GDScript 源码、Godot 测试等，2026-08-27 从根目录移入），非当前主线，仅保留历史
