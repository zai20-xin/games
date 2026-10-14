# 海岸滑板跑酷

海岸滑板跑酷网页游戏（index.html + css/ + js/ ES 模块静态实现）。

## 操作

- 空格 / 点击：跳跃（可二段跳，按住跳更高）
- ↓ / S：滑铲穿过横杆；Shift：冲刺
- P：暂停；R：重开；M：静音
- 触屏：点击跳、双击冲刺、下滑铲

## 存档

- 历史最佳分存 `localStorage` 的 `coastal-skate:save`
- 静音偏好存 `coastal-skate:settings`

## 结构

- `js/config.js` 数值配置 · `js/utils.js` 工具函数 · `js/audio.js` 合成音效 · `js/save.js` 本地存档 · `js/main.js` 主逻辑
