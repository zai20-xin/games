# 技能实验室



Phaser 3 + TypeScript + Vite 脚手架。

## 开发

```bash
npm install
npm run dev        # 面板「启动」等效于 GAME_BASE=/g/<id>/ npm run dev -- --port <n>
```

## 脚本

| 命令 | 用途 |
|---|---|
| `npm run dev` | 本地开发 |
| `npm run build` | 类型检查 + 构建产物到 dist/ |
| `npm run lint` | TypeScript 严格类型检查 |

## 说明

- `vite.config.ts` 里 `base` 读 `GAME_BASE` 环境变量，保证游戏能通过 dashboard 代理路径 `/g/<id>/` 正常加载资源，直连端口也不受影响
- 素材放 `public/assets/`，代码中用 `/assets/xxx.png` 引用（相对 base）
- 新场景建议拆分到 `src/scenes/`
