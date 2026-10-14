# Contra · Level 1 Demo

魂斗罗第一关的浏览器复刻，使用 Vite + TypeScript + Phaser 3。

## 开发

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173

## 测试

```bash
npm run test         # 单元
npm run test:e2e     # 端到端
```

## 操作

- ←/→ 移动
- ↑ 进门 / ↓ 下蹲
- Space 跳、Z 射击
- P 暂停 / 继续（暂停中也可按）
- R 整局重开（暂停中也生效）
- M 静音开关（菜单/局内均可用，记忆到 localStorage `contra-remake:settings`）

## 文档

- 设计: [spec](./docs/superpowers/specs/2026-07-12-contra-level1-demo-design.md)
- 计划: [plan](./docs/superpowers/plans/2026-07-12-contra-level1-demo-plan.md)

## 资源

所有美术与音频都是**程序化生成**的占位资源（CC0 / 公有领域），由 `scripts/gen_assets.py` + `scripts/gen_audio.py` 输出到 `public/images/` 与 `public/audio/`。在 venv 内执行：

```bash
# 一次性建 venv
python3 -m venv .venv
unset PYTHONHOME PYTHONPATH  # 防止 TRAE 注入的 PYTHONHOME 污染
.venv/bin/pip install --break-system-packages pillow numpy

# 重新生成所有资源
npm run assets:gen
```

> 真实 CC0 / 自由素材到位后，用同名文件覆盖 `public/images/*.png` 与 `public/audio/*.wav` 即可，无需改代码。
