# 滑雪大冒险

类地铁跑酷的 3 轨滑雪无尽跑酷，HTML5 Canvas + ES Modules。

## 运行

```bash
npm run dev          # 面板「启动」等效（自动带 GAME_BASE 与端口）
npm run test:smoke   # 构建 + Playwright 冒烟测试
```

## 操作

| 输入 | 动作 |
|---|---|
| ↑/W 或 上滑/轻点 | 跳跃（可五段，空中 ←/→ 特技） |
| ↓/S 或 下滑 | 蹲下（可长按） |
| ←/→ 或 左右滑 | 切换雪道 |
| P / Esc | 暂停 |
| R | 结算/暂停界面快速重开 |
| M | 主静音（持久化，键 `ski-adventure:settings`） |
