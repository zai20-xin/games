# 皇后谜题·每日一题

N×N 网格放置 N 枚皇后：每行、每列、每个色区恰一枚，且两两不相邻（含斜向）。LinkedIn Queens 同类玩法，每日一题。

## 运行

```bash
npm run dev        # 面板「启动」等效（自动带 GAME_BASE 与端口）
npm run test       # vitest 逻辑测试
```

## 适配

- 移动端：格子尺寸按视口宽度自适应（≥44px 触控目标），窄屏收紧留白
- 经面板代理访问时不加载 Vite HMR 客户端（代理不转发 WebSocket），console 保持干净

## 来源

原为 match3 工程内的 queens/ 子项目，2026-08-26 拆分为独立游戏。
